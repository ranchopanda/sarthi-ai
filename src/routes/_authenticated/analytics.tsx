import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  MessageSquare,
  Clock,
  ShoppingCart,
  IndianRupee,
  AlertTriangle,
  Loader2,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { getAnalytics } from "@/lib/api/analytics.functions";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [{ title: "Analytics · Sarthi AI" }, { name: "robots", content: "noindex" }],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { user } = Route.useRouteContext();
  const [period, setPeriod] = useState<"7d" | "30d">("7d");

  const { data: stats, isLoading } = useQuery({
    queryKey: ["analytics", user.id, period],
    queryFn: () => getAnalytics({ data: { userId: user.id, period } }),
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const cards = [
    {
      title: "Conversations",
      value: stats?.totalConversations ?? 0,
      icon: MessageSquare,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Automation rate",
      value: `${stats?.automationRate ?? 0}%`,
      icon: Zap,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      title: "Orders",
      value: stats?.orderCount ?? 0,
      icon: ShoppingCart,
      color: "text-saffron",
      bg: "bg-saffron/10",
    },
    {
      title: "Revenue",
      value: `₹${((stats?.totalRevenue ?? 0) / 100).toLocaleString("en-IN")}`,
      icon: IndianRupee,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      title: "Hours saved",
      value: `${stats?.hoursSaved ?? 0}h`,
      icon: Clock,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Escalation rate",
      value: `${stats?.escalationRate ?? 0}%`,
      icon: AlertTriangle,
      color: (stats?.escalationRate ?? 0) > 15 ? "text-destructive" : "text-muted-foreground",
      bg: (stats?.escalationRate ?? 0) > 15 ? "bg-destructive/10" : "bg-muted",
    },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-border bg-card/60 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold">Analytics</h1>
            <p className="text-sm text-muted-foreground">
              How Sarthi is performing for your business
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              variant={period === "7d" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod("7d")}
            >
              7 days
            </Button>
            <Button
              variant={period === "30d" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod("30d")}
            >
              30 days
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6">
        {/* Metric cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <Card key={c.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {c.title}
                </CardTitle>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.bg}`}>
                  <c.icon className={`h-4 w-4 ${c.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="font-display text-2xl font-semibold">{c.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        {stats?.daily && stats.daily.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Conversations chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Conversations & AI messages</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={stats.daily}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      className="text-xs"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="conversations"
                      stackId="1"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.2}
                      name="Conversations"
                    />
                    <Area
                      type="monotone"
                      dataKey="ai_messages"
                      stackId="2"
                      stroke="hsl(var(--success))"
                      fill="hsl(var(--success))"
                      fillOpacity={0.2}
                      name="AI replies"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Orders & Revenue chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Orders & Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={stats.daily}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      className="text-xs"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      yAxisId="left"
                      className="text-xs"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      className="text-xs"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="orders"
                      fill="hsl(var(--saffron))"
                      radius={[4, 4, 0, 0]}
                      name="Orders"
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="revenue"
                      fill="hsl(var(--success))"
                      radius={[4, 4, 0, 0]}
                      name="Revenue (₹)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Summary stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total messages handled</span>
                <div className="mt-1 font-semibold">{stats?.totalMessages ?? 0}</div>
              </div>
              <div>
                <span className="text-muted-foreground">AI replies sent</span>
                <div className="mt-1 font-semibold">{stats?.aiMessages ?? 0}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Customer messages</span>
                <div className="mt-1 font-semibold">{stats?.customerMessages ?? 0}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Open escalations</span>
                <div className="mt-1 font-semibold">{stats?.openEscalations ?? 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
