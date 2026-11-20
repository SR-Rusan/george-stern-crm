# Lead Qualification & Advisory CRM

A rebrandable, AI-assisted lead qualification CRM for coaching, training and advisory businesses (first client: **"George Stern Leadership"**).

**Multi-client:** each client is one profile file in [`clients/`](clients/). To add a client, fill in [`CLIENT_INTAKE.md`](CLIENT_INTAKE.md), copy `clients/_template.ts`, then `npm run use-client -- <id>`. Full procedure: [`CLAUDE.md`](CLAUDE.md).

It captures public inquiries, qualifies them with **OpenRouter** (or a labelled deterministic mock when no API key is set), computes a transparent **0–8 priority score** in code, keeps **AI suggestions** separate from **human decisions**, and manages leads from **New Inquiry** to **Won / Lost / Not a Fit**. Follow-up emails are drafted for the coach to approve and send through **Resend**.

---

## 1. Run it locally (demo mode, no setup)

```bash
npm install
npm run dev
```

- Operator workspace: `http://localhost:3000`
- Public inquiry form: `http://localhost:3000/inquire`

With no environment variables the app runs as an **open local demo**: no login, data in `.data/db.json` seeded with 8 fictional leads, mock AI qualifier, and draft-only email.

## 2. Tests and production build

```bash
npm test        # 36 tests: scoring, AI validation, auth, sessions, Postgres storage, email, webhooks
npm run build   # type-check + production build
```

The Postgres tests run against an in-process Postgres (PGlite) over the real wire protocol, so no database server is needed.

---

## 3. Deploying for a client (Vercel + Supabase)

Production (`NODE_ENV=production`) **fails closed**: without a database and login config, the operator workspace is locked (HTTP 503) and nothing is stored. The public inquiry form shows an error instead of silently losing leads.

1. **Database.** Create a Supabase project (or any Postgres). Copy the **Transaction pooler** connection string (port 6543) into `DATABASE_URL`. The `crm_store` table is created automatically on first request; `supabase/migrations/002_crm_store_and_lockdown.sql` does the same explicitly and removes public API access.
2. **Operator login.** Run:
   ```bash
   npm run hash-password -- coach@theirdomain.com --with-secret
   ```
   Paste the printed `CRM_OPERATORS` and `SESSION_SECRET` into the host's environment variables. For several operators, join entries with commas.
3. **Email (optional).** Create a Resend account, verify the coach's sending domain (SPF + DKIM), then set `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`, `EMAIL_FROM_ADDRESS` and optionally `EMAIL_REPLY_TO`.
4. **AI (optional).** Set `OPENROUTER_API_KEY` (and `OPENROUTER_MODEL` if you want a different model).
5. **Client profile.** Set `CLIENT_ID` to the client's file in `clients/` (e.g. `george-stern`). Name, colour, services, form wording, emails and privacy link all come from that file; the client can adjust branding later in Settings.
6. **Demo tools.** Leave `ENABLE_DEMO_TOOLS` unset for real clients. Set it to `true` only on a sales-demo deployment (it shows Simulate / Reset Demo Data).
7. **Before go-live:** a fresh database starts empty. If you seeded demo data (`SEED_DEMO_DATA=true`), use **Remove Demo Leads** on the Overview tab.

All variables are documented in [`.env.example`](.env.example).

---

## 4. Security model

| Area | What it does |
| :--- | :--- |
| Operator login | Email + password (scrypt hashes in env), signed httpOnly `SameSite=Lax` session cookie, 7-day expiry. Login is rate-limited per IP and per email, with a generic error message. |
| Route protection | `middleware.ts` guards every page and API route except the public ones, **and** each operator API route checks the session itself, so protection doesn't depend on middleware alone. |
| Public routes | `/inquire`, `POST /api/inquiries`, `/api/public/branding` (name, colour, tagline only), `/login`, `/api/auth/*`, `/api/webhooks/make` (shared secret / HMAC). |
| CSRF | Cross-site POST/PUT/PATCH/DELETE to operator routes are rejected (Origin check) on top of `SameSite=Lax` cookies. |
| Storage | One versioned JSONB document in Postgres. Writes take a row lock (`SELECT … FOR UPDATE`), so concurrent requests queue instead of overwriting each other. RLS is enabled with no policies, so Supabase's public API can't read it. |
| Input limits | JSON bodies are size-capped (16 KB inquiry form, 32 KB webhook, 4 KB login); Zod validation on every write. |
| Email | Never sends without explicit human confirmation, recorded consent, a non-demo lead, and a verified sender. Provider failures are reported, never shown as "sent". |
| Headers | `X-Frame-Options: DENY`, `nosniff`, HSTS, strict referrer policy; `X-Powered-By` removed; pages are `noindex`. |

**Known limits (fine for a single coaching practice):**
- The whole dataset loads per request. That's comfortable up to a few thousand leads; beyond that, move to the relational tables in `001_initial_schema.sql`.
- Rate limits are in-memory per server instance, so on serverless hosting they're best-effort. Add Vercel Firewall or Upstash rate limiting for high-traffic forms.
- Operators are managed in env vars (no self-service password reset).

---

## 5. Service routes and priority scoring

Routes: `one_to_one_coaching`, `group_program`, `corporate_training`, `speaking`, `review` (Needs Review).

Priority score (`src/lib/scoring.ts`), clamped `0–8` (`0–2 Low`, `3–5 Medium`, `6–8 High`). Weights are editable in **Settings**:
- Timing **Now**: `+2`; **Within 3 months**: `+1`
- Requested service matches an active offer: `+2`
- Specific leadership challenge described: `+1`
- Corporate/team training with organisation or team size: `+2`
- **Forced to Needs Review:** missing required fields, corporate request without organisation and team size, AI confidence below `0.65`, or contradictory answers (e.g. *1:1 coaching, now* while describing a *500-person keynote next year*).

---

## 6. Make.com integration

**Outbound** (`MAKE_WEBHOOK_ENABLED=true` + `MAKE_WEBHOOK_URL`): `lead.created`, `lead.qualified`, `lead.stage_changed` events with headers `X-Idempotency-Key`, `X-Event-Type`, and `X-Webhook-Signature: sha256=<HMAC of body>`.

**Inbound:** `POST /api/webhooks/make` with `X-Webhook-Secret: <MAKE_WEBHOOK_SECRET>` or a valid `X-Webhook-Signature`. Suggested scenario: form trigger → filter on consent → HTTP POST to the CRM → Slack/email alert when `priority_score >= 6` or route is `review`.

Instagram DM ingestion is intentionally excluded until the account owner authorises Meta Business access and a reviewed consent flow exists.
