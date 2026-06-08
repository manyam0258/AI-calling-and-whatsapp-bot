# Unified AI Calling + WhatsApp CRM — SaaS Implementation Plan

## Executive Summary

Merge **voice-agent2** (Python LiveKit outbound calling agent) and **wacrm** (Next.js WhatsApp CRM) into a single, multi-tenant SaaS product. Strategy: use wacrm's Next.js app as the UI/frontend shell and run the Python voice agent as a Docker microservice. Both share one Supabase project.

---

## Source Repo Analysis

### voice-agent2 (Python backend, `master` branch)
| Aspect | Detail |
|---|---|
| Language | Python 3.9+ |
| Framework | FastAPI (`ui_server.py`) + LiveKit Agents (`agent.py`) |
| STT | Sarvam Saaras v3 / Deepgram Nova-2 |
| TTS | Sarvam Bulbul v3 / ElevenLabs Turbo |
| LLM | OpenAI / Groq / Claude (configurable per call) |
| DB | Supabase (`ai_call_logs`, `ai_call_transcripts`, `ai_active_calls`) |
| Notifications | Telegram bot |
| Booking | Captured as intent during the call → Telegram alert for manual confirmation (no external booking API) |
| SIP Provider | Vobiz (via LiveKit SIP trunk) |
| Recordings | Supabase S3 (`call-recordings` bucket) |
| Deployment | Docker + supervisord |
| Current UI | FastAPI serves a single HTML page dashboard |

**Key files:** `agent.py`, `ui_server.py`, `db.py`, `notify.py`, `make_call.py`, `config.json`

### wacrm (Next.js frontend, `main` branch)
| Aspect | Detail |
|---|---|
| Language | TypeScript |
| Framework | Next.js 16 (App Router), React 19, Tailwind v4 |
| DB/Auth | Supabase (Postgres + Auth + Storage + RLS) |
| WhatsApp | Meta Cloud API (official WhatsApp Business API) |
| Security | AES-256-GCM token encryption, HMAC webhooks, RLS, CSP |
| Features | Shared inbox, contacts, Kanban pipelines, broadcasts, automations, real-time dashboard |
| Deployment | Hostinger / any Node.js host |
| Themes | Multi-theme support (dark, light, custom) |

---

## Architecture Decision

```
┌─────────────────────────────────────────────────────────────────┐
│                    UNIFIED SAAS APP                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │         Next.js 16 Frontend + API Routes                │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │    │
│  │  │  WhatsApp CRM│  │  Voice Agent │  │  SaaS Layer  │  │    │
│  │  │  (wacrm)     │  │  Dashboard   │  │  (billing,   │  │    │
│  │  │  - Inbox     │  │  (new)       │  │   tenants,   │  │    │
│  │  │  - Contacts  │  │  - Config    │  │   settings)  │  │    │
│  │  │  - Pipelines │  │  - Call Logs │  │              │  │    │
│  │  │  - Broadcasts│  │  - Make Call │  │              │  │    │
│  │  │  - Automations│  │  - Analytics │  │              │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                    │
│                    ┌─────────▼────────┐                          │
│                    │  REST API Bridge  │                          │
│                    │  /api/voice/*     │                          │
│                    └─────────┬────────┘                          │
│                              │ HTTP                               │
│  ┌───────────────────────────▼─────────────────────────────┐    │
│  │         Python Voice Agent Microservice                   │    │
│  │         (FastAPI on port 8001)                            │    │
│  │   - make_call endpoint                                    │    │
│  │   - config CRUD                                           │    │
│  │   - LiveKit agent worker (background)                     │    │
│  └───────────────────────────┬─────────────────────────────┘    │
│                              │                                    │
│  ┌───────────────────────────▼─────────────────────────────┐    │
│  │              Shared Supabase Database                     │    │
│  │  WhatsApp tables + Voice Agent tables + Auth + Storage    │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
unified-saas/
├── frontend/                    ← Next.js app (from wacrm, extended)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/          ← login, signup, forgot-password
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx   ← sidebar + top nav
│   │   │   │   ├── page.tsx     ← home dashboard (combined stats)
│   │   │   │   ├── inbox/       ← WhatsApp shared inbox
│   │   │   │   ├── contacts/    ← contacts + tags
│   │   │   │   ├── pipelines/   ← Kanban deal boards
│   │   │   │   ├── broadcasts/  ← WA broadcast campaigns
│   │   │   │   ├── automations/ ← no-code automation builder
│   │   │   │   ├── voice/       ← NEW: voice agent section
│   │   │   │   │   ├── page.tsx      ← voice dashboard
│   │   │   │   │   ├── calls/        ← call logs + recordings
│   │   │   │   │   ├── make-call/    ← dispatch a call UI
│   │   │   │   │   ├── config/       ← agent config editor
│   │   │   │   │   └── analytics/    ← call analytics
│   │   │   │   └── settings/    ← WA + Voice + billing settings
│   │   │   └── api/
│   │   │       ├── webhooks/    ← WA webhook (existing)
│   │   │       ├── automations/ ← automation engine (existing)
│   │   │       └── voice/       ← NEW proxy to Python service
│   │   │           ├── make-call/route.ts
│   │   │           ├── calls/route.ts
│   │   │           ├── config/route.ts
│   │   │           └── analytics/route.ts
│   │   ├── components/
│   │   │   ├── voice/           ← NEW voice-specific components
│   │   │   │   ├── CallLogTable.tsx
│   │   │   │   ├── MakeCallForm.tsx
│   │   │   │   ├── AgentConfigForm.tsx
│   │   │   │   ├── CallAnalyticsChart.tsx
│   │   │   │   └── ActiveCallBadge.tsx
│   │   │   └── ...existing wacrm components
│   │   └── lib/
│   │       ├── voice-api.ts     ← typed client for /api/voice/*
│   │       └── ...existing wacrm lib
│   ├── .env.local.example
│   ├── package.json
│   └── next.config.ts
│
├── voice-agent/                  ← Python microservice (from voice-agent2)
│   ├── agent.py                  ← LiveKit agent worker (unchanged)
│   ├── api_server.py             ← NEW: FastAPI REST API for Next.js
│   ├── make_call.py
│   ├── db.py
│   ├── notify.py                 ← Telegram notifications (booking requests, call summaries)
│   ├── setup_trunk.py
│   ├── configs/                  ← per-tenant agent configs
│   │   └── default.json
│   ├── requirements.txt
│   └── .env.example
│
├── supabase/
│   ├── migrations/               ← combined migrations
│   │   ├── 001_wacrm_schema.sql  ← all wacrm tables
│   │   ├── 002_voice_schema.sql  ← call_logs, transcripts, active_calls
│   │   └── 003_saas_schema.sql   ← tenants, subscriptions, usage
│   └── seed.sql
│
├── docker-compose.yml            ← runs frontend + voice-agent + (optional) supabase
├── docker-compose.prod.yml
├── .env.example                  ← combined env template
└── README.md
```

