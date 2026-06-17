import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MessageCircle,
  Sparkles,
  ShieldCheck,
  IndianRupee,
  Languages,
  Clock,
  Workflow,
  Check,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sarthi AI — Hire your best employee for ₹799/month" },
      {
        name: "description",
        content:
          "Sarthi is an AI employee that lives inside your WhatsApp Business number. It sells your catalog, answers in Hinglish, collects UPI payments, and escalates only when you're needed.",
      },
      { property: "og:title", content: "Sarthi AI — Your AI employee on WhatsApp" },
      {
        property: "og:description",
        content:
          "Stop drowning in WhatsApp chats. Sarthi handles 80% of customer conversations so you can run your business.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <Hero />
        <Problem />
        <How />
        <Features />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <Logo />
          <span className="font-display text-lg font-semibold">Sarthi</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          <a href="#how" className="hover:text-foreground">
            How it works
          </a>
          <a href="#features" className="hover:text-foreground">
            Features
          </a>
          <a href="#pricing" className="hover:text-foreground">
            Pricing
          </a>
          <a href="#faq" className="hover:text-foreground">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link to="/auth">
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              Start free
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-card">
      <span className="font-display text-base font-bold">स</span>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-paper-grain">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-saffron" />
            Made for Indian commerce
          </div>
          <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-balance md:text-6xl">
            Hire your best employee for{" "}
            <span className="relative whitespace-nowrap">
              <span className="relative z-10">₹799/month.</span>
              <span className="absolute inset-x-0 bottom-1 -z-0 h-3 bg-saffron/60" />
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Sarthi is an AI employee that lives inside your WhatsApp Business number. It chats in
            Hinglish, knows your catalog, sends UPI payment links, and handles 80% of customer
            messages — so you can actually run your business.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                Start free — 10 min setup
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a href="#how">
              <Button size="lg" variant="outline">
                See how it works
              </Button>
            </a>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Official Meta WhatsApp API · No ban risk · Cancel anytime
          </p>
        </div>

        <div className="relative">
          <PhoneMock />
        </div>
      </div>
    </section>
  );
}

