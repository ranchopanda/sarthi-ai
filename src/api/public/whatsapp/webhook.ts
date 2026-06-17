import { createAPIFileRoute } from "@tanstack/react-start/api";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient<Database>(url, key);
}

function verifyHmac(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const crypto = globalThis.crypto;
  const encoder = new TextEncoder();
  return crypto.subtle
    .importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"])
    .then((key) =>
      crypto.subtle.verify("HMAC", key, encoder.encode(signature), encoder.encode(body)),
    );
}

async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string,
) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[whatsapp] Send failed:", err);
  }
  return res.ok;
}

export const Route = createAPIFileRoute("/public/whatsapp/webhook")({
  GET: async ({ request }) => {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode !== "subscribe" || !challenge) {
      return new Response("Bad request", { status: 400 });
    }

    const db = getAdminClient();
    const { data: conn } = await db
      .from("whatsapp_connections")
      .select("webhook_verify_token, business_id")
      .eq("webhook_verify_token", token)
      .maybeSingle();

    if (!conn) {
      return new Response("Invalid verify token", { status: 403 });
    }

    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  },

  POST: async ({ request }) => {
    const body = await request.text();
    const signature = request.headers.get("x-hub-signature-256");

    // Find which business this webhook belongs to by iterating connections
    const db = getAdminClient();
    const { data: connections } = await db
      .from("whatsapp_connections")
      .select("business_id, access_token, phone_number_id");

    if (!connections?.length) {
      return new Response("OK", { status: 200 });
    }

    // Verify HMAC signature with the app secret
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (appSecret && !appSecret.startsWith("mock")) {
      const valid = await verifyHmac(body, signature, appSecret);
      if (!valid) {
        return new Response("Invalid signature", { status: 401 });
      }
    }

    // Match business by phone_number_id in payload
    let matchedBiz: (typeof connections)[0] | null = null;
    for (const conn of connections) {
      if (!conn.access_token || !conn.phone_number_id) continue;
      // Parse payload to find phone_number_id match
      try {
        const payload = JSON.parse(body);
        const entry = payload.entry?.[0];
        const change = entry?.changes?.[0];
        const value = change?.value;
        if (value?.metadata?.phone_number_id === conn.phone_number_id) {
          matchedBiz = conn;
          break;
        }
      } catch {
        // malformed payload
      }
    }

    if (!matchedBiz) {
      return new Response("OK", { status: 200 });
    }

    // Process async — don't block Meta's webhook timeout
    processWebhook(body, matchedBiz).catch((err) =>
      console.error("[whatsapp] Webhook processing error:", err),
    );

    return new Response("OK", { status: 200 });
  },
});

async function processWebhook(
  body: string,
  conn: { business_id: string; access_token: string | null; phone_number_id: string | null },
) {
  const payload = JSON.parse(body);
  const entry = payload.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;

  if (!value?.messages?.length) return; // status update, not a message

  const db = getAdminClient();
  const message = value.messages[0];
  const contact = value.contacts?.[0];

  if (message.type !== "text") return; // MVP: text only

  const waId = message.from;
  const text = message.text?.body?.trim();
  if (!waId || !text) return;

  // Upsert customer
  const { data: customer } = await db
    .from("customers")
    .upsert(
      {
        business_id: conn.business_id,
        wa_id: waId,
        name: contact?.profile?.name || null,
      },
      { onConflict: "business_id,wa_id" },
    )
    .select("id")
    .single();

  if (!customer) {
    console.error("[whatsapp] Failed to upsert customer");
    return;
  }

  // Find existing open conversation for this customer
  const { data: existingConv } = await db
    .from("conversations")
    .select("id")
    .eq("business_id", conn.business_id)
    .eq("customer_id", customer.id)
    .eq("status", "open")
    .maybeSingle();

  let convId = existingConv?.id;

  if (!convId) {
    // Create new conversation
    const { data: newConv } = await db
      .from("conversations")
      .insert({
        business_id: conn.business_id,
        customer_id: customer.id,
        status: "open",
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    convId = newConv?.id;
  } else {
    // Update timestamp on existing conversation
    await db
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", convId);
  }

  if (!convId) {
    console.error("[whatsapp] Failed to create conversation");
    return;
  }

  // Insert inbound message
  await db.from("messages").insert({
    conversation_id: convId,
    business_id: conn.business_id,
    direction: "inbound",
    sender: "customer",
    content: text,
    message_type: "text",
    wa_message_id: message.id || null,
  });

  // Update conversation timestamp
  await db
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", convId);

  // Get conversation history for agent context
  const { data: historyMessages } = await db
    .from("messages")
    .select("direction, content")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true })
    .limit(20);

  const conversationHistory = (historyMessages ?? []).map((m) => ({
    role: m.direction === "inbound" ? ("customer" as const) : ("agent" as const),
    content: m.content ?? "",
  }));

  // Run Sarthi agent
  const { runAgent } = await import("@/lib/agent.server");
  const agentResult = await runAgent({
    businessId: conn.business_id,
    customerWaId: waId,
    customerName: contact?.profile?.name,
    messageText: text,
    conversationHistory,
  });

  // Send reply or handle escalation
  if (conn.access_token && conn.phone_number_id) {
    let replyText = agentResult.reply;

    if (agentResult.escalated) {
      replyText =
        replyText ||
        "Ji, aapka request humare team ko bhej diya hai. Jaldi se jaldi aapko reply karenge. 🙏";
    }

    // Anti-spam: check last outbound count
    const { count: recentOutbound } = await db
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", convId)
      .eq("direction", "outbound")
      .gte("created_at", new Date(Date.now() - 60_000).toISOString());

    if ((recentOutbound ?? 0) < 2) {
      await sendWhatsAppMessage(conn.phone_number_id, conn.access_token, waId, replyText);

      await db.from("messages").insert({
        conversation_id: convId,
        business_id: conn.business_id,
        direction: "outbound",
        sender: "agent",
        content: replyText,
        message_type: "text",
        agent_meta: JSON.stringify({
          tool_calls: agentResult.toolCalls,
          confidence: agentResult.confidence,
          escalated: agentResult.escalated,
        }),
      });
    }
  }
}
