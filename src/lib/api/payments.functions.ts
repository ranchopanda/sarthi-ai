import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function getBusinessId(ownerId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error || !data) throw new Error("Business not found");
  return data.id;
}

async function getRazorpayCreds() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || keyId.startsWith("mock")) {
    throw new Error("Razorpay not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  }
  return { keyId, keySecret };
}

export const createRazorpayPaymentLink = createServerFn({ method: "POST" })
  .validator(
    z.object({
      userId: z.string().uuid(),
      orderId: z.string().uuid(),
      amount: z.number().int().positive(),
      customerName: z.string().optional(),
      description: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const businessId = await getBusinessId(data.userId);

    // Verify order belongs to this business
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, total_paise, status")
      .eq("id", data.orderId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (!order) throw new Error("Order not found");

    const { keyId: rkId, keySecret } = await getRazorpayCreds();

    // Create payment link via Razorpay API
    const authHeader = "Basic " + Buffer.from(`${rkId}:${keySecret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: data.amount,
        currency: "INR",
        accept_partial: false,
        description: data.description || `Order #${data.orderId.slice(0, 8)}`,
        customer: data.customerName ? { name: data.customerName } : undefined,
        notify: { sms: false, email: false },
        reference_id: data.orderId,
        callback_url:
          typeof window !== "undefined" ? `${window.location.origin}/orders` : undefined,
        callback_method: "get",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[razorpay] Payment link creation failed:", err);
      throw new Error(`Razorpay error: ${err}`);
    }

    const paymentLink = await res.json();

    // Update order with payment link
    await supabaseAdmin
      .from("orders")
      .update({
        upi_link: paymentLink.short_url,
        payment_ref: paymentLink.id,
        status: "awaiting_payment",
      })
      .eq("id", data.orderId);

    return {
      paymentLinkId: paymentLink.id,
      shortUrl: paymentLink.short_url,
      upiUrl: paymentLink.upi_url,
    };
  });

export const checkRazorpayPaymentStatus = createServerFn({ method: "POST" })
  .validator(z.object({ orderId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, payment_ref, business_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) throw new Error("Order not found");
    if (!order.payment_ref) return { status: "no_payment_link" };

    const { keyId: rkId, keySecret } = await getRazorpayCreds();
    const authHeader = "Basic " + Buffer.from(`${rkId}:${keySecret}`).toString("base64");

    const res = await fetch(`https://api.razorpay.com/v1/payment_links/${order.payment_ref}`, {
      headers: { Authorization: authHeader },
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[razorpay] Status check failed:", err);
      return { status: "error", detail: err };
    }

    const link = await res.json();
    const paid = link.status === "paid";

    if (paid && order.id) {
      await supabaseAdmin.from("orders").update({ status: "paid" }).eq("id", order.id);

      // Update conversation revenue
      const { data: fullOrder } = await supabaseAdmin
        .from("orders")
        .select("conversation_id, total_paise")
        .eq("id", order.id)
        .maybeSingle();

      if (fullOrder?.conversation_id) {
        await supabaseAdmin
          .from("conversations")
          .update({
            last_message_at: new Date().toISOString(),
          })
          .eq("id", fullOrder.conversation_id);
      }
    }

    return { status: paid ? "paid" : "pending", razorpayStatus: link.status };
  });
