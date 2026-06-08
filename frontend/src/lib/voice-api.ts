/**
 * voice-api.ts — Typed client for the Voice Agent REST API.
 * Next.js rewrites /api/voice/* to the Python microservice.
 */

const BASE = "/api/voice";
const API_KEY = process.env.VOICE_AGENT_API_KEY || "";

async function req<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Voice API error ${res.status}: ${err}`);
  }
  return res.json();
}


// ── Types ──────────────────────────────────────────────────────────────────

export interface CallLog {
  id: string;
  phone_number: string;
  caller_name?: string;
  duration_seconds: number;
  was_booked: boolean;
  sentiment?: string;
  summary?: string;
  recording_url?: string;
  estimated_cost_usd?: number;
  call_date?: string;
  call_hour?: number;
  call_day_of_week?: string;
  created_at: string;
  tenant_id?: string;
}

export interface CallDetail extends CallLog {
  transcript?: string;
  transcript_lines?: { role: string; content: string; created_at: string }[];
}

export interface ActiveCall {
  room_id: string;
  phone: string;
  caller_name?: string;
  status: string;
  last_updated: string;
}

export interface Analytics {
  total_calls: number;
  total_bookings: number;
  booking_rate: number;
  avg_duration_seconds: number;
  total_cost_usd: number;
  sentiment_breakdown: Record<string, number>;
  calls_by_date: Record<string, number>;
}

export interface VoiceConfig {
  agent_instructions?: string;
  first_line?: string;
  llm_model?: string;
  llm_provider?: string;
  tts_voice?: string;
  tts_language?: string;
  tts_provider?: string;
  stt_provider?: string;
  stt_language?: string;
  lang_preset?: string;
  max_turns?: number;
  stt_min_endpointing_delay?: number;
  [key: string]: unknown;
}


// ── API calls ──────────────────────────────────────────────────────────────

export async function dispatchCall(phone: string, tenantId = "default") {
  return req<{ success: boolean; dispatch_id: string; room_name: string }>(
    "/calls/dispatch",
    {
      method: "POST",
      body: JSON.stringify({ phone_number: phone, tenant_id: tenantId }),
    },
  );
}

export async function listCalls(
  opts: { limit?: number; offset?: number; tenantId?: string } = {},
) {
  const params = new URLSearchParams();
  if (opts.limit)    params.set("limit",     String(opts.limit));
  if (opts.offset)   params.set("offset",    String(opts.offset));
  if (opts.tenantId) params.set("tenant_id", opts.tenantId);
  return req<{ calls: CallLog[]; total: number }>(`/calls?${params}`);
}

export async function getCall(id: string) {
  return req<CallDetail>(`/calls/${id}`);
}

export async function getActiveCalls(tenantId?: string) {
  const params = tenantId ? `?tenant_id=${tenantId}` : "";
  return req<{ active_calls: ActiveCall[] }>(`/calls/active${params}`);
}

export async function getAnalytics(tenantId?: string, days = 30) {
  const params = new URLSearchParams({ days: String(days) });
  if (tenantId) params.set("tenant_id", tenantId);
  return req<Analytics>(`/analytics?${params}`);
}

export async function getConfig(tenantId = "default") {
  return req<{ config: VoiceConfig; tenant_id: string }>(
    `/config?tenant_id=${tenantId}`,
  );
}

export async function updateConfig(config: VoiceConfig, tenantId = "default") {
  return req<{ success: boolean; tenant_id: string }>("/config", {
    method: "PUT",
    body: JSON.stringify({ config, tenant_id: tenantId }),
  });
}
