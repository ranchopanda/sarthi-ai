import { createAPIFileRoute } from "@tanstack/react-start/api";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient<Database>(url, key);
}

function verifyRazorpayHmac(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const crypto = globalThis.crypto;
  const encoder = new TextEncoder();
  return crypto.subtle
    .importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"])
    .then((key) =>
      crypto.subtle.verify("HMAC", key, encoder.encode(signature), encoder.encode(body)),
    );
}

export const Route = createAPIFileRoute("/public/razorpay/webhook")({
  POST: async ({ request }) => {
    const body = await request.text();
    const signature = request.headers.get("x-razorpay-signature");
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret || webhookSecret.startsWith("mock")) {
      console.error("[razorpay] RAZORPAY_WEBHOOK_SECRET not configured — rejecting webhook");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    const valid = await verifyRazorpayHmac(body, signature, webhookSecret);
    if (!valid) {
      return new Response("Invalid signature", { status: 401 });
    }

    let event: any;
    try {
      event = JSON.parse(body);
    } catch {
      return new Response("Bad payload", { status: 400 });
    }

    // Process payment_link.paid event
    if (event.event === "payment_link.paid") {
      const paymentLink = event.payload?.payment_link?.entity;
      const orderId = paymentLink?.reference_id;

      if (orderId) {
        const db = getAdminClient();
        await db.from("orders").update({ status: "paid" }).eq("id", orderId);

        // Get order details for conversation update
        const { data: order } = await db
          .from("orders")
          .select("conversation_id, customer_id, total_paise, business_id")
          .eq("id", orderId)
          .maybeSingle();

        if (order?.conversation_id) {
          // Send payment confirmation message
          const { data: conn } = await db
            .from("whatsapp_connections")
            .select("phone_number_id, access_token")
            .eq("business_id", order.business_id)
            .maybeSingle();

          const { data: customer } = await db
            .from("customers")
            .select("wa_id")
            .eq("id", order.customer_id)
            .maybeSingle();

          if (conn?.access_token && conn.phone_number_id && customer?.wa_id) {
            const msg = `Payment confirm ho gaya! Order #${orderId.slice(0, 8)} confirm hai. Jaldi se jaldi pack karwa dete hain. 🙏`;
            await fetch(`https://graph.facebook.com/v21.0/${conn.phone_number_id}/messages`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${conn.access_token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: customer.wa_id,
                type: "text",
                text: { body: msg },
              }),
            });

            await db.from("messages").insert({
              conversation_id: order.conversation_id,
              business_id: order.business_id,
              direction: "outbound",
              sender: "agent",
              content: msg,
              message_type: "text",
            });
          }
        }
      }
    }

    return new Response("OK", { status: 200 });
  },
});
