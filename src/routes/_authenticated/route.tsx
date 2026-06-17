import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Inbox,
  Package,
  ShoppingBag,
  BarChart3,
  Settings,
  LogOut,
  Sparkles,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

const nav = [
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/catalog", label: "Catalog", icon: Package },
  { to: "/orders", label: "Orders", icon: ShoppingBag },
  { to: "/escalations", label: "Escalations", icon: AlertTriangle },
  { to: "/playground", label: "Playground", icon: Sparkles },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

function AuthenticatedLayout() {
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

  // Routes that should render WITHOUT the app shell (e.g. onboarding wizard).
  const bareRoutes = ["/onboarding"];
  const isBare = bareRoutes.some((p) => pathname.startsWith(p));

  // If no business yet, force onboarding (except already there).
  if (!isLoading && !business && !isBare) {
    navigate({ to: "/onboarding", replace: true });
  }

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  };

  if (isBare) return <Outlet />;

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
            const active = pathname.startsWith(n.to);
            const cls =
              "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors " +
              (active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground");
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

      <main className="flex min-h-screen flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
