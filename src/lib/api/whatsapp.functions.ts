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

export const getWhatsAppConnection = createServerFn({ method: "GET" })
  .validator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const businessId = await getBusinessId(data.userId);
    const { data: conn, error } = await supabaseAdmin
      .from("whatsapp_connections")
      .select(
        "id, phone_number_id, waba_id, display_phone, status, webhook_verify_token, created_at",
      )
      .eq("business_id", businessId)
      .maybeSingle();
    if (error) throw error;
    return conn;
  });

export const saveWhatsAppConnection = createServerFn({ method: "POST" })
  .validator(
    z.object({
      userId: z.string().uuid(),
      phone_number_id: z.string().min(1),
      waba_id: z.string().optional().nullable(),
      access_token: z.string().min(1),
      display_phone: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const businessId = await getBusinessId(data.userId);

    // Generate a unique webhook verify token
    const verifyToken = `sarthi_${businessId.slice(0, 8)}_${Date.now().toString(36)}`;

    const { data: conn, error } = await supabaseAdmin
      .from("whatsapp_connections")
      .upsert(
        {
          business_id: businessId,
          phone_number_id: data.phone_number_id,
          waba_id: data.waba_id || null,
          access_token: data.access_token,
          display_phone: data.display_phone || null,
          webhook_verify_token: verifyToken,
          status: "connected",
        },
        { onConflict: "business_id" },
      )
      .select("id, webhook_verify_token")
      .single();
    if (error) throw error;
    return { id: conn.id, verifyToken };
  });

export const disconnectWhatsApp = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const businessId = await getBusinessId(data.userId);
    const { error } = await supabaseAdmin
      .from("whatsapp_connections")
      .delete()
      .eq("business_id", businessId);
    if (error) throw error;
    return { success: true };
  });

export const sendOutboundMessage = createServerFn({ method: "POST" })
  .validator(
    z.object({
      userId: z.string().uuid(),
      conversationId: z.string().uuid(),
      content: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const businessId = await getBusinessId(data.userId);

    // Get conversation + customer wa_id
    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .select("id, customer_id, customers(wa_id)")
      .eq("id", data.conversationId)
      .eq("business_id", businessId)
      .single();
    if (!conv) throw new Error("Conversation not found");

    // Get WhatsApp connection
    const { data: conn } = await supabaseAdmin
      .from("whatsapp_connections")
      .select("phone_number_id, access_token")
      .eq("business_id", businessId)
      .maybeSingle();
    if (!conn?.access_token || !conn.phone_number_id) {
      throw new Error("WhatsApp not connected");
    }

    const customer = conv.customers as unknown as { wa_id: string };
    if (!customer?.wa_id) throw new Error("Customer WhatsApp ID not found");

    // Send via Meta Graph API
    const res = await fetch(`https://graph.facebook.com/v21.0/${conn.phone_number_id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${conn.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: customer.wa_id,
        type: "text",
        text: { body: data.content },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`WhatsApp send failed: ${err}`);
    }

    // Log outbound message
    await supabaseAdmin.from("messages").insert({
      conversation_id: data.conversationId,
      business_id: businessId,
      direction: "outbound",
      sender: "merchant",
      content: data.content,
      message_type: "text",
    });

    return { success: true };
  });
