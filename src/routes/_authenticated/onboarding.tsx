import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [{ title: "Set up Sarthi · Onboarding" }, { name: "robots", content: "noindex" }],
  }),
  component: Onboarding,
});

type Form = {
  name: string;
  category: string;
  language: string;
  brand_voice: string;
  upi_id: string;
  phone: string;
  full_name: string;
};

const CATEGORIES = [
  "Kirana / Grocery",
  "D2C brand",
  "Fashion / Apparel",
  "Beauty & Wellness",
  "Coaching / Education",
  "Clinic / Healthcare",
  "Restaurant / Cloud kitchen",
  "Services",
  "Other",
];

function Onboarding() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Form>({
    name: "",
    category: "",
    language: "hinglish",
    brand_voice: "",
    upi_id: "",
    phone: "",
    full_name: (user.user_metadata?.full_name as string) ?? "",
  });

  // If they already have a business, send to dashboard.
  useQuery({
    queryKey: ["onboarding-check", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (data?.id) {
        navigate({ to: "/dashboard", replace: true });
      }
      return data;
    },
  });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const steps = [
    {
      title: "Tell us about you",
      description: "We use this to personalise Sarthi and your dashboard.",
      valid: form.full_name.trim().length > 1,
      body: (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Your name</Label>
            <Input
              id="full_name"
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              placeholder="Priya Sharma"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">WhatsApp number (optional for now)</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+91 98xxxxxxxx"
            />
          </div>
        </div>
      ),
    },
    {
      title: "What's your business?",
      description: "Sarthi adapts replies to your category and language.",
      valid: form.name.trim().length > 1 && !!form.category,
      body: (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Business name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Sharma Saree House"
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reply language</Label>
            <Select value={form.language} onValueChange={(v) => set("language", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hinglish">Hinglish (default)</SelectItem>
                <SelectItem value="hindi">Hindi</SelectItem>
                <SelectItem value="english">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ),
    },
    {
      title: "Teach Sarthi your voice",
      description: "A short description so Sarthi sounds like you, not a bot.",
      valid: true,
      body: (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brand_voice">Brand voice (optional)</Label>
            <Textarea
              id="brand_voice"
              rows={5}
              value={form.brand_voice}
              onChange={(e) => set("brand_voice", e.target.value)}
              placeholder="Friendly, polite, uses 'ji' and 'bhaiya'. Always confirms order before sharing UPI."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="upi_id">UPI ID for payments (optional)</Label>
            <Input
              id="upi_id"
              value={form.upi_id}
              onChange={(e) => set("upi_id", e.target.value)}
              placeholder="yourname@okhdfcbank"
            />
          </div>
        </div>
      ),
    },
  ];

  const current = steps[step];
  const last = step === steps.length - 1;

  const finish = async () => {
    setSaving(true);
    try {
      const { error: pErr } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: form.full_name || null,
        phone: form.phone || null,
        onboarded: true,
      });
      if (pErr) throw pErr;

      const { error: bErr } = await supabase.from("businesses").insert({
        owner_id: user.id,
        name: form.name,
        category: form.category,
        language: form.language,
        brand_voice: form.brand_voice || null,
        upi_id: form.upi_id || null,
      });
      if (bErr) throw bErr;

      await qc.invalidateQueries();
      toast.success("All set! Welcome to Sarthi.");
      navigate({ to: "/dashboard", replace: true });
    } catch (e: any) {
      toast.error(e.message ?? "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-2xl flex-col px-6 py-10">
        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-display font-bold">
            स
          </div>
          <span className="font-display text-lg font-semibold">Sarthi</span>
        </div>

        <div className="mb-6 flex items-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Step {step + 1} of {steps.length}
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold">{current.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{current.description}</p>

          <div className="mt-6">{current.body}</div>

          <div className="mt-8 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || saving}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            {last ? (
              <Button onClick={finish} disabled={!current.valid || saving}>
                {saving ? (
                  "Saving..."
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" /> Finish
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!current.valid}>
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          You can change all of this later in Settings.
        </p>
      </div>
    </div>
  );
}
