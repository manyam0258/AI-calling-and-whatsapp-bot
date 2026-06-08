# Deployment Guide — Unified AI CRM SaaS

This guide covers four deployment options, from local development to production.

---

## Prerequisites (All Options)

Before deploying, you need accounts on these services:

| Service | Purpose | URL |
|---|---|---|
| Supabase | Database + Auth + Storage | https://supabase.com |
| LiveKit Cloud | Voice infrastructure | https://cloud.livekit.io |
| Vobiz | Indian SIP trunk | https://vobiz.ai |
| Meta for Developers | WhatsApp Business API | https://developers.facebook.com |
| OpenAI | LLM | https://platform.openai.com |
| Sarvam AI | Indian STT + TTS | https://app.sarvam.ai |

---

## Step 1 — Supabase Setup

### 1.1 Create Project
1. Go to https://supabase.com → New Project
2. Choose a region close to your users (e.g. **ap-south-1** for India)
3. Save the **Project URL**, **Anon Key**, and **Service Role Key** — you'll need all three

### 1.2 Run Migrations
Go to **SQL Editor** in your Supabase dashboard and run each file **in order**:

```
-- Run this first:
supabase/migrations/001_wacrm_schema.sql

-- Then this:
supabase/migrations/002_voice_schema.sql

-- Then this:
supabase/migrations/003_saas_schema.sql
```

Paste the full content of each file and click **Run**.

### 1.3 Create Storage Bucket (Call Recordings)
1. Go to **Storage** → **New Bucket**
2. Name: `call-recordings`
3. Set to **Private**
4. Go to **Storage → Settings → S3 Access** → Generate S3 credentials
5. Save: Access Key, Secret Key, Endpoint URL

### 1.4 Generate Encryption Key (for WhatsApp tokens)
Run this in any terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Save the 64-character output — this is your `ENCRYPTION_KEY`.

---

## Step 2 — LiveKit Setup

1. Go to https://cloud.livekit.io → Create a Project
2. Copy: **Project URL** (starts with `wss://`), **API Key**, **API Secret**
3. Go to **SIP → Trunks → Create Outbound Trunk**:
   - Provider: Vobiz
   - SIP Server: `your-domain.sip.vobiz.ai`
   - Username + Password from your Vobiz account
4. Note the **Trunk ID** (starts with `ST_...`) — needed for `OUTBOUND_TRUNK_ID` if you hardcode it in agent.py

---

## Step 3 — WhatsApp Business API Setup

1. Go to https://developers.facebook.com → Create App → Business type
2. Add **WhatsApp** product
3. Go to **WhatsApp → API Setup**:
   - Note your **Phone Number ID**
   - Note your **WhatsApp Business Account ID**
   - Generate a **Permanent Access Token** (System User token recommended for production)
4. Go to **App Settings → Basic** → copy **App Secret**
5. **Configure Webhook**:
   - URL: `https://your-domain.com/api/webhooks/whatsapp`
   - Verify Token: any string you choose
   - Subscribe to: `messages`, `message_status`

---

## Step 4 — Fill Environment Variables

Copy `.env.example` to `.env` and fill in every value:

```bash
cp .env.example .env
nano .env   # or open in any editor
```

Key values to fill:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# WhatsApp
ENCRYPTION_KEY=<64-char hex from Step 1.4>
META_APP_SECRET=<from Step 3>

# Voice Agent internal secret (generate any random string)
VOICE_AGENT_API_KEY=<run: openssl rand -hex 32>

# LiveKit
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxx
LIVEKIT_API_SECRET=your_secret

# AI
OPENAI_API_KEY=sk-proj-...
SARVAM_API_KEY=sk_...

# SIP
VOBIZ_SIP_DOMAIN=your.sip.vobiz.ai
VOBIZ_USERNAME=your_user
VOBIZ_PASSWORD=your_pass
VOBIZ_OUTBOUND_NUMBER=+91XXXXXXXXXX
```

---

## Option A — Local Development

### A1. Start the Voice Agent (Python)

```bash
cd voice-agent

# Create virtual environment
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and fill env
cp .env.example .env
# Edit .env with your credentials

# Terminal 1 — API server (port 8001)
python api_server.py

# Terminal 2 — LiveKit agent worker
python agent.py start
```

### A2. Start the Frontend (Next.js)

```bash
cd frontend

# Install dependencies
npm install

