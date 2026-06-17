import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

function verifyRazorpaySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  if (signature.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/razorpay/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const signature = request.headers.get("x-razorpay-signature");
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

        if (!secret) {
          return new Response("Webhook secret not configured", { status: 500 });
        }
        if (!verifyRazorpaySignature(body, signature, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: any;
        try {
          event = JSON.parse(body);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        if (event.event !== "payment_link.paid") {
          return new Response("OK", { status: 200 });
        }

        const paymentLink = event.payload?.payment_link?.entity;
        const orderId = paymentLink?.reference_id;
        if (!orderId) return new Response("OK", { status: 200 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("orders").update({ status: "paid" }).eq("id", orderId);

        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("conversation_id, customer_id, business_id")
          .eq("id", orderId)
          .maybeSingle();

        if (order?.conversation_id) {
          const { data: conn } = await supabaseAdmin
            .from("whatsapp_connections")
            .select("phone_number_id, access_token")
            .eq("business_id", order.business_id)
            .maybeSingle();

          const { data: customer } = await supabaseAdmin
            .from("customers")
            .select("wa_id")
            .eq("id", order.customer_id)
            .maybeSingle();

          if (conn?.access_token && conn.phone_number_id && customer?.wa_id) {
            const msg = `Payment confirm ho gaya! Order #${orderId.slice(0, 8)} confirm hai. Jaldi pack karwa dete hain. 🙏`;
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

            await supabaseAdmin.from("messages").insert({
              conversation_id: order.conversation_id,
              business_id: order.business_id,
              direction: "outbound",
              sender: "agent",
              content: msg,
              message_type: "text",
            });
          }
        }

        return new Response("OK", { status: 200 });
      },
    },
  },
});
