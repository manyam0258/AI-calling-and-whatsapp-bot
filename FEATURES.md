# Complete Features List — Unified AI CRM SaaS

> AI Outbound Calling + WhatsApp CRM in one platform

---

## 1. Authentication & User Management

| Feature | Details |
|---|---|
| Email / Password Login | Supabase Auth — secure, built-in |
| User Registration | Self-serve signup with email verification |
| Session Management | Persistent sessions via Supabase SSR cookies |
| Protected Routes | Server-side auth check — redirects to login if unauthenticated |
| Password Reset | Supabase-powered reset email flow |
| Global Sign-Out | Invalidates all active sessions |

---

## 2. WhatsApp CRM — Shared Inbox

| Feature | Details |
|---|---|
| Shared Team Inbox | Multiple agents handle one WhatsApp Business number |
| Conversation Assignment | Assign conversations to specific team members |
| Conversation Status | Open / Resolved / Pending states |
| Unread Count Badge | Per-conversation unread message counter |
| Message History | Full message thread per contact |
| Inbound Message Handling | Meta Cloud API webhook — real-time message receipt |
| Outbound Messaging | Send text, templates, and media via WhatsApp API |
| Message Status Tracking | Sent → Delivered → Read tracking |
| Media Support | Images, documents, audio, video messages |
| Conversation Notes | Internal notes visible only to agents |
| Webhook Verification | HMAC-SHA256 signature verification on every inbound POST |

---

## 3. WhatsApp CRM — Contacts

| Feature | Details |
|---|---|
| Contact Database | Name, phone, email, custom fields |
| Tags | Unlimited tags per contact for segmentation |
| Custom Fields | Flexible JSONB custom fields per contact |
| CSV Import | Bulk import contacts from spreadsheet |
| Deduplication | Unique constraint on (account, phone) |
| Contact-Conversation Link | Conversations linked to contacts |
| Contact Search | Search by name, phone, email, tag |

---

## 4. WhatsApp CRM — Sales Pipelines

| Feature | Details |
|---|---|
| Kanban Boards | Visual deal pipeline with drag-and-drop stages |
| Multiple Pipelines | Create separate pipelines per product/team |
| Custom Stages | Define your own pipeline stages |
| Deal Cards | Title, value, assigned agent, linked contact |
| Deal-Conversation Link | Connect deals directly to WhatsApp conversations |
| Deal Assignment | Assign deals to team members |
| Deal Value Tracking | Numeric deal value per card |

---

## 5. WhatsApp CRM — Broadcasts

| Feature | Details |
|---|---|
| Template Campaigns | Send Meta-approved message templates to lists |
| Variable Substitution | Per-recipient variable replacement in templates |
| Delivery Tracking | Sent / Delivered / Read counts per campaign |
| Campaign Status | Draft → Scheduled → Running → Done |
| Recipient Filtering | Target by tag, segment, or custom filter |
| Scheduled Broadcasts | Schedule campaigns for future delivery |

---

## 6. WhatsApp CRM — Automations

| Feature | Details |
|---|---|
| No-Code Builder | Visual drag-and-drop automation builder |
| Triggers | Inbound message, new contact, keyword match, schedule, webhook |
| Actions | Send message, add tag, assign conversation, wait, webhook call |
| Conditional Branches | If/else logic in automation flows |
| Wait Steps | Time-based delays between automation steps |
| Cron Runner | Scheduled automation draining via cron endpoint |
| Active/Inactive Toggle | Enable/disable automations without deleting |

---

## 7. Voice Agent — Outbound Calling

| Feature | Details |
|---|---|
| AI Outbound Calls | Dispatch AI phone calls via LiveKit + Vobiz SIP trunk |
| Make a Call UI | One-click call dispatch from the dashboard |
| CLI Dispatch | `python make_call.py --to +91...` for scripted calls |
| Call Queue | LiveKit distributes jobs across agent workers |
| Rate Limiting | Max 5 calls/hour per phone number (configurable) |
| Auto-Greet | Configurable first line spoken when call connects |
| Turn Limit | Auto-wrap call after N conversation turns |
| Call Transfer | AI transfers to human agent mid-call (SIP transfer) |
| Call End Tool | AI can end call gracefully after task completion |

---

## 8. Voice Agent — AI Intelligence

