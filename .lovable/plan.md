
# Sarthi AI — MVP Build Plan

A WhatsApp-native AI employee for Indian small businesses. We'll build the full MVP in phased milestones so the app is usable end-of-each-phase, not just at the finish line.

## Stack (Lovable-native adaptations of the PRD)

- TanStack Start (React 19, Vite 7, Tailwind v4, shadcn) — instead of Next.js
- Lovable Cloud (Supabase under the hood) — Postgres + pgvector + Auth + Storage
- Lovable AI Gateway — Gemini 3 Flash for Sarthi's brain (cheap, fast, Hinglish-strong), Gemini embedding-001 for catalog search
- Server functions (`createServerFn`) for app logic; `/api/public/*` server route for the Meta WhatsApp webhook (external caller)
- Razorpay for UPI link generation + payment status (secrets via Lovable secrets)
- Meta WhatsApp Cloud API (direct, no BSP) — secrets per business

> Swaps vs PRD: Next.js → TanStack Start, Clerk → Lovable Cloud Auth (email/pwd + Google), Pinecone → pgvector, Claude/Groq → Lovable AI Gateway (Gemini). Same product, same prompt v0.1, Lovable-native plumbing.

---

## Phase 1 — Marketing site + Auth + Dashboard shell

**Goal:** Visitors can land, sign up, and see an empty dashboard.

- Landing page (`/`): hero ("Hire your best employee for ₹799/month"), problem, how Sarthi works (3 steps), features, pricing tiers (₹499 / ₹999 / ₹2499), FAQ, CTA. Indian-commerce visual direction (warm, confident, not generic SaaS blue/purple). Custom design tokens in `styles.css`.
- SEO per route: unique `<title>`, meta description, OG tags.
- `/auth` page: email/password + Google sign-in (via Lovable Cloud auth broker).
- `_authenticated/` layout (integration-managed).
- `_authenticated/dashboard` shell with sidebar nav: Inbox, Catalog, Customers, Orders, Analytics, Settings.
- Enable Lovable Cloud.

## Phase 2 — Database schema + Business onboarding

**Goal:** Merchant can create a business profile, define tone & policies.

- Migration: tables per PRD (with role separation — keep `user_roles` table; never put roles on profiles). Adapted to Lovable Cloud conventions:
  - `profiles`, `user_roles` (enum `app_role`), `has_role()` SECURITY DEFINER fn
  - `businesses`, `whatsapp_connections`, `customers`, `products` (with `vector(768)` embedding for Gemini), `conversations`, `messages`, `orders`, `agent_corrections`, `escalations`
  - GRANTs to `authenticated` + `service_role`, RLS scoped via `business_id` ownership through `businesses.user_id = auth.uid()`
  - Enable `pgvector`, HNSW index on `products.embedding`
- Onboarding wizard (`/_authenticated/onboarding`):
  1. Business name + type + WhatsApp number
  2. Tone examples (5–10 paste-in chats)
  3. Policies (return window, delivery days, default discount cap, COD allowed)
- Settings page to edit all of the above later.

## Phase 3 — Catalog

**Goal:** Merchant uploads catalog; products are searchable semantically.

- Catalog page: table view, add/edit/delete product.
- CSV/Excel upload server fn: parse → insert → embed (Gemini embedding-001) → store vector.
- Image upload to Lovable Cloud Storage (`product-images` bucket, public).
- `search_catalog(query)` server-only helper using pgvector cosine similarity.

## Phase 4 — WhatsApp Cloud API integration

**Goal:** Real WhatsApp messages flow in and out via the merchant's number.

- Settings → WhatsApp tab: merchant pastes Meta App ID, Phone Number ID, Access Token, Webhook Verify Token. Stored encrypted in `whatsapp_connections`.
- Public server route `/api/public/whatsapp/webhook` (TSS server route, no auth on `/api/public/*`):
  - `GET` — Meta hub challenge verification
  - `POST` — verify `X-Hub-Signature-256` HMAC against the business's app secret, parse message, resolve `business_id` from phone-number-id, upsert customer + conversation, insert inbound message, fire the agent (async)