---

## Phase-by-Phase Build Plan

### Phase 1 — Project Scaffold (Day 1)
1. Clone wacrm as base into `frontend/`
2. Create `voice-agent/` from voice-agent2 files
3. Create `supabase/migrations/` combining both SQL schemas
4. Set up `docker-compose.yml` for local dev

### Phase 2 — Voice Agent API Server (Day 1-2)
Create `voice-agent/api_server.py` — a FastAPI app exposing:
- `POST /voice/calls/dispatch` — trigger an outbound call
- `GET  /voice/calls` — list call logs (paginated)
- `GET  /voice/calls/{id}` — call detail + transcript
- `GET  /voice/calls/active` — active calls status
- `GET  /voice/analytics` — aggregated stats
- `GET  /voice/config` — read agent config
- `PUT  /voice/config` — update agent config
- `POST /voice/config/test` — test a config without a live call

Add `X-API-Key` header auth (token stored in Supabase, validated per-tenant).

### Phase 3 — Next.js Voice Section (Day 2-3)
Add these pages/routes to `frontend/src/app/(dashboard)/voice/`:
- **Dashboard page** — calls today, bookings today, avg duration, sentiment breakdown, active calls badge
- **Call Logs page** — table with search/filter, playback for recordings, transcript viewer
- **Make a Call page** — phone input, agent selector, one-click dispatch
- **Agent Config page** — form for all config.json fields (instructions, LLM, TTS, STT, etc.)
- **Analytics page** — charts: calls/day, sentiment over time, booking rate, cost

API proxy routes in `frontend/src/app/api/voice/` forward to the Python service with auth.

### Phase 4 — Unified Navigation & Dashboard (Day 3)
Update the wacrm sidebar to include the Voice section:
```
📱 Inbox
👥 Contacts
📊 Pipelines
📡 Broadcasts
⚙️ Automations
📞 Voice Calls  ← new section
  ├─ Dashboard
  ├─ Call Logs
  ├─ Make a Call
  ├─ Agent Config
  └─ Analytics
⚙️ Settings
```
Update the home dashboard to show a combined stats row (WA + voice metrics).

### Phase 5 — SaaS Multi-tenancy (Day 4)
1. **Tenant isolation**: Add `tenant_id` to all voice agent DB tables; enforce in Python service via Supabase RLS
2. **Auth**: Supabase Auth is already in wacrm — extend it to also protect the Python API (JWT validation)
3. **Onboarding flow**: Post-signup wizard collecting WA credentials + voice agent credentials
4. **Settings page**: WhatsApp Business API setup + LiveKit/Voice credentials per tenant
5. **Usage tracking**: Log call minutes and WA messages per tenant (for billing)

