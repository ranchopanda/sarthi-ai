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

export const getConversations = createServerFn({ method: "GET" })
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const businessId = await getBusinessId(data.userId);

    const { data: convs, error } = await supabaseAdmin
      .from("conversations")
      .select(
        `id, status, last_message_at, created_at,
         customer:customers(id, wa_id, name, tags),
         last_message:messages!messages_conversation_id_fkey(content, direction, sender, created_at)`,
      )
      .eq("business_id", businessId)
      .order("last_message_at", { ascending: false });

    if (error) throw error;

    // Deduplicate — get only the last message per conversation
    const conversations = (convs ?? []).map((c) => {
      const msgs = c.last_message as any[];
      const lastMsg = Array.isArray(msgs) ? msgs[msgs.length - 1] : msgs;
      const cust = c.customer as any;
      return {
        id: c.id,
        status: c.status,
        last_message_at: c.last_message_at,
        customer_name: cust?.name,
        customer_wa_id: cust?.wa_id,
        customer_tags: cust?.tags,
        last_message_content: lastMsg?.content,
        last_message_direction: lastMsg?.direction,
        last_message_sender: lastMsg?.sender,
        last_message_time: lastMsg?.created_at,
      };
    });

    return conversations;
  });

export const getConversationMessages = createServerFn({ method: "GET" })
  .inputValidator(z.object({ userId: z.string().uuid(), conversationId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const businessId = await getBusinessId(data.userId);

    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .select("id, status, customer:customers(id, wa_id, name, tags)")
      .eq("id", data.conversationId)
      .eq("business_id", businessId)
      .single();
    if (!conv) throw new Error("Conversation not found");

    const { data: messages, error } = await supabaseAdmin
      .from("messages")
      .select("id, direction, sender, content, message_type, media_url, agent_meta, created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });
    if (error) throw error;

    return { conversation: conv, messages: messages ?? [] };
  });

export const takeoverConversation = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string().uuid(), conversationId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const businessId = await getBusinessId(data.userId);
    const { error } = await supabaseAdmin
      .from("conversations")
      .update({ agent_enabled: false })
      .eq("id", data.conversationId)
      .eq("business_id", businessId);
    if (error) throw error;
    return { success: true };
  });

export const resumeAgent = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string().uuid(), conversationId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const businessId = await getBusinessId(data.userId);
    const { error } = await supabaseAdmin
      .from("conversations")
      .update({ status: "open" })
      .eq("id", data.conversationId)
      .eq("business_id", businessId);
    if (error) throw error;
    return { success: true };
  });

export const sendManualReply = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      userId: z.string().uuid(),
      conversationId: z.string().uuid(),
      content: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const businessId = await getBusinessId(data.userId);

    // Get WhatsApp credentials
    const { data: conn } = await supabaseAdmin
      .from("whatsapp_connections")
      .select("phone_number_id, access_token")
      .eq("business_id", businessId)
      .maybeSingle();

    // Get customer wa_id
    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .select("customer:customers(wa_id)")
      .eq("id", data.conversationId)
      .single();
    const customer = conv?.customer as any;

    // Send via WhatsApp if connected
    if (conn?.access_token && conn.phone_number_id && customer?.wa_id) {
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
          text: { body: data.content },
        }),
      });
    }

    // Log message
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

export const getEscalations = createServerFn({ method: "GET" })
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const businessId = await getBusinessId(data.userId);

    const { data: escalations, error } = await supabaseAdmin
      .from("escalations")
      .select(
        `id, reason, status, created_at, resolved_at,
         conversation:conversations(id, status, customer:customers(name, wa_id))`,
      )
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    return escalations ?? [];
  });

export const resolveEscalation = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      userId: z.string().uuid(),
      escalationId: z.string().uuid(),
      resolution: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const businessId = await getBusinessId(data.userId);

    const { error } = await supabaseAdmin
      .from("escalations")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", data.escalationId)
      .eq("business_id", businessId);
    if (error) throw error;
    return { success: true };
  });

export const getOrders = createServerFn({ method: "GET" })
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const businessId = await getBusinessId(data.userId);

    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select(
        `id, status, total_paise, items, notes, upi_link, payment_ref, created_at, updated_at,
         customer:customers(name, wa_id)`,
      )
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return orders ?? [];
  });

export const saveCorrection = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      userId: z.string().uuid(),
      messageId: z.string().uuid(),
      original: z.string(),
      corrected: z.string(),
      reason: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const businessId = await getBusinessId(data.userId);

    const { error } = await supabaseAdmin.from("agent_corrections").insert({
      business_id: businessId,
      message_id: data.messageId,
      original: data.original,
      corrected: data.corrected,
      reason: data.reason || null,
    });
    if (error) throw error;
    return { success: true };
  });
