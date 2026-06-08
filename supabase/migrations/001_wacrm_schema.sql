-- ============================================================
-- 001_wacrm_schema.sql
-- WhatsApp CRM tables (from ArnasDon/wacrm)
-- ============================================================

-- Accounts (WhatsApp Business API credentials per user/org)
CREATE TABLE IF NOT EXISTS accounts (
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
CREATE TABLE IF NOT EXISTS contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID REFERENCES accounts(id) ON DELETE CASCADE,
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
CREATE TABLE IF NOT EXISTS conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id    UUID REFERENCES contacts(id) ON DELETE SET NULL,
  wa_contact_id TEXT NOT NULL,
  status        TEXT DEFAULT 'open',   -- open | resolved | pending
  assigned_to   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_message  TEXT,
  unread_count  INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
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
CREATE TABLE IF NOT EXISTS pipelines (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  stages     JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deals
CREATE TABLE IF NOT EXISTS deals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  stage           TEXT NOT NULL,
  value           NUMERIC(15,2),
  assigned_to     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Broadcast templates / campaigns
CREATE TABLE IF NOT EXISTS broadcasts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID REFERENCES accounts(id) ON DELETE CASCADE,
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
CREATE TABLE IF NOT EXISTS automations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  trigger    JSONB NOT NULL DEFAULT '{}',
  steps      JSONB NOT NULL DEFAULT '[]',
  active     BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE accounts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipelines      ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations    ENABLE ROW LEVEL SECURITY;

-- Policies (users see their own account's data)
CREATE POLICY accounts_owner    ON accounts    FOR ALL USING (user_id = auth.uid());
CREATE POLICY contacts_owner    ON contacts    FOR ALL USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));
CREATE POLICY convos_owner      ON conversations FOR ALL USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));
CREATE POLICY messages_owner    ON messages    FOR ALL USING (conversation_id IN (SELECT id FROM conversations WHERE account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid())));
CREATE POLICY pipelines_owner   ON pipelines   FOR ALL USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));
CREATE POLICY deals_owner       ON deals       FOR ALL USING (pipeline_id IN (SELECT id FROM pipelines WHERE account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid())));
CREATE POLICY broadcasts_owner  ON broadcasts  FOR ALL USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));
CREATE POLICY automations_owner ON automations FOR ALL USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));
