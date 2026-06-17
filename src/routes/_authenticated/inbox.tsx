import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Send,
  Loader2,
  User,
  Bot,
  ArrowLeft,
  Shield,
  Play,
  Pause,
  Clock,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getConversations,
  getConversationMessages,
  takeoverConversation,
  resumeAgent,
  sendManualReply,
} from "@/lib/api/inbox.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [{ title: "Inbox · Sarthi AI" }, { name: "robots", content: "noindex" }],
  }),
  component: InboxPage,
});

function InboxPage() {
  const { user } = Route.useRouteContext();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations", user.id],
    queryFn: () => getConversations({ data: { userId: user.id } }),
  });

  const selected = conversations.find((c) => c.id === selectedId);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Conversation list */}
      <div
        className={`flex w-full flex-col border-r border-border bg-card/40 md:w-[340px] ${
          selectedId ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display text-lg font-semibold">Inbox</h2>
          <p className="text-xs text-muted-foreground">
            {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
          </p>
        </div>
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                No conversations yet. Connect WhatsApp to start receiving messages.
              </p>
            </div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                  selectedId === c.id ? "bg-muted" : ""
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                  {(c.customer_name ?? c.customer_wa_id ?? "?")[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm font-medium">
                      {c.customer_name || c.customer_wa_id || "Unknown"}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {c.last_message_time ? formatTime(c.last_message_time) : ""}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {c.status === "taken_over" && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5">
                        <Shield className="h-2.5 w-2.5" /> You
                      </Badge>
                    )}
                    {c.status === "escalated" && (
                      <Badge variant="destructive" className="text-[9px] px-1 py-0">
                        Escalated
                      </Badge>
                    )}
                    <span className="truncate text-xs text-muted-foreground">
                      {c.last_message_content?.slice(0, 60) ?? "No messages"}
                    </span>
                  </div>
                </div>
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Conversation detail */}
      {selectedId ? (
        <ConversationDetail
          conversationId={selectedId}
          userId={user.id}
          onBack={() => setSelectedId(null)}
        />
      ) : (
        <div className="hidden flex-1 items-center justify-center bg-background md:flex">
          <div className="text-center">
            <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-3 text-sm text-muted-foreground">
              Select a conversation to view messages
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ConversationDetail({
  conversationId,
  userId,
  onBack,
}: {
  conversationId: string;
  userId: string;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () =>
      getConversationMessages({
        data: { userId, conversationId },
      }),
  });

  const takeoverMut = useMutation({
    mutationFn: () => takeoverConversation({ data: { userId, conversationId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
      toast.success("You've taken over this conversation. Sarthi is paused.");
    },
  });

  const resumeMut = useMutation({
    mutationFn: () => resumeAgent({ data: { userId, conversationId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
      toast.success("Sarthi is back on this conversation.");
    },
  });

  const replyMut = useMutation({
    mutationFn: (content: string) => sendManualReply({ data: { userId, conversationId, content } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      setReply("");
    },
    onError: (e: any) => toast.error(e.message ?? "Send failed"),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages]);

  const conv = data?.conversation as any;
  const customer = conv?.customer as any;
  const messages = data?.messages ?? [];
  const isTakenOver = conv?.status === "taken_over";

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-card/60 px-4 py-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="md:hidden">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
          {(customer?.name ?? customer?.wa_id ?? "?")[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">
            {customer?.name || customer?.wa_id || "Unknown"}
          </div>
          <div className="text-xs text-muted-foreground">
            {customer?.wa_id} · {messages.length} messages
          </div>
        </div>
        {isTakenOver ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => resumeMut.mutate()}
            disabled={resumeMut.isPending}
          >
            <Play className="mr-1.5 h-3.5 w-3.5" />
            Resume Sarthi
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => takeoverMut.mutate()}
            disabled={takeoverMut.isPending}
          >
            <Pause className="mr-1.5 h-3.5 w-3.5" />
            Take over
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-3">
            {messages.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No messages yet.</p>
            )}
            {messages.map((m: any) => (
              <div
                key={m.id}
                className={`flex ${m.direction === "inbound" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.direction === "inbound"
                      ? "bg-card border border-border rounded-tl-sm"
                      : m.sender === "merchant"
                        ? "bg-ink text-paper rounded-tr-sm"
                        : "bg-primary text-primary-foreground rounded-tr-sm"
                  }`}
                >
                  {m.sender === "merchant" && (
                    <div className="mb-1 flex items-center gap-1 text-[10px] opacity-70">
                      <User className="h-2.5 w-2.5" /> You
                    </div>
                  )}
                  {m.sender === "agent" && (
                    <div className="mb-1 flex items-center gap-1 text-[10px] opacity-70">
                      <Bot className="h-2.5 w-2.5" /> Sarthi
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{m.content}</div>
                  <div className="mt-1 text-[10px] opacity-50">
                    {new Date(m.created_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Reply box */}
      <div className="border-t border-border bg-card/60 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (reply.trim()) replyMut.mutate(reply.trim());
          }}
          className="flex gap-2"
        >
          <Input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={isTakenOver ? "Type your reply..." : "Take over to reply manually..."}
            disabled={!isTakenOver || replyMut.isPending}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!isTakenOver || !reply.trim() || replyMut.isPending}
          >
            {replyMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        {!isTakenOver && (
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Click "Take over" to reply manually. Sarthi will pause for this conversation.
          </p>
        )}
      </div>
    </div>
  );
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHrs = diffMs / 3600000;
  if (diffHrs < 1) return `${Math.round(diffMs / 60000)}m`;
  if (diffHrs < 24) return `${Math.round(diffHrs)}h`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