- Outbound helper: `sendWhatsAppMessage(business_id, wa_id, text)` calling Meta Graph API.
- Stable webhook URL the merchant pastes into Meta: `https://project--<id>.lovable.app/api/public/whatsapp/webhook`.
- Setup guide rendered in-app with copy buttons.

## Phase 5 — Sarthi agent (the soul)

**Goal:** Sarthi v0.1 replies in Hinglish, grounded in catalog, with tool calls.

- `agent.server.ts` — ReAct loop, max 3 tool steps:
  - System prompt = PRD v0.1, with `{{BUSINESS_NAME}}`, `{{TONE_EXAMPLES}}`, `{{CATALOG_SUMMARY}}`, `{{OFFERS_AND_POLICIES}}`, `{{CURRENT_DATE}}`, `{{CUSTOMER_WA_ID}}` injected.
  - Model: `google/gemini-3-flash-preview` via Lovable AI Gateway, using AI SDK `streamText`/`generateText` with `tool()` + Zod schemas (NOT the XML format from the PRD — function calling is more reliable; the system prompt is adapted accordingly).
  - Tools: `search_catalog`, `get_customer_history`, `create_draft_order`, `generate_upi_link`, `check_payment_status`, `record_order`, `save_customer_memory`, `escalate_to_human`.
- Confidence scoring: a second small LLM judgment pass; <87% → silent escalation.
- Anti-spam guard: max 2 consecutive outbound messages without an inbound reply.
- Every inbound webhook → agent run → either WhatsApp outbound + log, or escalation row.
- **Agent playground** at `/_authenticated/playground` — chat with Sarthi without WhatsApp, for testing during setup and pitching.

## Phase 6 — Inbox, Escalations, Orders

**Goal:** Merchant can monitor conversations, take over, see orders.

- Inbox page: list of conversations (last message, customer name, AI/escalated badge); detail view shows full thread, customer memory side-panel, "Take over" button (pauses Sarthi for this conversation), reply box for manual messages.
- Escalation queue page: pending escalations with Sarthi's `suggested_reply` and `reason`; one-tap Approve & Send / Edit & Send / Handle Myself.
- Orders page: list, status, payment status (re-checks Razorpay on click).
- Correction capture: when merchant edits Sarthi's reply, save to `agent_corrections` (future fine-tuning moat).

## Phase 7 — Payments (Razorpay UPI)

**Goal:** Sarthi can collect money.

- `generate_upi_link` tool → Razorpay Payment Link API.
- `check_payment_status` tool → Razorpay Order/Payment fetch.
- Razorpay webhook at `/api/public/razorpay/webhook` (HMAC verified) → updates `orders.status` → triggers Sarthi confirmation message.

## Phase 8 — Analytics dashboard

**Goal:** Merchant sees value.

- Metrics over 7d/30d: conversations handled, automation rate, escalation rate, orders influenced, revenue influenced, estimated hours saved (= AI message count × 30s).
- Simple charts (Recharts), already in shadcn.

---

## Secrets needed (will request via secret tool when each phase begins)

- Phase 4: `WHATSAPP_APP_SECRET` (per-business or shared — single-tenant first; PRD allows manual per-business setup)
- Phase 7: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- AI Gateway: `LOVABLE_API_KEY` auto-provisioned with Lovable Cloud — no user action.

## Out of scope for MVP (per PRD)

- Voice messages, multi-user team inbox, fine-tuning pipeline, regional languages beyond prompt-level Hinglish, billing/Stripe subscriptions (pricing is shown on the landing page only).

## What I'll build first this turn (Phase 1)

1. Enable Lovable Cloud.
2. Design tokens in `src/styles.css` (warm cream + deep indigo + saffron accent — Indian commerce, not generic SaaS).
3. Landing page at `/` with all sections + SEO.
4. `/auth` page with email/password + Google sign-in.
5. `_authenticated/` layout + `_authenticated/dashboard` empty shell with sidebar.
6. `onAuthStateChange` listener in `__root.tsx`.

Subsequent phases land in their own turns so you can review and steer.

Ready to start with Phase 1?