# Copy and fill env
cp .env.local.example .env.local
# Edit .env.local
# Set: VOICE_AGENT_URL=http://localhost:8001

# Start dev server (port 3000)
npm run dev
```

Open http://localhost:3000 — sign up and start using the app.

### A3. Test a call
```bash
cd voice-agent
python make_call.py --to +91XXXXXXXXXX
```

---

## Option B — Docker Compose (VPS / Cloud VM)

This is the **recommended production approach** — runs everything with one command.

### Requirements
- Ubuntu 22.04+ VPS (DigitalOcean, Hetzner, AWS EC2, etc.)
- Minimum: 2 vCPU, 4GB RAM
- Domain name pointing to server IP
- Ports 80, 443, 3000, 8001 open in firewall

### B1. Install Docker
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

### B2. Clone and configure
```bash
git clone https://github.com/your-org/unified-ai-crm.git
cd unified-ai-crm
cp .env.example .env
nano .env   # fill in all values
```

### B3. Start the stack
```bash
docker compose up -d --build
```

Services:
- Frontend: http://your-server-ip:3000
- Voice API: http://your-server-ip:8001

### B4. View logs
```bash
# All services
docker compose logs -f

# Just frontend
docker compose logs -f frontend

# Just voice agent
docker compose logs -f voice-agent
```

### B5. Add HTTPS with Nginx + Certbot

Install Nginx:
```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

Create Nginx config:
```bash
sudo nano /etc/nginx/sites-available/aicrm
```

Paste:
```nginx
server {
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Voice API (internal — exposed only if needed)
    location /voice-api/ {
        proxy_pass http://localhost:8001/;
        proxy_set_header Host $host;
    }
}
```

Enable and get SSL:
```bash
sudo ln -s /etc/nginx/sites-available/aicrm /etc/nginx/sites-enabled/
sudo certbot --nginx -d your-domain.com
sudo systemctl reload nginx
```

Update `NEXT_PUBLIC_SITE_URL=https://your-domain.com` in `.env` and restart:
```bash
docker compose restart
```

### B6. Auto-restart on reboot
```bash
docker compose down
docker compose up -d
# Docker Compose services restart automatically by default (restart: unless-stopped)
```

---

## Option C — Separate Deploys (Vercel + Railway)

Best if you want managed hosting without managing a VPS.

### C1. Deploy Frontend to Vercel

```bash
cd frontend
npx vercel
```

Or connect the `frontend/` folder to Vercel via GitHub.

In Vercel dashboard → Environment Variables, add all variables from `frontend/.env.local.example` **plus**:
```
VOICE_AGENT_URL=https://your-railway-voice-agent.up.railway.app
VOICE_AGENT_API_KEY=your-secret
```

Set `NEXT_PUBLIC_SITE_URL=https://your-vercel-app.vercel.app`

### C2. Deploy Voice Agent to Railway

1. Go to https://railway.app → New Project → Deploy from GitHub
2. Point to the `voice-agent/` subfolder
3. Railway auto-detects the Dockerfile
4. Add all environment variables from `voice-agent/.env.example`
5. Add `PORT=8001`
6. Deploy — Railway gives you a public URL like `https://voice-agent-xxx.up.railway.app`

Copy this URL → set as `VOICE_AGENT_URL` in Vercel.

### C3. WhatsApp Webhook
Set your Meta webhook URL to:
```
https://your-vercel-app.vercel.app/api/webhooks/whatsapp
```

---

## Option D — Coolify (Self-Hosted PaaS)

Coolify is a self-hosted Heroku/Vercel alternative — good if you already have a VPS and want a UI to manage deployments.

### D1. Install Coolify
```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```
Access the Coolify UI at `http://your-server:8000`.

### D2. Add the project
1. Coolify → New Resource → Docker Compose
2. Point to your GitHub repo
3. Use the `docker-compose.yml` at the root
4. Add all environment variables in the Coolify UI

### D3. Configure domain
In Coolify → Domains → Add `your-domain.com` → Coolify handles Nginx + SSL automatically.

---

## Post-Deployment Checklist

After deploying, verify everything works:

```
[ ] Open https://your-domain.com — login page loads
[ ] Sign up with email → check Supabase Auth for new user
[ ] Check Supabase → Tables → ai_tenants → new row auto-created
[ ] Go to Settings → fill in WhatsApp credentials → Save
[ ] Go to Voice → Agent Config → verify defaults loaded
[ ] Go to Voice → Make a Call → enter your mobile number → Dispatch
[ ] Wait 10 seconds → check voice-agent logs → call should connect
[ ] Call ends → check Voice → Call Logs → entry appears
[ ] Check Telegram → booking-request/no-booking notification received
[ ] Go to Voice → Analytics → stats visible
[ ] Meta webhook → send a WhatsApp message to your business number → check Inbox
```