function PhoneMock() {
  const messages: Array<{ from: "c" | "s"; text: string }> = [
    { from: "c", text: "Bhaiya woh blue kurta dikhao na" },
    {
      from: "s",
      text: "Ji sir, blue kurta ₹1299 mein hai. Size M aur L available. Photo bhej raha hoon 📸",
    },
    { from: "c", text: "2 kurta aur 1 legging chahiye. Kitna hoga?" },
    {
      from: "s",
      text: "Total ₹2870 ka order ban raha hai. UPI link bhej raha hoon — payment ho jaye to aaj hi pack karwa deta hoon ✅",
    },
    { from: "c", text: "Payment kar diya 🙏" },
    { from: "s", text: "Thank you ji! Order ID #ORD-39481 confirm. Kal delivery ho jayega." },
  ];
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="absolute -inset-4 -z-10 rounded-[3rem] bg-gradient-to-br from-saffron/40 via-transparent to-primary/30 blur-2xl" />
      <div className="rounded-[2.5rem] border-8 border-foreground/90 bg-card shadow-glow">
        <div className="flex items-center gap-3 rounded-t-[1.5rem] bg-primary px-4 py-3 text-primary-foreground">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-saffron text-saffron-foreground font-display font-bold">
            S
          </div>
          <div>
            <div className="text-sm font-semibold">Sharma General Store</div>
            <div className="text-[10px] text-primary-foreground/70">
              online · Sarthi AI replying
            </div>
          </div>
        </div>
        <div className="space-y-2 bg-[oklch(0.96_0.03_85)] p-4 text-sm">
          {messages.map((m, i) => (
            <div key={i} className={m.from === "c" ? "flex justify-start" : "flex justify-end"}>
              <div
                className={
                  m.from === "c"
                    ? "max-w-[80%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-foreground shadow-sm"
                    : "max-w-[80%] rounded-2xl rounded-tr-sm bg-[oklch(0.88_0.12_145)] px-3 py-2 text-foreground shadow-sm"
                }
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Problem() {
  return (
    <section className="border-y border-border bg-card">
      <div className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl text-balance">
          WhatsApp is your storefront. <br className="hidden md:block" />
          But it's also eating your day.
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          200+ messages a day. "Bhaiya price?", "Kal milega na?", payment reminders, photo requests.
          Every reply is a context switch. Sarthi handles the repetitive 80% — and only pings you
          when your judgement is actually needed.
        </p>
      </div>
    </section>
  );
}

function How() {
  const steps = [
    {
      icon: Workflow,
      title: "Connect WhatsApp",
      body: "Link your official WhatsApp Business number. No new app for your customers — they message you exactly like before.",
    },
    {
      icon: Sparkles,
      title: "Upload catalog + tone",
      body: "CSV, Excel, or paste. Share 5–10 example chats so Sarthi learns to sound like you, not a robot.",
    },
    {
      icon: MessageCircle,
      title: "Sarthi takes over",
      body: "Customer messages → reply in <4 seconds in Hinglish. Products, prices, UPI links, order confirmations — handled.",
    },
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl px-6 py-24">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-saffron">How it works</p>
        <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight text-balance">
          Live in 10 minutes. Selling by lunch.
        </h2>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {steps.map((s, i) => (
          <div key={s.title} className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="h-5 w-5" />
              </div>
              <div className="font-display text-sm font-semibold text-muted-foreground">
                Step {i + 1}
              </div>
            </div>
            <h3 className="mt-4 font-display text-xl font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: Languages,
      title: "Hinglish, naturally",
      body: "Code-switches like a real Indian employee. Hindi, English, regional cues — never robotic.",
    },
    {
      icon: IndianRupee,
      title: "UPI payments inline",
      body: "Generates Razorpay UPI links, checks payment status, confirms orders — all in chat.",
    },
    {
      icon: ShieldCheck,
      title: "Grounded, not guessing",
      body: "Never invents prices or stock. Every reply is checked against your live catalog.",
    },
    {
      icon: Clock,
      title: "Replies in <4 seconds",
      body: "Customers never wait. Conversion goes up because nobody bounces to a competitor.",
    },
    {
      icon: MessageCircle,
      title: "Perfect handoff",
      body: "One-tap 'Take over'. Sarthi summarises the conversation so you ramp in seconds.",
    },
    {
      icon: Sparkles,
      title: "Learns from your corrections",
      body: "Every edit you make trains your private Sarthi. The longer you use it, the better it gets.",
    },
  ];
  return (
    <section id="features" className="border-y border-border bg-card">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-saffron">Features</p>
          <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight text-balance">
            Built for the way India actually sells.
          </h2>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-background p-6">
              <f.icon className="h-6 w-6 text-saffron" />
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const tiers = [
    {
      name: "Starter",
      price: "₹499",
      tag: "Try Sarthi out",
      features: [
        "500 conversations / month",
        "1 WhatsApp number",
        "Catalog & UPI links",
        "Basic analytics",
      ],
    },
    {
      name: "Pro",
      price: "₹999",
      tag: "Most businesses",
      features: [
        "2,000 conversations / month",
        "Conversation memory (30 days)",
        "Custom tone training",
        "Full analytics dashboard",
      ],
      featured: true,
    },
    {
      name: "Business",
      price: "₹2,499",
      tag: "Multi-staff teams",
      features: [
        "Unlimited conversations",
        "Team inbox",
        "Custom tone fine-tuning",
        "Priority support",
      ],
    },
  ];
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-24">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-saffron">Pricing</p>
        <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight text-balance">
          Costs less than a chai-break employee.
        </h2>
        <p className="mt-3 text-muted-foreground">Transparent. No setup fees. Cancel anytime.</p>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={
              t.featured
                ? "relative rounded-2xl border-2 border-primary bg-card p-7 shadow-glow"
                : "rounded-2xl border border-border bg-card p-7"
            }
          >
            {t.featured && (
              <div className="absolute -top-3 left-7 rounded-full bg-saffron px-3 py-1 text-xs font-semibold text-saffron-foreground">
                Most popular
              </div>
            )}
            <div className="text-sm font-medium text-muted-foreground">{t.tag}</div>
            <div className="mt-1 font-display text-2xl font-semibold">{t.name}</div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="font-display text-4xl font-semibold">{t.price}</span>
              <span className="text-sm text-muted-foreground">/ month</span>
            </div>
            <ul className="mt-6 space-y-3 text-sm">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link to="/auth" className="mt-7 block">
              <Button
                className={
                  t.featured
                    ? "w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    : "w-full"
                }
                variant={t.featured ? "default" : "outline"}
              >
                Start with {t.name}
              </Button>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

function FAQ() {
  const items = [
    {
      q: "Will my WhatsApp number get banned?",
      a: "No. Sarthi only works with the official Meta WhatsApp Cloud API on your verified Business number. Anti-spam guards are built in — never more than 2 unanswered outbound messages.",
    },
    {
      q: "Does Sarthi work in Hindi and regional languages?",
      a: "Hinglish is the default and works beautifully. Hindi, Tamil, Bengali, Telugu, and Marathi are supported via prompting. More regional fine-tuning is on the roadmap.",
    },
    {
      q: "What if Sarthi gets something wrong?",
      a: "Every reply is confidence-scored. Anything below 87% is silently sent to you for approval before going out. You can also 'Take over' any conversation in one tap.",
    },
    {
      q: "How long does setup take?",
      a: "About 10 minutes. Connect your WhatsApp Business API, upload catalog (CSV/Excel), paste 5–10 example chats. Done.",
    },
    {
      q: "Do my customers know they're talking to AI?",
      a: "If asked, Sarthi will always disclose: 'Main Sarthi hoon, aapke business ki AI assistant ji.' Otherwise the conversation feels like your best human employee.",
    },
  ];
  return (
    <section id="faq" className="border-t border-border bg-card">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <p className="text-center text-sm font-semibold uppercase tracking-wide text-saffron">
          FAQ
        </p>
        <h2 className="mt-2 text-center font-display text-4xl font-semibold tracking-tight">
          Questions, answered.
        </h2>
        <Accordion type="single" collapsible className="mt-10">
          {items.map((it, i) => (
            <AccordionItem key={i} value={`i${i}`}>
              <AccordionTrigger className="text-left font-medium">{it.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{it.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24">
      <div className="overflow-hidden rounded-3xl bg-primary px-10 py-16 text-center text-primary-foreground shadow-glow">
        <h2 className="font-display text-4xl font-semibold tracking-tight text-balance">
          Get your evenings back.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
          Sarthi is live in 10 minutes. Your customers won't know it isn't a human. You'll know —
          because you're finally free.
        </p>
        <Link to="/auth" className="mt-8 inline-block">
          <Button size="lg" className="bg-saffron text-saffron-foreground hover:bg-saffron/90">
            Start free
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-muted-foreground md:flex-row">
        <div className="flex items-center gap-2">
          <Logo />
          <span>© 2026 Sarthi AI · Made in India</span>
        </div>
        <div className="flex gap-6">
          <a href="#features" className="hover:text-foreground">
            Features
          </a>
          <a href="#pricing" className="hover:text-foreground">
            Pricing
          </a>
          <Link to="/auth" className="hover:text-foreground">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
