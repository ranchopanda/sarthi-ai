import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Inbox,
  Package,
  Users,
  ShoppingBag,
  BarChart3,
  Settings,
  LogOut,
  Sparkles,
  MessageSquare,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard · Sarthi AI" }, { name: "robots", content: "noindex" }],
  }),
  component: Dashboard,
});

const nav = [
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/catalog", label: "Catalog", icon: Package },
  { to: "/orders", label: "Orders", icon: ShoppingBag },
  { to: "/escalations", label: "Escalations", icon: AlertTriangle },
  { to: "/playground", label: "Playground", icon: Sparkles },
  { to: "/dashboard", label: "Customers", icon: Users, soon: true },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

function Dashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: business, isLoading } = useQuery({
    queryKey: ["my-business", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!isLoading) {
      if (!business) {
        navigate({ to: "/onboarding", replace: true });
      } else {
        navigate({ to: "/inbox", replace: true });
      }
    }
  }, [isLoading, business, navigate]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  };

  if (isLoading || !business) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid min-h-screen md:grid-cols-[260px_1fr] bg-background">
      <aside className="hidden border-r border-sidebar-border bg-sidebar p-4 md:flex md:flex-col">
        <Link to="/" className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-display font-bold">
            स
          </div>
          <span className="font-display text-lg font-semibold">Sarthi</span>
        </Link>
        <div className="px-2 pb-3 text-xs text-muted-foreground truncate">{business.name}</div>
        <nav className="mt-1 space-y-1">
          {nav.map((n) => {
            const active = pathname === n.to;
            const cls =
              "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors " +
              (active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground") +
              (n.soon ? " cursor-not-allowed opacity-60" : "");
            if (n.soon) {
              return (
                <button key={n.label} disabled className={cls}>
                  <span className="flex items-center gap-3">
                    <n.icon className="h-4 w-4" />
                    {n.label}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Soon
                  </span>
                </button>
              );
            }
            return (
              <Link key={n.label} to={n.to as any} className={cls}>
                <span className="flex items-center gap-3">
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-2 border-t border-sidebar-border pt-4">
          <div className="px-3 py-2 text-xs text-muted-foreground truncate">{user.email}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <main className="flex flex-col">
        <div className="border-b border-border bg-card/60 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-semibold">Inbox</h1>
              <p className="text-sm text-muted-foreground">
                Conversations Sarthi is handling for {business.name}.
              </p>
            </div>
            <Button variant="outline" size="sm" className="md:hidden" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md rounded-2xl border border-dashed border-border bg-card p-10 text-center shadow-card">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-display text-xl font-semibold">No conversations yet.</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Connect your WhatsApp Business number and upload your catalog so Sarthi can start
              replying to customers automatically.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button disabled>
                <Sparkles className="mr-2 h-4 w-4" />
                Connect WhatsApp (coming next)
              </Button>
              <p className="text-xs text-muted-foreground">
                WhatsApp Cloud API, catalog upload, and the live agent ship in the next phase.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
