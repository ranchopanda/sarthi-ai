import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { Bot, Send, Loader2, User, ArrowUpRight, Wrench, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { runPlaygroundAgent } from "@/lib/api/playground.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/playground")({
  head: () => ({
    meta: [{ title: "Playground · Sarthi AI" }, { name: "robots", content: "noindex" }],
  }),
  component: PlaygroundPage,
});

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
  meta?: {
    toolCalls?: string[];
    confidence?: number;
    escalated?: boolean;
  };
}

function PlaygroundPage() {
  const { user } = Route.useRouteContext();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "agent",
      content:
        "Namaste! Main Sarthi hoon. Aapke business ke liye kya kar sakta hoon? Try karo — mujhse pucho ki blue kurta kitne ka hai, ya order kaise karein.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: business } = useQuery({
    queryKey: ["my-business", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("businesses")
        .select("id, name")
        .eq("owner_id", user.id)
        .maybeSingle();
      return data;
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!business?.id) throw new Error("Business not loaded");
      return runPlaygroundAgent({
        data: {
          userId: user.id,
          businessId: business.id,
          messageText: text,
          conversationHistory: messages
            .filter((m) => m.id !== "welcome")
            .map((m) => ({
              role: m.role === "user" ? ("customer" as const) : ("agent" as const),
              content: m.content,
            })),
        },
      });
    },
    onSuccess: (result) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `agent-${Date.now()}`,
          role: "agent",
          content: result.reply,
          timestamp: new Date(),
          meta: {
            toolCalls: result.toolCalls,
            confidence: result.confidence,
            escalated: result.escalated,
          },
        },
      ]);
    },
    onError: (e: any) => {
      toast.error(e.message ?? "Agent error");
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "agent",
          content: "Technical issue hai abhi. Thodi der mein try karo. 🙏",
          timestamp: new Date(),
        },
      ]);
    },
  });

  const handleSend = () => {
    const text = input.trim();
    if (!text || sendMutation.isPending) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date(),
      },
    ]);
    setInput("");
    sendMutation.mutate(text);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-border bg-card/60 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold">Playground</h1>
            <p className="text-sm text-muted-foreground">
              Chat with Sarthi to test how it replies. No WhatsApp needed.
            </p>
          </div>
          {business && <Badge variant="outline">{business.name}</Badge>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "agent" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-card border border-border rounded-tl-sm"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
                {msg.meta && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {msg.meta.toolCalls?.map((tc) => (
                      <Badge key={tc} variant="secondary" className="text-[10px] gap-1">
                        <Wrench className="h-2.5 w-2.5" />
                        {tc}
                      </Badge>
                    ))}
                    {msg.meta.confidence != null && (
                      <Badge
                        variant={msg.meta.confidence >= 87 ? "secondary" : "destructive"}
                        className="text-[10px]"
                      >
                        {msg.meta.confidence}% confident
                      </Badge>
                    )}
                    {msg.meta.escalated && (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Escalated
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          {sendMutation.isPending && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-border bg-card/60 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="mx-auto flex max-w-2xl gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message as a customer..."
            disabled={sendMutation.isPending}
            className="flex-1"
          />
          <Button type="submit" disabled={!input.trim() || sendMutation.isPending}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="mx-auto mt-2 max-w-2xl text-center text-xs text-muted-foreground">
          This is a testing interface. Replies use your live catalog and business settings.
        </p>
      </div>
    </div>
  );
}
