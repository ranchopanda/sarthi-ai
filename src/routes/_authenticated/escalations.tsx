import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getEscalations, resolveEscalation } from "@/lib/api/inbox.functions";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/escalations")({
  head: () => ({
    meta: [{ title: "Escalations · Sarthi AI" }, { name: "robots", content: "noindex" }],
  }),
  component: EscalationsPage,
});

function EscalationsPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [selectedEsc, setSelectedEsc] = useState<any>(null);

  const { data: escalations = [], isLoading } = useQuery({
    queryKey: ["escalations", user.id],
    queryFn: () => getEscalations({ data: { userId: user.id } }),
  });

  const openEscalations = escalations.filter((e: any) => e.status === "open");
  const resolvedEscalations = escalations.filter((e: any) => e.status === "resolved");

  const resolveMut = useMutation({
    mutationFn: (escalationId: string) =>
      resolveEscalation({ data: { userId: user.id, escalationId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["escalations"] });
      toast.success("Escalation resolved");
      setSelectedEsc(null);
    },
  });

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-border bg-card/60 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold">Escalations</h1>
            <p className="text-sm text-muted-foreground">
              {openEscalations.length} open · {resolvedEscalations.length} resolved
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : openEscalations.length === 0 && resolvedEscalations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-success/50" />
            <h2 className="mt-4 font-display text-xl font-semibold">All clear</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              No escalations. Sarthi is handling everything smoothly.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {openEscalations.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                  Open ({openEscalations.length})
                </h3>
                <div className="space-y-3">
                  {openEscalations.map((esc: any) => {
                    const conv = esc.conversation as any;
                    const customer = conv?.customer as any;
                    return (
                      <Card key={esc.id} className="border-destructive/30">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                              <CardTitle className="text-sm">
                                {customer?.name || customer?.wa_id || "Customer"}
                              </CardTitle>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="destructive" className="text-[10px]">
                                Open
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(esc.created_at).toLocaleString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </div>
                          <CardDescription className="mt-1">{esc.reason}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => resolveMut.mutate(esc.id)}
                            disabled={resolveMut.isPending}
                          >
                            {resolveMut.isPending ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Resolve
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setSelectedEsc(esc)}>
                            <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                            View conversation
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {resolvedEscalations.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                  Resolved ({resolvedEscalations.length})
                </h3>
                <div className="space-y-2">
                  {resolvedEscalations.map((esc: any) => {
                    const conv = esc.conversation as any;
                    const customer = conv?.customer as any;
                    return (
                      <div
                        key={esc.id}
                        className="flex items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-3 opacity-60"
                      >
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">
                            {customer?.name || customer?.wa_id || "Customer"}
                          </div>
                          <div className="text-xs text-muted-foreground">{esc.reason}</div>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {esc.resolved_at
                            ? new Date(esc.resolved_at).toLocaleString("en-IN", {
                                day: "numeric",
                                month: "short",
                              })
                            : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Conversation detail dialog */}
      <AlertDialog open={!!selectedEsc} onOpenChange={(v) => !v && setSelectedEsc(null)}>
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Escalation Details</AlertDialogTitle>
            <AlertDialogDescription>
              {(selectedEsc?.conversation as any)?.customer?.name || "Customer"} —{" "}
              {selectedEsc?.reason}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            <p>
              <strong>Reason:</strong> {selectedEsc?.reason}
            </p>
            <p className="mt-2">
              <strong>Time:</strong>{" "}
              {selectedEsc?.created_at
                ? new Date(selectedEsc.created_at).toLocaleString("en-IN")
                : ""}
            </p>
            <p className="mt-3">
              Go to the{" "}
              <a href="/inbox" className="text-primary hover:underline">
                Inbox
              </a>{" "}
              to view the full conversation and reply.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction onClick={() => resolveMut.mutate(selectedEsc?.id)}>
              Mark resolved
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
