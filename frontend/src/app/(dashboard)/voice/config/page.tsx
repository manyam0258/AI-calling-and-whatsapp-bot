"use client";

import { useEffect, useState } from "react";
import { getConfig, updateConfig, VoiceConfig } from "@/lib/voice-api";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

const LLM_PROVIDERS = ["openai", "groq", "claude"];
const TTS_PROVIDERS = ["sarvam", "elevenlabs"];
const STT_PROVIDERS = ["sarvam", "deepgram"];
const LANG_PRESETS  = ["multilingual", "hinglish", "hindi", "english", "telugu"];
const TTS_VOICES    = ["kavya", "anushka", "arvind", "abhilash"];
const LLM_MODELS    = {
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
  groq:   ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"],
  claude: ["claude-haiku-3-5-latest", "claude-sonnet-4-6"],
};

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { value: string; onChange: (v: string) => void }) {
  return (
    <input
      {...rest}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export default function AgentConfigPage() {
  const [config, setConfig] = useState<VoiceConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getConfig().then((r) => { setConfig(r.config); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  function set(key: string, value: unknown) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      await updateConfig(config);
      toast.success("Config saved.");
    } catch {
      toast.error("Failed to save config.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  const llmProvider = (config.llm_provider as string) || "openai";
  const modelOptions = LLM_MODELS[llmProvider as keyof typeof LLM_MODELS] ?? [];

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Agent Config</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure your AI calling agent behaviour, voice, and integrations.</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </button>
      </div>

      {/* Agent Personality */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Agent Personality</h2>
        <Field label="First Line (greeting)" hint="What the agent says when the call connects.">
          <Input value={(config.first_line as string) || ""} onChange={(v) => set("first_line", v)} placeholder="Namaste! This is..." />
        </Field>
        <Field label="System Instructions" hint="Core agent instructions — persona, goals, constraints.">
          <textarea
            value={(config.agent_instructions as string) || ""}
            onChange={(e) => set("agent_instructions", e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            placeholder="You are a helpful AI assistant..."
          />
        </Field>
        <Field label="Language Preset">
          <Select value={(config.lang_preset as string) || "multilingual"} onChange={(v) => set("lang_preset", v)} options={LANG_PRESETS} />
        </Field>
        <Field label="Max Turns" hint="Auto-close call after N user turns.">
          <Input type="number" value={String(config.max_turns ?? 25)} onChange={(v) => set("max_turns", parseInt(v))} />
        </Field>
      </section>

      {/* LLM */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">LLM</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Provider">
            <Select value={llmProvider} onChange={(v) => { set("llm_provider", v); set("llm_model", LLM_MODELS[v as keyof typeof LLM_MODELS]?.[0] ?? ""); }} options={LLM_PROVIDERS} />
          </Field>
          <Field label="Model">
            <Select value={(config.llm_model as string) || ""} onChange={(v) => set("llm_model", v)} options={modelOptions} />
          </Field>
        </div>
      </section>

      {/* STT */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Speech-to-Text (STT)</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Provider">
            <Select value={(config.stt_provider as string) || "sarvam"} onChange={(v) => set("stt_provider", v)} options={STT_PROVIDERS} />
          </Field>
          <Field label="Language">
            <Input value={(config.stt_language as string) || "unknown"} onChange={(v) => set("stt_language", v)} placeholder="unknown (auto-detect)" />
          </Field>
        </div>
        <Field label="Min Endpointing Delay (seconds)" hint="How long to wait after speech before ending turn.">
          <Input type="number" value={String(config.stt_min_endpointing_delay ?? 0.3)} onChange={(v) => set("stt_min_endpointing_delay", parseFloat(v))} />
        </Field>
      </section>

      {/* TTS */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Text-to-Speech (TTS)</h2>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Provider">
            <Select value={(config.tts_provider as string) || "sarvam"} onChange={(v) => set("tts_provider", v)} options={TTS_PROVIDERS} />
          </Field>
          <Field label="Voice">
            <Select value={(config.tts_voice as string) || "kavya"} onChange={(v) => set("tts_voice", v)} options={TTS_VOICES} />
          </Field>
          <Field label="Language Code">
            <Input value={(config.tts_language as string) || "hi-IN"} onChange={(v) => set("tts_language", v)} placeholder="hi-IN" />
          </Field>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Config
        </button>
      </div>
    </div>
  );
}