---

## Common Issues & Fixes

### Voice agent not dispatching calls
```bash
# Check agent worker is running
docker compose logs voice-agent | grep "registered worker"

# Check LiveKit credentials
docker compose exec voice-agent python -c "
import os; from dotenv import load_dotenv; load_dotenv()
print(os.getenv('LIVEKIT_URL'))
"
```

### Frontend can't reach voice agent
- Check `VOICE_AGENT_URL` is set correctly in frontend env
- For Docker: use `http://voice-agent:8001` (service name), not `localhost`
- For separate deploys: use the full Railway/Render URL

### Supabase RLS blocking inserts
- Voice agent must use **service role key** (`SUPABASE_KEY=your-service-role-key`)
- Frontend uses **anon key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- Never swap these

### WhatsApp webhook not receiving messages
- Verify Meta webhook URL is correct and publicly accessible
- Verify `META_APP_SECRET` matches the Meta App Secret exactly
- Check webhook subscriptions: must include `messages` and `message_status`
- Run `curl -X GET "https://your-domain.com/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=test"` — should return `test`

### Call recording fails
- Check Supabase S3 credentials (`SUPABASE_S3_*` vars)
- Ensure `call-recordings` bucket exists in Supabase Storage
- Ensure the bucket policy allows the service role to write

### Telegram notifications not sending
- Verify `TELEGRAM_BOT_TOKEN` — test with:
  ```bash
  curl "https://api.telegram.org/bot<TOKEN>/getMe"
  ```
- Verify `TELEGRAM_CHAT_ID` — send `/start` to your bot, then:
  ```bash
  curl "https://api.telegram.org/bot<TOKEN>/getUpdates"
  ```

---

## Updating the App

### Docker Compose
```bash
git pull
docker compose down
docker compose up -d --build
```

### Vercel (Frontend)
Push to main branch → Vercel auto-deploys.

### Railway (Voice Agent)
Push to main branch → Railway auto-deploys.

---

## Environment Variables — Quick Reference

| Variable | Where used | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Frontend + Voice Agent | ✅ |
| `ENCRYPTION_KEY` | Frontend (WA token encryption) | ✅ |
| `META_APP_SECRET` | Frontend (webhook HMAC) | ✅ |
| `NEXT_PUBLIC_SITE_URL` | Frontend | ✅ |
| `VOICE_AGENT_URL` | Frontend | ✅ |
| `VOICE_AGENT_API_KEY` | Frontend + Voice Agent | ✅ |
| `LIVEKIT_URL` | Voice Agent | ✅ |
| `LIVEKIT_API_KEY` | Voice Agent | ✅ |
| `LIVEKIT_API_SECRET` | Voice Agent | ✅ |
| `OPENAI_API_KEY` | Voice Agent | ✅ |
| `SARVAM_API_KEY` | Voice Agent | ✅ |
| `SUPABASE_URL` | Voice Agent | ✅ |
| `SUPABASE_KEY` | Voice Agent (service role) | ✅ |
| `VOBIZ_SIP_DOMAIN` | Voice Agent | ✅ |
| `VOBIZ_USERNAME` | Voice Agent | ✅ |
| `VOBIZ_PASSWORD` | Voice Agent | ✅ |
| `VOBIZ_OUTBOUND_NUMBER` | Voice Agent | ✅ |
| `TELEGRAM_BOT_TOKEN` | Voice Agent | Optional |
| `TELEGRAM_CHAT_ID` | Voice Agent | Optional |
| `DEFAULT_TRANSFER_NUMBER` | Voice Agent | Optional |
| `SUPABASE_S3_ACCESS_KEY` | Voice Agent | Optional (recordings) |
| `SUPABASE_S3_SECRET_KEY` | Voice Agent | Optional (recordings) |
| `SUPABASE_S3_ENDPOINT` | Voice Agent | Optional (recordings) |
| `SUPABASE_S3_REGION` | Voice Agent | Optional (recordings) |
| `SENTRY_DSN` | Voice Agent | Optional |
| `N8N_WEBHOOK_URL` | Voice Agent | Optional |
