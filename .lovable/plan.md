# Plan: Real secrets + finish Sarthi MVP

## Important security note first

You pasted the WhatsApp App Secret in chat. Chat messages are stored — please **regenerate the App Secret in Meta → App Settings → Basic → Show → Reset** before going live, then give me the fresh value via the secure secret form (never paste secrets in chat). I'll request it through the secure `add_secret` form, not as plain text.

## Step 1 — Secrets (secure form, no chat values)

I'll trigger secret prompts for:

- `WHATSAPP_APP_ID` (you said 2725996624443080 — please re-enter in the form)
- `WHATSAPP_APP_SECRET` (regenerated value)
- `WHATSAPP_VERIFY_TOKEN` (any random string; used for Meta webhook verification fallback — current per-business token in DB also works)
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (only if you want to enable payments now; otherwise skip)

The webhook code already reads `WHATSAPP_APP_SECRET` from env and rejects mock values, so once the secret is set, signature verification turns on automatically — no code change needed for that switch.

## Step 2 — Audit current state

Read everything that's been added since Phase 2 (agent.server.ts, all `_authenticated/*` routes, all `lib/api/*.functions.ts`, webhook routes) and confirm:

- routes registered in `routeTree.gen.ts`
- server fns use `requireSupabaseAuth` where needed
- `attachSupabaseAuth` middleware registered in `src/start.ts`
- no `client.server` imports at module scope of `.functions.ts`
- RLS + GRANT correct on all tables

Fix anything broken before adding new code.

## Step 3 — Phases remaining (per original plan)


| Phase | Scope                                                                                         |
| ----- | --------------------------------------------------------------------------------------------- |
| 3     | Catalog upload (CSV/XLSX) + Gemini embeddings + pgvector search — verify and finish           |
| 4     | WhatsApp connect UI + webhook (signatures live once secret is set) — verify end-to-end        |
| 5     | Sarthi agent ReAct loop via Lovable AI Gateway (gemini-3-flash-preview) + playground — verify |
| 6     | Inbox / Escalations / Orders UI with "Take over" + correction capture — verify                |
| 7     | Razorpay UPI link + webhook (only if Razorpay secrets provided)                               |
| 8     | Analytics dashboard (Recharts, 7d/30d)                                                        |


For each phase: read existing files, fill gaps, smoke-test via `invoke-server-function` + browser preview, then move on.

## Step 4 — Verification before handoff

- Build passes (auto by harness)
- Webhook GET verify returns challenge for a configured connection
- Webhook POST with a fake signature is rejected (proves real secret is loaded)
- Sending a test WhatsApp message produces an agent reply
- Inbox shows the conversation; "Take over" disables agent
- Landing page + auth + onboarding flow still work

## Decisions I need from you

1. **Razorpay now or later?** If later, I'll skip Phase 7 wiring and leave the route stub.
2. **Confirm: regenerate App Secret before I store it?** (Strongly recommended.)
3. Anything you changed manually I should preserve as-is? (I'll diff against my last-known state and ask before overwriting.)

Reply with answers (or just "go") and I'll switch to build mode, request the secrets via the secure form, and start with Step 2 audit. razorpay later, 