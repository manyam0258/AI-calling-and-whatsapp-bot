-- ============================================================
-- 003_saas_schema.sql
-- Multi-tenant SaaS layer — tenants, subscriptions, usage
-- ============================================================

-- Tenants (one per organisation)
CREATE TABLE IF NOT EXISTS tenants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE,
  plan       TEXT DEFAULT 'free',  -- free | starter | pro | enterprise
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant members (team access)
CREATE TABLE IF NOT EXISTS tenant_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT DEFAULT 'member',  -- owner | admin | member
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, user_id)
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_customer   TEXT,
  stripe_sub_id     TEXT,
  plan              TEXT DEFAULT 'free',
  status            TEXT DEFAULT 'active',
  current_period_end TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Monthly usage tracking
CREATE TABLE IF NOT EXISTS usage_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  month           TEXT NOT NULL,   -- e.g. '2026-06'
  call_minutes    INT DEFAULT 0,
  wa_messages     INT DEFAULT 0,
  api_calls       INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, month)
);

-- Plan limits
CREATE TABLE IF NOT EXISTS plan_limits (
  plan            TEXT PRIMARY KEY,
  call_minutes    INT DEFAULT 60,      -- per month
  wa_messages     INT DEFAULT 500,
  team_members    INT DEFAULT 1,
  description     TEXT
);

INSERT INTO plan_limits (plan, call_minutes, wa_messages, team_members, description) VALUES
  ('free',       60,    500,   1, 'Free tier — test the platform'),
  ('starter',    500,   5000,  3, 'For small teams'),
  ('pro',        3000,  30000, 10,'For growing businesses'),
  ('enterprise', 99999, 99999, 99,'Custom — contact us')
ON CONFLICT (plan) DO NOTHING;

-- RLS
ALTER TABLE tenants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs     ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenants_owner    ON tenants        FOR ALL USING (owner_id = auth.uid());
CREATE POLICY members_access   ON tenant_members FOR ALL USING (user_id = auth.uid() OR tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));
CREATE POLICY subs_owner       ON subscriptions  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));
CREATE POLICY usage_owner      ON usage_logs     FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

-- Helper: create tenant on signup
CREATE OR REPLACE FUNCTION create_tenant_for_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO tenants (owner_id, name, slug)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), split_part(NEW.email, '@', 1) || '-' || substring(NEW.id::text, 1, 8));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_tenant_for_new_user();
