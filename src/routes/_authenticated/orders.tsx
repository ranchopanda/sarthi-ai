import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package, Loader2, ExternalLink, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getOrders } from "@/lib/api/inbox.functions";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [{ title: "Orders · Sarthi AI" }, { name: "robots", content: "noindex" }],
  }),
  component: OrdersPage,
});

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ReactNode;
  }
> = {
  draft: { label: "Draft", variant: "outline", icon: <Clock className="h-3 w-3" /> },
  awaiting_payment: {
    label: "Awaiting",
    variant: "secondary",
    icon: <Clock className="h-3 w-3" />,
  },
  paid: { label: "Paid", variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
  cod: { label: "COD", variant: "secondary", icon: <Package className="h-3 w-3" /> },
  fulfilled: { label: "Fulfilled", variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
  cancelled: { label: "Cancelled", variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
};

function OrdersPage() {
  const { user } = Route.useRouteContext();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", user.id],
    queryFn: () => getOrders({ data: { userId: user.id } }),
  });

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-border bg-card/60 px-6 py-4">
        <h1 className="font-display text-2xl font-semibold">Orders</h1>
        <p className="text-sm text-muted-foreground">
          {orders.length} order{orders.length !== 1 ? "s" : ""} total
        </p>
      </div>

      <div className="flex-1 p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-16 text-center">
            <Package className="h-10 w-10 text-muted-foreground/50" />
            <h2 className="mt-4 font-display text-xl font-semibold">No orders yet</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Orders will appear here when customers purchase through Sarthi.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order: any) => {
                  const customer = order.customer as any;
                  const items = (order.items as any[]) ?? [];
                  const status = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.draft;
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs">{order.id.slice(0, 8)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                            {(customer?.name ?? "?")[0]?.toUpperCase()}
                          </div>
                          <span className="text-sm">
                            {customer?.name || customer?.wa_id || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {items.map((i: any) => `${i.name} x${i.qty}`).join(", ") || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{((order.total_paise ?? 0) / 100).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className="gap-1">
                          {status.icon}
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {order.upi_link ? (
                          <a
                            href={order.upi_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            UPI link
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : order.payment_ref ? (
                          <span className="text-xs text-muted-foreground">{order.payment_ref}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
