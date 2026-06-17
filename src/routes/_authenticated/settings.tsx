import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  MessageSquare,
  CheckCircle2,
  XCircle,
  Copy,
  ExternalLink,
  Loader2,
  Unplug,
  Settings as SettingsIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getWhatsAppConnection,
  saveWhatsAppConnection,
  disconnectWhatsApp,
} from "@/lib/api/whatsapp.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [{ title: "Settings · Sarthi AI" }, { name: "robots", content: "noindex" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext();

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-border bg-card/60 px-6 py-4">
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your WhatsApp connection and business settings.
        </p>
      </div>

      <div className="flex-1 p-6">
        <Tabs defaultValue="whatsapp" className="max-w-3xl">
          <TabsList>
            <TabsTrigger value="whatsapp">
              <MessageSquare className="mr-2 h-4 w-4" />
              WhatsApp
            </TabsTrigger>
            <TabsTrigger value="general" disabled>
              <SettingsIcon className="mr-2 h-4 w-4" />
              General
            </TabsTrigger>
          </TabsList>

          <TabsContent value="whatsapp" className="mt-6">
            <WhatsAppTab userId={user.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function WhatsAppTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: conn, isLoading } = useQuery({
    queryKey: ["whatsapp-connection", userId],
    queryFn: () => getWhatsAppConnection({ data: { userId } }),
  });

  const [connecting, setConnecting] = useState(false);
  const [form, setForm] = useState({
    phone_number_id: "",
    waba_id: "",
    access_token: "",
    display_phone: "",
  });

  const connectMut = useMutation({
    mutationFn: () =>
      saveWhatsAppConnection({
        data: {
          userId,
          phone_number_id: form.phone_number_id,
          waba_id: form.waba_id || null,
          access_token: form.access_token,
          display_phone: form.display_phone || null,
        },
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["whatsapp-connection"] });
      toast.success("WhatsApp connected!");
      setConnecting(false);
      setForm({ phone_number_id: "", waba_id: "", access_token: "", display_phone: "" });
    },
    onError: (e: any) => {
      toast.error(e.message ?? "Connection failed");
      setConnecting(false);
    },
  });

  const disconnectMut = useMutation({
    mutationFn: () => disconnectWhatsApp({ data: { userId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-connection"] });
      toast.success("WhatsApp disconnected");
    },
    onError: (e: any) => toast.error(e.message ?? "Disconnect failed"),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isConnected = conn?.status === "connected";

  const webhookBase = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = `${webhookBase}/api/public/whatsapp/webhook`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-6">
      {/* Status card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Connection Status
                {isConnected ? (
                  <Badge variant="secondary" className="bg-success/10 text-success">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    <XCircle className="mr-1 h-3 w-3" />
                    Not connected
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {isConnected
                  ? `Connected to ${conn.display_phone ?? conn.phone_number_id}`
                  : "Connect your WhatsApp Business number to start receiving messages."}
              </CardDescription>
            </div>
            {isConnected && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnectMut.mutate()}
                disabled={disconnectMut.isPending}
              >
                {disconnectMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Unplug className="mr-2 h-4 w-4" />
                )}
                Disconnect
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Setup instructions */}
      {!isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Connect WhatsApp Business API</CardTitle>
            <CardDescription>
              Follow these steps to connect your official Meta WhatsApp Business number.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  1
                </span>
                Get your Meta credentials
              </div>
              <p className="ml-8 text-sm text-muted-foreground">
                Go to{" "}
                <a
                  href="https://developers.facebook.com/apps/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Meta for Developers
                  <ExternalLink className="h-3 w-3" />
                </a>{" "}
                → your app → WhatsApp → Configuration. You need:
              </p>
              <ul className="ml-8 space-y-1 text-sm text-muted-foreground">
                <li>
                  • <strong>Phone Number ID</strong> — found in WhatsApp → Getting Started
                </li>
                <li>
                  • <strong>Access Token</strong> — generate a permanent token
                </li>
                <li>
                  • <strong>WABA ID</strong> (optional) — WhatsApp Business Account ID
                </li>
              </ul>
            </div>

            {/* Step 2 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  2
                </span>
                Enter credentials below
              </div>
            </div>

            {/* Step 3 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  3
                </span>
                Paste the webhook URL in Meta
              </div>
              <div className="ml-8 flex items-center gap-2">
                <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs break-all">
                  {webhookUrl}
                </code>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(webhookUrl)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="ml-8 text-xs text-muted-foreground">
                Meta Dashboard → WhatsApp → Configuration → Webhook → Callback URL. Paste the URL
                above. Use the verify token shown after connecting.
              </p>
            </div>

            {/* Connect form */}
            <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-4">
              <h4 className="text-sm font-semibold">Your Meta credentials</h4>
              <div className="space-y-2">
                <Label htmlFor="pnid">Phone Number ID *</Label>
                <Input
                  id="pnid"
                  value={form.phone_number_id}
                  onChange={(e) => set("phone_number_id", e.target.value)}
                  placeholder="e.g. 123456789012345"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="token">Permanent Access Token *</Label>
                <Input
                  id="token"
                  type="password"
                  value={form.access_token}
                  onChange={(e) => set("access_token", e.target.value)}
                  placeholder="EAA..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="waba">WABA ID (optional)</Label>
                  <Input
                    id="waba"
                    value={form.waba_id}
                    onChange={(e) => set("waba_id", e.target.value)}
                    placeholder="1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Display phone (optional)</Label>
                  <Input
                    id="phone"
                    value={form.display_phone}
                    onChange={(e) => set("display_phone", e.target.value)}
                    placeholder="+91 98xxxxxxxx"
                  />
                </div>
              </div>
              <Button
                onClick={() => {
                  setConnecting(true);
                  connectMut.mutate();
                }}
                disabled={!form.phone_number_id || !form.access_token || connecting}
              >
                {connecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquare className="mr-2 h-4 w-4" />
                )}
                Connect WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connected details */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Webhook Setup</CardTitle>
            <CardDescription>
              Paste this URL in your Meta Dashboard to receive messages.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Webhook Callback URL</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs break-all">
                  {webhookUrl}
                </code>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(webhookUrl)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {conn?.webhook_verify_token && (
              <div className="space-y-2">
                <Label>Verify Token</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs">
                    {conn.webhook_verify_token}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(conn.webhook_verify_token!)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use this as the "Verify Token" in Meta Dashboard → WhatsApp → Webhook
                  configuration.
                </p>
              </div>
            )}
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <strong>Important:</strong> Your webhook must be served over HTTPS. The URL is your
              production domain. In development, use the Lovable preview URL.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