| Feature | Details |
|---|---|
| Multi-LLM Support | OpenAI (GPT-4o, GPT-4o-mini), Groq (Llama), Claude (Haiku, Sonnet) |
| Short Response Enforcement | Max 120 tokens — keeps voice responses natural |
| Caller Memory | Loads last call summary for returning callers |
| IST Time Context | Injects current date/time into every prompt |
| Token Counter | Logs prompt token count, warns if >600 |
| Filler Word Filter | Drops "hmm", "yeah", "ok" etc. from transcripts |
| Echo Cancellation | Drops agent echo from user transcript |
| Sentiment Analysis | GPT-4o-mini classifies call as positive/neutral/negative/frustrated |

---

## 9. Voice Agent — Speech & Language

| Feature | Details |
|---|---|
| STT: Sarvam Saaras v3 | Indian language speech recognition (16kHz) |
| STT: Deepgram Nova-2 | Multilingual mode, high accuracy |
| TTS: Sarvam Bulbul v3 | Indian voices (24kHz), Kavya/Anushka/Arvind/Abhilash |
| TTS: ElevenLabs Turbo | Premium voice quality option |
| Language Presets | Multilingual / Hinglish / Hindi / English / Telugu |
| Auto Language Detection | STT `language=unknown` → auto-detects caller language |
| Language Instruction | Agent prompted to match caller's detected language |
| Noise Cancellation | LiveKit BVC noise cancellation (if available) |
| VAD Tuning | Configurable VAD threshold and silence duration |
| Endpointing Delay | Configurable STT min endpointing delay |

---

## 10. Voice Agent — Booking & Scheduling

| Feature | Details |
|---|---|
| Booking Intent Tool | AI captures caller's name, requested time, phone, and notes during the conversation |
| Manual-Confirmation Workflow | No external calendar API — captured requests are sent straight to the team via Telegram for follow-up and confirmation |
| Business Hours Tool | AI can tell callers if business is currently open |
| Booking-Request Logging | Each call log records whether a booking request was captured (`was_booked` flag) for analytics |

---

## 11. Voice Agent — Notifications

| Feature | Details |
|---|---|
| Booking Request Alert | Telegram message with caller name, phone, requested time, and notes — flagged "needs confirmation" |
| Call Ended — No Booking | Telegram summary with duration and call overview |
| Agent Error Alert | Telegram alert with stack trace for debugging |

---

## 12. Voice Agent — Recording & Transcription

| Feature | Details |
|---|---|
| Call Recording | LiveKit Egress records call audio to OGG format |
| Supabase S3 Storage | Recordings saved to `call-recordings` bucket |
| Recording URL | Direct playback URL stored in call log |
| Real-Time Transcript | User + assistant turns logged to `ai_call_transcripts` table during call |
| Post-Call Transcript | Full conversation transcript built from chat context and saved |
| Transcript Viewer | Call detail page shows full transcript (UI) |

---

## 13. Voice Agent — Analytics & Monitoring

| Feature | Details |
|---|---|
| Call Logs Table | Paginated table with search, filter, playback link |
| Call Detail View | Full call info + transcript lines |
| Analytics Dashboard | Total calls, bookings, booking rate, avg duration, cost |
| Sentiment Breakdown | Bar chart of positive/neutral/negative/frustrated |
| Calls Per Day Chart | Last 14-day call volume bar chart |
| Cost Estimation | Estimated STT + TTS + LLM cost per call and total |
| Active Calls Badge | Live indicator of in-progress calls |
| Interrupt Count | Tracks how many times caller interrupted agent |
| Call Metadata | Date, hour, day-of-week stored for time-series analysis |

---

## 14. Voice Agent — Configuration

| Feature | Details |
|---|---|
| Web Config Editor | Full agent config editable from UI (no file editing needed) |
| Per-Tenant Config | Separate config per organisation/tenant |
| Per-Phone Config | Override config for specific phone numbers |
| Agent Instructions | Full system prompt configurable from UI |
| First Line | Greeting message configurable from UI |
| LLM Provider/Model | Switch between OpenAI, Groq, Claude from UI |
| STT Provider | Switch between Sarvam and Deepgram from UI |
| TTS Provider/Voice | Switch provider and voice from UI |
| Language Preset | Set language mode from UI |
| Max Turns | Set auto-close turn limit from UI |
| Endpointing Delay | Tune STT sensitivity from UI |
| Config Masking | Secret fields shown as `***` in GET response |

