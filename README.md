# Unified AI CRM — Voice Calling + WhatsApp CRM SaaS

A production-ready SaaS platform combining:
- **AI Outbound Calling** — LiveKit + Sarvam/OpenAI voice agent (from voice-agent2)
- **WhatsApp CRM** — Shared inbox, contacts, pipelines, broadcasts, automations (from wacrm)
- **SaaS Layer** — Auth, multi-tenancy, subscription management, usage tracking

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Next.js 16 Frontend (port 3000)                     │
│  ┌──────────────────┐  ┌──────────────────┐          │
│  │  WhatsApp CRM    │  │  Voice Agent UI  │          │
│  │  - Inbox         │  │  - Dashboard     │          │
│  │  - Contacts      │  │  - Call Logs     │          │
│  │  - Pipelines     │  │  - Make a Call   │          │
│  │  - Broadcasts    │  │  - Agent Config  │          │
│  │  - Automations   │  │  - Analytics     │          │
│  └──────────────────┘  └──────────────────┘          │
│                    /api/voice/* proxy                 │
└─────────────────────────┬───────────────────────────┘
                          │ HTTP (internal)
┌─────────────────────────▼───────────────────────────┐
│  Python Voice Agent Microservice (port 8001)          │
│  - FastAPI REST API (api_server.py)                   │
│  - LiveKit Agent Worker (agent.py)                    │
│  - STT: Sarvam / Deepgram                            │
│  - TTS: Sarvam / ElevenLabs                          │
│  - LLM: OpenAI / Groq / Claude                       │
└─────────────────────────┬───────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────┐
│  Supabase (shared database)                           │
│  - WA tables: ai_accounts, ai_contacts, ai_conversations, …    │
│  - Voice tables: ai_call_logs, ai_call_transcripts, ai_active_calls │
│  - SaaS tables: ai_tenants, ai_subscriptions, ai_usage_logs   │
└─────────────────────────────────────────────────────┘
```

---

## Project Structure

```
unified-ai-crm/
├── frontend/           # Next.js 16 app
│   ├── src/app/
│   │   ├── (auth)/           # Login, Signup
│   │   ├── (dashboard)/      # All protected pages
│   │   │   ├── page.tsx      # Combined dashboard
│   │   │   ├── inbox/        # WhatsApp shared inbox
│   │   │   ├── contacts/     # Contact management
│   │   │   ├── pipelines/    # Kanban deal boards
│   │   │   ├── broadcasts/   # WA campaigns
│   │   │   ├── automations/  # No-code automations
│   │   │   ├── voice/        # Voice agent pages ← NEW
│   │   │   └── settings/     # All credentials
│   │   └── api/voice/        # Proxy to Python service
│   ├── src/lib/voice-api.ts  # Typed voice API client
│   └── src/components/       # UI components + sidebar
│
├── voice-agent/        # Python microservice
│   ├── agent.py        # LiveKit worker
│   ├── api_server.py   # FastAPI REST API
│   ├── db.py           # Supabase helpers
│   ├── notify.py       # Telegram notifications (booking requests, call summaries)
│   ├── configs/        # Per-tenant agent configs
│   └── supervisord.conf  # Runs both processes
│
├── supabase/migrations/
│   ├── 001_wacrm_schema.sql   # WhatsApp CRM tables
│   ├── 002_voice_schema.sql   # Voice agent tables
│   └── 003_saas_schema.sql    # Tenants, billing, usage
│
├── docker-compose.yml  # Full stack in one command
├── .env.example        # Combined env template
└── IMPLEMENTATION_PLAN.md  # Detailed build plan
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.11+
- Supabase project
- LiveKit Cloud account
- Vobiz SIP account

### 1. Clone and configure
```bash
git clone <your-fork>
cd unified-ai-crm
cp .env.example .env
# Edit .env with your credentials
```

### 2. Run database migrations
In your Supabase dashboard → SQL Editor, run each migration file in order:
```
supabase/migrations/001_wacrm_schema.sql
supabase/migrations/002_voice_schema.sql
supabase/migrations/003_saas_schema.sql
```

### 3. Start with Docker Compose (recommended)
```bash
docker compose up --build
```
- Frontend: http://localhost:3000
- Voice API: http://localhost:8001/voice/health

### 4. Or start manually

**Frontend:**
```bash
cd frontend
npm install
cp .env.local.example .env.local
# Edit .env.local
npm run dev
```

**Voice Agent:**
```bash
cd voice-agent
pip install -r requirements.txt
cp .env.example .env
# Edit .env

# Terminal 1 — API server
python api_server.py

# Terminal 2 — LiveKit agent worker
python agent.py start
```

---

## Features

### WhatsApp CRM
| Feature | Description |
|---|---|
| Shared Inbox | Multiple agents, one WhatsApp number |
| Contacts | Tags, custom fields, CSV import |
| Pipelines | Kanban boards for deal tracking |
| Broadcasts | Template campaigns with variable substitution |
| Automations | No-code trigger → action builder |

### AI Voice Agent
| Feature | Description |
|---|---|
| Outbound Calls | Dispatch AI calls via LiveKit + Vobiz SIP |
| Multi-language | Hindi, English, Telugu, Hinglish, auto-detect |
| STT | Sarvam Saaras v3 or Deepgram Nova-2 |
| TTS | Sarvam Bulbul v3 or ElevenLabs |
| LLM | OpenAI / Groq / Claude (configurable) |
| Booking | AI captures requested time/details mid-call → Telegram alert for manual confirmation (no external calendar) |
| Recordings | Stored to Supabase S3 |
| Analytics | Sentiment, cost, booking-request rate, calls/day |
| Call Transfer | Transfer to human agent mid-call |
| Notifications | Telegram alerts for booking requests + call summary |

### SaaS Layer
| Feature | Description |
|---|---|
| Auth | Supabase Auth (email/password) |
| Multi-tenancy | Tenant isolation via `tenant_id` + RLS |
| Plans | Free / Starter / Pro / Enterprise |
| Usage Tracking | Call minutes + WA messages per tenant/month |
| Settings UI | All credentials configurable via dashboard |

---

## Environment Variables

See `.env.example` for the full list. Required variables:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `ENCRYPTION_KEY` | 64-char hex key for WA token encryption |
| `META_APP_SECRET` | Meta App secret for webhook verification |
| `VOICE_AGENT_API_KEY` | Internal secret for Next.js → Python auth |
| `LIVEKIT_URL` | LiveKit project WSS URL |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Telegram bot for booking-request and call-summary alerts |
| `OPENAI_API_KEY` | OpenAI key (LLM) |
| `SARVAM_API_KEY` | Sarvam key (STT + TTS) |
| `VOBIZ_*` | Vobiz SIP credentials |

---

## Deployment

### Docker Compose (VPS/Cloud VM)
```bash
docker compose -f docker-compose.yml up -d
```

### Separate deploys
- **Frontend**: Deploy to Vercel / Hostinger Node.js (standard Next.js deploy)
- **Voice Agent**: Deploy to any Python-capable host (Railway, Render, DigitalOcean)
  - Set `VOICE_AGENT_URL` in frontend env to point to the Python service URL

### Scaling
- Frontend is stateless — scale horizontally
- Voice agent worker: run multiple `agent.py start` processes; LiveKit distributes jobs
- Database: Supabase handles scaling

---

## Roadmap

- [ ] Stripe billing integration (subscription checkout, webhooks)
- [ ] Onboarding wizard (post-signup credential setup)
- [ ] WhatsApp inbox real-time updates (Supabase Realtime)
- [ ] Call transcript viewer in UI
- [ ] Bulk call campaigns (CSV → dispatch queue)
- [ ] Mobile-responsive dashboard
- [ ] White-label / custom branding per tenant

---

## Credits

- WhatsApp CRM: [ArnasDon/wacrm](https://github.com/ArnasDon/wacrm)
- Voice Agent: [manyam0258/voice-agent2](https://github.com/manyam0258/voice-agent2)