### Phase 6 — Billing Hooks (Day 4-5)
- Add a `subscriptions` table: `tenant_id`, `plan` (free/starter/pro), `call_minutes_used`, `wa_messages_used`
- Add `/settings/billing` page showing usage + upgrade CTA
- Stripe integration (optional at launch — can be stubbed with manual plan upgrades)

### Phase 7 — Docker & Deployment (Day 5)
```yaml
# docker-compose.yml (simplified)
services:
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    env_file: .env

  voice-agent:
    build: ./voice-agent
    ports: ["8001:8001"]
    env_file: .env
    command: supervisord -c supervisord.conf

  # Supabase is managed/hosted — not in compose
```

---

## Database Schema — Combined

### New / Modified Tables
```sql
-- SaaS layer
CREATE TABLE ai_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add tenant_id to wacrm tables (ai_accounts, ai_contacts, ai_conversations, etc.)
-- Add tenant_id to voice tables
ALTER TABLE ai_call_logs ADD COLUMN tenant_id UUID REFERENCES ai_tenants(id);
ALTER TABLE ai_active_calls ADD COLUMN tenant_id UUID REFERENCES ai_tenants(id);

-- Voice agent config per tenant
CREATE TABLE ai_voice_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES ai_tenants(id),
  config JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage
CREATE TABLE ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES ai_tenants(id),
  month TEXT NOT NULL,
  call_minutes INTEGER DEFAULT 0,
  wa_messages INTEGER DEFAULT 0
);
```

---

## Environment Variables — Combined

```bash
# ── Supabase (shared) ──────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# ── WhatsApp (wacrm) ───────────────────────────────────────────
ENCRYPTION_KEY=
META_APP_SECRET=
NEXT_PUBLIC_SITE_URL=

# ── Voice Agent (Python service) ───────────────────────────────
VOICE_AGENT_URL=http://voice-agent:8001
VOICE_AGENT_API_KEY=                    # internal secret

LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
OPENAI_API_KEY=
SARVAM_API_KEY=

# SIP
VOBIZ_SIP_DOMAIN=
VOBIZ_USERNAME=
VOBIZ_PASSWORD=
VOBIZ_OUTBOUND_NUMBER=

# Notifications
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Supabase S3 (recordings)
SUPABASE_S3_ACCESS_KEY=
SUPABASE_S3_SECRET_KEY=
SUPABASE_S3_ENDPOINT=
SUPABASE_S3_REGION=
```

---

## Technology Decisions

| Decision | Choice | Reason |
|---|---|---|
| Frontend base | wacrm (Next.js) | Already has Auth, Supabase, WhatsApp, full UI |
| Voice backend | voice-agent2 (Python) | LiveKit agents must run in Python |
| Communication | REST (Next.js → Python) | Simple, observable, easy to auth |
| Database | Single Supabase project | Both apps already use Supabase |
| Auth | Supabase Auth (wacrm) | Already implemented; extend to voice too |
| Billing | Stripe (Phase 6) | Standard SaaS billing |
| Deployment | Docker Compose | Both apps containerized |

---

## Feature Matrix — Combined SaaS

| Feature | Source | Status |
|---|---|---|
| WhatsApp shared inbox | wacrm | ✅ Existing |
| Contacts + tags + CSV | wacrm | ✅ Existing |
| Sales pipelines (Kanban) | wacrm | ✅ Existing |
| Broadcasts + templates | wacrm | ✅ Existing |
| No-code automations | wacrm | ✅ Existing |
| Real-time dashboard | wacrm | ✅ Existing |
| AI outbound calling | voice-agent2 | ✅ Existing |
| Multi-language STT/TTS | voice-agent2 | ✅ Existing |
| Call recordings | voice-agent2 | ✅ Existing |
| Caller memory | voice-agent2 | ✅ Existing |
| Call transcripts | voice-agent2 | ✅ Existing |
| Booking-intent capture (Telegram alert, manual confirm) | voice-agent2 | ✅ Existing |
| Telegram notifications | voice-agent2 | ✅ Existing |
| Voice agent config UI | NEW | 🔨 Build |
| Make-a-call UI | NEW | 🔨 Build |
| Call analytics dashboard | NEW | 🔨 Build |
| Unified navigation | NEW | 🔨 Build |
| Multi-tenancy | NEW | 🔨 Build |
| Billing/subscriptions | NEW | 🔨 Build |
| Onboarding wizard | NEW | 🔨 Build |

---

## Timeline

| Day | Tasks |
|---|---|
| Day 1 | Scaffold project, clone repos, combine docker-compose, DB migrations |
| Day 2 | Build `api_server.py` (Python REST API), wire up Next.js proxy routes |
| Day 3 | Build all voice/ pages in Next.js (dashboard, logs, make-call, config, analytics) |
| Day 4 | Unified sidebar/nav, combined home dashboard, settings page |
| Day 5 | Multi-tenancy (tenant_id, RLS), onboarding wizard |
| Day 6 | Billing hooks, Stripe stubs, usage tracking |
| Day 7 | Docker polish, 