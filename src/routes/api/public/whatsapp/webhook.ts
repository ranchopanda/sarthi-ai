import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

function verifyMetaSignature(body: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;
  const prefix = "sha256=";
  if (!signatureHeader.startsWith(prefix)) return false;
  const provided = signatureHeader.slice(prefix.length);
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
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
    console.error("[whatsapp] Send failed:", await res.text());
  }
  return res.ok;
}

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        if (mode !== "subscribe" || !challenge || !token) {
          return new Response("Bad request", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: conn } = await supabaseAdmin
          .from("whatsapp_connections")
          .select("webhook_verify_token")
          .eq("webhook_verify_token", token)
          .maybeSingle();

        if (!conn) {
          return new Response("Invalid verify token", { status: 403 });
        }

        return new Response(challenge, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      },

      POST: async ({ request }) => {
        const body = await request.text();
        const signature = request.headers.get("x-hub-signature-256");

        const appSecret = process.env.WHATSAPP_APP_SECRET;
        if (!appSecret) {
          console.error("[whatsapp] WHATSAPP_APP_SECRET not configured");
          return new Response("Server not configured", { status: 500 });
        }
        if (!verifyMetaSignature(body, signature, appSecret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const phoneNumberId =
          payload?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
        if (!phoneNumberId) {
          return new Response("OK", { status: 200 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: conn } = await supabaseAdmin
          .from("whatsapp_connections")
          .select("business_id, access_token, phone_number_id")
          .eq("phone_number_id", phoneNumberId)
          .maybeSingle();

        if (!conn) return new Response("OK", { status: 200 });

        // Fire & forget — Meta needs a fast 200
        processWebhook(payload, conn).catch((err) =>
          console.error("[whatsapp] processing error:", err),
        );

        return new Response("OK", { status: 200 });
      },
    },
  },
});

async function processWebhook(
  payload: any,
  conn: { business_id: string; access_token: string | null; phone_number_id: string | null },
) {
  const value = payload?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  if (!message || message.type !== "text") return;

  const contact = value.contacts?.[0];
  const waId = message.from;
  const text = message.text?.body?.trim();
  if (!waId || !text) return;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin;

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

  if (!customer) return;

  const { data: existingConv } = await db
    .from("conversations")
    .select("id, agent_enabled")
    .eq("business_id", conn.business_id)
    .eq("customer_id", customer.id)
    .eq("status", "open")
    .maybeSingle();

  let convId = existingConv?.id;
  const agentEnabled = existingConv?.agent_enabled ?? true;

  if (!convId) {
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
    await db
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", convId);
  }
  if (!convId) return;

  await db.from("messages").insert({
    conversation_id: convId,
    business_id: conn.business_id,
    direction: "inbound",
    sender: "customer",
    content: text,
    message_type: "text",
    wa_message_id: message.id || null,
  });

  if (!agentEnabled) return; // Merchant took over — don't auto-reply

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

  const { runAgent } = await import("@/lib/agent.server");
  const agentResult = await runAgent({
    businessId: conn.business_id,
    customerWaId: waId,
    customerName: contact?.profile?.name,
    messageText: text,
    conversationHistory,
  });

  if (!conn.access_token || !conn.phone_number_id) return;

  const replyText =
    agentResult.reply ||
    (agentResult.escalated
      ? "Ji, aapka request humare team ko bhej diya hai. Jaldi reply karenge. 🙏"
      : "");
  if (!replyText) return;

  // Anti-spam: cap outbound to 2 per minute per conversation
  const { count: recentOutbound } = await db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", convId)
    .eq("direction", "outbound")
    .gte("created_at", new Date(Date.now() - 60_000).toISOString());

  if ((recentOutbound ?? 0) >= 2) return;

  await sendWhatsAppMessage(conn.phone_number_id, conn.access_token, waId, replyText);

  await db.from("messages").insert({
    conversation_id: convId,
    business_id: conn.business_id,
    direction: "outbound",
    sender: "agent",
    content: replyText,
    message_type: "text",
    agent_meta: {
      tool_calls: agentResult.toolCalls,
      confidence: agentResult.confidence,
      escalated: agentResult.escalated,
    } as any,
  });
}
