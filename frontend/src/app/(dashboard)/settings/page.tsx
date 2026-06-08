"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SecretInput({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="password" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono"
    />
  );
}

function TextInput({ placeholder, value, onChange }: { placeholder?: string; value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );
}

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);

  // WhatsApp settings
  const [waAccessToken, setWaAccessToken]     = useState("");
  const [waPhoneId, setWaPhoneId]             = useState("");
  const [waBusinessId, setWaBusinessId]       = useState("");
  const [metaAppSecret, setMetaAppSecret]     = useState("");

  // Voice settings (keys stored server-side, shown masked)
  const [livekitUrl, setLivekitUrl]           = useState("");
  const [livekitKey, setLivekitKey]           = useState("");
  const [livekitSecret, setLivekitSecret]     = useState("");
  const [openaiKey, setOpenaiKey]             = useState("");
  const [sarvamKey, setSarvamKey]             = useState("");
  const [vobizDomain, setVobizDomain]         = useState("");
  const [vobizUser, setVobizUser]             = useState("");
  const [vobizPass, setVobizPass]             = useState("");
  const [vobizNumber, setVobizNumber]         = useState("");
  const [telegramToken, setTelegramToken]     = useState("");
  const [telegramChatId, setTelegramChatId]   = useState("");
  const [transferNumber, setTransferNumber]   = useState("");

  async function handleSave() {
    setSaving(true);
    // In a real implementation, this would POST to /api/settings to
    // save credentials to Supabase (encrypted) and/or env vars.
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    toast.success("Settings saved.");
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure your WhatsApp and Voice integrations.</p>
        </div>
        <button
          onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save All
        </button>
      </div>

      {/* WhatsApp */}
      <Section title="WhatsApp Business API">
        <Field label="Access Token" hint="From Meta for Developers → Your App → WhatsApp → API Setup.">
          <SecretInput placeholder="EAAG..." value={waAccessToken} onChange={setWaAccessToken} />
        </Field>
        <Field label="Phone Number ID">
          <TextInput placeholder="1234567890" value={waPhoneId} onChange={setWaPhoneId} />
        </Field>
        <Field label="WhatsApp Business Account ID">
          <TextInput placeholder="9876543210" value={waBusinessId} onChange={setWaBusinessId} />
        </Field>
        <Field label="Meta App Secret" hint="Used to verify HMAC webhook signatures.">
          <SecretInput placeholder="abc123..." value={metaAppSecret} onChange={setMetaAppSecret} />
        </Field>
        <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
          Webhook URL: <code className="bg-muted px-1 py-0.5 rounded">{typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/whatsapp</code>
        </div>
      </Section>

      {/* LiveKit */}
      <Section title="LiveKit (Voice)">
        <Field label="LiveKit URL">
          <TextInput placeholder="wss://your-project.livekit.cloud" value={livekitUrl} onChange={setLivekitUrl} />
        </Field>
        <Field label="API Key">
          <TextInput placeholder="APIxxxxxxxx" value={livekitKey} onChange={setLivekitKey} />
        </Field>
        <Field label="API Secret">
          <SecretInput placeholder="your_secret" value={livekitSecret} onChange={setLivekitSecret} />
        </Field>
      </Section>

      {/* AI Keys */}
      <Section title="AI API Keys">
        <Field label="OpenAI API Key">
          <SecretInput placeholder="sk-proj-..." value={openaiKey} onChange={setOpenaiKey} />
        </Field>
        <Field label="Sarvam AI Key" hint="For Indian language STT + TTS.">
          <SecretInput placeholder="sk_..." value={sarvamKey} onChange={setSarvamKey} />
        </Field>
      </Section>

      {/* SIP / Vobiz */}
      <Section title="SIP Trunk (Vobiz)">
        <div className="grid grid-cols-2 gap-4">
          <Field label="SIP Domain">
            <TextInput placeholder="xxx.sip.vobiz.ai" value={vobizDomain} onChange={setVobizDomain} />
          </Field>
          <Field label="Outbound Number">
            <TextInput placeholder="+91..." value={vobizNumber} onChange={setVobizNumber} />
          </Field>
          <Field label="Username">
            <TextInput value={vobizUser} onChange={setVobizUser} />
          </Field>
          <Field label="Password">
            <SecretInput placeholder="••••••" value={vobizPass} onChange={setVobizPass} />
          </Field>
        </div>
        <Field label="Default Transfer Number" hint="Human agent fallback number.">
          <TextInput placeholder="+91..." value={transferNumber} onChange={setTransferNumber} />
        </Field>
      </Section>

      {/* Telegram */}
      <Section title="Telegram Notifications">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Bot Token">
            <SecretInput placeholder="1234567:AA..." value={telegramToken} onChange={setTelegramToken} />
          </Field>
          <Field label="Chat ID">
            <TextInput placeholder="123456789" value={telegramChatId} onChange={setTelegramChatId} />
          </Field>
        </div>
      </Section>

      <div className="flex justify-end">
        <button
          onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Settings
        </button>
      </div>
    </div>
  );
}
