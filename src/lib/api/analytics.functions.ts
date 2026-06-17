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

export const getAnalytics = createServerFn({ method: "GET" })
  .validator(
    z.object({
      userId: z.string().uuid(),
      period: z.enum(["7d", "30d"]).default("7d"),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const businessId = await getBusinessId(data.userId);

    const days = data.period === "7d" ? 7 : 30;
    const since = new Date(Date.now() - days * 86400000).toISOString();

    // Total conversations in period
    const { count: totalConvs } = await supabaseAdmin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", since);

    // Escalated conversations
    const { count: escalatedConvs } = await supabaseAdmin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "escalated")
      .gte("created_at", since);

    // Total messages
    const { count: totalMessages } = await supabaseAdmin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", since);

    // AI messages (automated)
    const { count: aiMessages } = await supabaseAdmin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("sender", "agent")
      .gte("created_at", since);

    // Customer messages
    const { count: customerMessages } = await supabaseAdmin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("sender", "customer")
      .gte("created_at", since);

    // Orders in period
    const { count: orderCount } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", since);

    // Revenue
    const { data: revenueData } = await supabaseAdmin
      .from("orders")
      .select("total_paise")
      .eq("business_id", businessId)
      .in("status", ["paid", "cod", "fulfilled"])
      .gte("created_at", since);

    const totalRevenue = (revenueData ?? []).reduce((sum, o) => sum + (o.total_paise ?? 0), 0);

    // Escalation queue count
    const { count: openEscalations } = await supabaseAdmin
      .from("escalations")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "open");

    // Daily breakdown for charts
    const dailyData: Record<
      string,
      { convs: number; orders: number; revenue: number; ai_msgs: number }
    > = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      dailyData[key] = { convs: 0, orders: 0, revenue: 0, ai_msgs: 0 };
    }

    // Get conversations by day
    const { data: convRows } = await supabaseAdmin
      .from("conversations")
      .select("created_at")
      .eq("business_id", businessId)
      .gte("created_at", since);
    for (const row of convRows ?? []) {
      const d = new Date(row.created_at);
      const key = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      if (dailyData[key]) dailyData[key].convs++;
    }

    // Get orders by day
    const { data: orderRows } = await supabaseAdmin
      .from("orders")
      .select("created_at, total_paise, status")
      .eq("business_id", businessId)
      .gte("created_at", since);
    for (const row of orderRows ?? []) {
      const d = new Date(row.created_at);
      const key = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      if (dailyData[key]) {
        dailyData[key].orders++;
        if (["paid", "cod", "fulfilled"].includes(row.status)) {
          dailyData[key].revenue += row.total_paise ?? 0;
        }
      }
    }

    // Get AI messages by day
    const { data: msgRows } = await supabaseAdmin
      .from("messages")
      .select("created_at")
      .eq("business_id", businessId)
      .eq("sender", "agent")
      .gte("created_at", since);
    for (const row of msgRows ?? []) {
      const d = new Date(row.created_at);
      const key = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      if (dailyData[key]) dailyData[key].ai_msgs++;
    }

    const daily = Object.entries(dailyData).map(([date, v]) => ({
      date,
      conversations: v.convs,
      orders: v.orders,
      revenue: v.revenue / 100,
      ai_messages: v.ai_msgs,
    }));

    // Rates
    const automationRate =
      customerMessages && customerMessages > 0
        ? Math.round(((aiMessages ?? 0) / ((aiMessages ?? 0) + (customerMessages ?? 0))) * 100)
        : 0;
    const escalationRate =
      totalConvs && totalConvs > 0 ? Math.round(((escalatedConvs ?? 0) / totalConvs) * 100) : 0;

    // Hours saved: each AI message saves ~30 seconds
    const hoursSaved = ((aiMessages ?? 0) * 30) / 3600;

    return {
      period: data.period,
      totalConversations: totalConvs ?? 0,
      escalatedConversations: escalatedConvs ?? 0,
      totalMessages: totalMessages ?? 0,
      aiMessages: aiMessages ?? 0,
      customerMessages: customerMessages ?? 0,
      orderCount: orderCount ?? 0,
      totalRevenue,
      openEscalations: openEscalations ?? 0,
      automationRate,
      escalationRate,
      hoursSaved: Math.round(hoursSaved * 10) / 10,
      daily,
    };
  });
