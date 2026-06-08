-- ============================================================
-- 001_wacrm_schema.sql
-- WhatsApp CRM tables (from ArnasDon/wacrm)
-- ============================================================

-- Accounts (WhatsApp Business API credentials per user/org)
CREATE TABLE IF NOT EXISTS ai_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number_id TEXT NOT NULL,
  access_token    TEXT NOT NULL,  -- AES-256-GCM encrypted
  business_id     TEXT,
  display_name    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts
CREATE TABLE IF NOT EXISTS ai_contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID REFERENCES ai_accounts(id) ON DELETE CASCADE,
  phone         TEXT NOT NULL,
  name          TEXT,
  email         TEXT,
  tags          TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (account_id, phone)
);

-- Conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID REFERENCES ai_accounts(id) ON DELETE CASCADE,
  contact_id    UUID REFERENCES ai_contacts(id) ON DELETE SET NULL,
  wa_contact_id TEXT NOT NULL,
  status        TEXT DEFAULT 'open',   -- open | resolved | pending
  assigned_to   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_message  TEXT,
  unread_count  INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS ai_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
  wa_message_id   TEXT UNIQUE,
  direction       TEXT NOT NULL,  -- inbound | outbound
  message_type    TEXT DEFAULT 'text',
  content         TEXT,
  media_url       TEXT,
  status          TEXT DEFAULT 'sent',  -- sent | delivered | read | failed
  timestamp       TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Pipelines (Kanban deal boards)
CREATE TABLE IF NOT EXISTS ai_pipelines (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES ai_accounts(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  stages     JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deals
CREATE TABLE IF NOT EXISTS ai_deals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID REFERENCES ai_pipelines(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES ai_contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  stage           TEXT NOT NULL,
  value           NUMERIC(15,2),
  assigned_to     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Broadcast templates / campaigns
CREATE TABLE IF NOT EXISTS ai_broadcasts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID REFERENCES ai_accounts(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  template_id  TEXT,
  template_name TEXT,
  status       TEXT DEFAULT 'draft',  -- draft | scheduled | running | done
  recipient_count INT DEFAULT 0,
  sent_count      INT DEFAULT 0,
  read_count      INT DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Automations
CREATE TABLE IF NOT EXISTS ai_automations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES ai_accounts(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  trigger    JSONB NOT NULL DEFAULT '{}',
  steps      JSONB NOT NULL DEFAULT '[]',
  active     BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE ai_accounts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_contacts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_pipelines      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_deals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_broadcasts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_automations    ENABLE ROW LEVEL SECURITY;

-- Policies (users see their own account's data)
CREATE POLICY accounts_owner    ON ai_accounts    FOR ALL USING (user_id = auth.uid());
CREATE POLICY contacts_owner    ON ai_contacts    FOR ALL USING (account_id IN (SELECT id FROM ai_accounts WHERE user_id = auth.uid()));
CREATE POLICY convos_owner      ON ai_conversations FOR ALL USING (account_id IN (SELECT id FROM ai_accounts WHERE user_id = auth.uid()));
CREATE POLICY messages_owner    ON ai_messages    FOR ALL USING (conversation_id IN (SELECT id FROM ai_conversations WHERE account_id IN (SELECT id FROM ai_accounts WHERE user_id = auth.uid())));
CREATE POLICY pipelines_owner   ON ai_pipelines   FOR ALL USING (account_id IN (SELECT id FROM ai_accounts WHERE user_id = auth.uid()));
CREATE POLICY deals_owner       ON ai_deals       FOR ALL USING (pipeline_id IN (SELECT id FROM ai_pipelines WHERE account_id IN (SELECT id FROM ai_accounts WHERE user_id = auth.uid())));
CREATE POLICY broadcasts_owner  ON ai_broadcasts  FOR ALL USING (account_id IN (SELECT id FROM ai_accounts WHERE user_id = auth.uid()));
CREATE POLICY automations_owner ON ai_automations FOR ALL USING (account_id IN (SELECT id FROM ai_accounts WHERE user_id = auth.uid()));