---

## 15. Integrations

| Integration | Purpose |
|---|---|
| Supabase | Database (Postgres), Auth, Storage (S3), RLS |
| LiveKit Cloud | Real-time voice infrastructure, SIP, agent dispatch |
| Vobiz | SIP trunk for Indian phone network access |
| Meta Cloud API | Official WhatsApp Business API |
| OpenAI | LLM (GPT-4o-mini, GPT-4o) |
| Sarvam AI | Indian STT (Saaras v3) + TTS (Bulbul v3) |
| Deepgram | Multilingual STT (Nova-2) |
| ElevenLabs | Premium TTS voices |
| Groq | Fast LLM inference (Llama 3.3 70B) |
| Anthropic | Claude LLM support |
| Telegram | Booking-request + call summary notifications |
| n8n | Webhook trigger on call completion for workflow automation |
| Sentry | Error tracking for the voice agent worker |

---

## 16. SaaS Multi-Tenancy

| Feature | Details |
|---|---|
| Tenant Auto-Creation | Supabase trigger creates tenant on user signup |
| Tenant Isolation | All tables have `tenant_id`; RLS enforces per-tenant access |
| Team Members | Invite team members to a tenant with roles (owner/admin/member) |
| Plan Tiers | Free / Starter / Pro / Enterprise |
| Usage Tracking | Call minutes + WA messages tracked per tenant per month |
| Plan Limits Table | Configurable limits per plan in database |
| Subscription Table | Stripe-ready subscriptions table (customer ID, sub ID, status) |

---

## 17. Settings & Credentials

| Setting | Description |
|---|---|
| WhatsApp Access Token | Encrypted and stored per account |
| WhatsApp Phone Number ID | Per-account WA phone configuration |
| Meta App Secret | For webhook HMAC verification |
| LiveKit URL/Key/Secret | Voice infrastructure credentials |
| OpenAI / Sarvam API Keys | AI provider keys |
| Vobiz SIP Credentials | SIP domain, username, password, outbound number |
| Telegram Bot Token + Chat ID | Notification destination |
| Transfer Number | Human agent fallback for mid-call transfer |

---

## 18. Security

| Feature | Details |
|---|---|
| AES-256-GCM Encryption | WhatsApp access tokens encrypted at rest |
| HMAC-SHA256 Webhooks | Every Meta webhook POST signature verified |
| Row Level Security (RLS) | All Supabase tables enforce per-user/tenant data isolation |
| CSP Headers | Content Security Policy headers on all routes |
| X-Frame-Options: DENY | Clickjacking protection |
| X-Content-Type-Options | MIME sniffing protection |
| Internal API Key Auth | `X-API-Key` header required for Next.js → Python calls |
| Rate Limiting | Per-phone call rate limiting (5 calls/hour) |
| Service Role Isolation | Python agent uses service role key; frontend uses anon key |

---

## 19. Developer & Ops

| Feature | Details |
|---|---|
| Docker Compose | Single `docker compose up` starts full stack |
| Dockerfiles | Separate optimised Dockerfiles for frontend + voice agent |
| Supervisor | `supervisord` runs API server + agent worker in one container |
| Health Endpoints | `/voice/health` + `/api/health` for liveness checks |
| Sentry Integration | Error tracking for production agent worker |
| Env Template | `.env.example` with every variable documented |
| Per-Service Env | Separate `.env.example` files for frontend and voice-agent |
| SQL Migrations | 3 versioned migration files — run in order |
| Volume Persistence | Docker volumes for agent configs and logs |
| CLI Dispatch Tool | `make_call.py` for scripting calls from terminal |

---

## 20. Roadmap (Not Yet Built)

| Feature | Priority |
|---|---|
| Stripe billing checkout + webhooks | High |
| Post-signup onboarding wizard | High |
| WhatsApp inbox real-time updates (Supabase Realtime) | High |
| Bulk call campaigns (CSV → dispatch queue) | Medium |
| Call transcript viewer in UI | Medium |
| WhatsApp pipeline/broadcast full UI | Medium |
| Mobile-responsive layout | Medium |
| White-label / custom branding | Low |
| Inbound call handling | Low |
| Multi-language UI | Low |

---

**Total: 125+ distinct features across 20 categories**
