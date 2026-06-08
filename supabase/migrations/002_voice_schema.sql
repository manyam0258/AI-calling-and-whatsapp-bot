-- ============================================================
-- 002_voice_schema.sql
-- Voice Agent tables (from manyam0258/voice-agent2) extended with tenant_id
-- ============================================================

-- Call logs
CREATE TABLE IF NOT EXISTS call_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT DEFAULT 'default',
  phone_number        TEXT NOT NULL,
  caller_name         TEXT,
  duration_seconds    INT DEFAULT 0,
  transcript          TEXT,
  summary             TEXT,
  recording_url       TEXT,
  sentiment           TEXT,
  was_booked          BOOLEAN DEFAULT false,
  interrupt_count     INT DEFAULT 0,
  estimated_cost_usd  NUMERIC(10,5),
  call_date           DATE,
  call_hour           SMALLINT,
  call_day_of_week    TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_logs_tenant     ON call_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_phone      ON call_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON call_logs(created_at DESC);

-- Real-time transcript streaming
CREATE TABLE IF NOT EXISTS call_transcripts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_room_id TEXT NOT NULL,
  phone        TEXT,
  tenant_id    TEXT DEFAULT 'default',
  role         TEXT NOT NULL,  -- user | assistant
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcripts_room ON call_transcripts(call_room_id);

-- Active calls (real-time status)
CREATE TABLE IF NOT EXISTS active_calls (
  room_id      TEXT PRIMARY KEY,
  tenant_id    TEXT DEFAULT 'default',
  phone        TEXT,
  caller_name  TEXT,
  status       TEXT DEFAULT 'active',  -- active | completed
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Per-tenant voice configs
CREATE TABLE IF NOT EXISTS voice_configs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  TEXT UNIQUE NOT NULL DEFAULT 'default',
  config     JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (service role key bypasses — for Python agent)
ALTER TABLE call_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_transcripts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_calls      ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_configs     ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (used by Python agent)
CREATE POLICY call_logs_service    ON call_logs        FOR ALL USING (true);
CREATE POLICY transcripts_service  ON call_transcripts FOR ALL USING (true);
CREATE POLICY active_service       ON active_calls     FOR ALL USING (true);
CREATE POLICY configs_service      ON voice_configs    FOR ALL USING (true);

-- Enable realtime for active_calls
ALTER PUBLICATION supabase_realtime ADD TABLE active_calls;
