"use client";

import { useState } from "react";
import { Phone, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { dispatchCall } from "@/lib/voice-api";
import { toast } from "sonner";

export default function MakeCallPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; dispatch_id?: string; room_name?: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.startsWith("+")) {
      toast.error("Phone must include country code (e.g. +91...)");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const data = await dispatchCall(phone);
      setResult(data);
      toast.success("Call dispatched successfully!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to dispatch call";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Make a Call</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Dispatch an AI outbound call via LiveKit + Vobiz SIP.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Phone Number
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+919876543210"
              className="w-full rounded-lg border border-border bg-input pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Include country code, e.g. +91 for India
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
          <p>• The AI agent will call this number using LiveKit + Vobiz SIP</p>
          <p>• Agent behavior is configured in <a href="/voice/config" className="text-primary underline">Agent Config</a></p>
          <p>• Call will appear in <a href="/voice/calls" className="text-primary underline">Call Logs</a> after it ends</p>
        </div>

        <button
          type="submit"
          disabled={loading || !phone}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Dispatching...</>
          ) : (
            <><Phone className="h-4 w-4" /> Dispatch Call</>
          )}
        </button>
      </form>

      {result && (
        <div className={`mt-5 rounded-lg border p-4 ${result.success ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"}`}>
          {result.success ? (
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-400 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-green-400">Call Dispatched!</p>
                <p className="text-muted-foreground mt-1">Dispatch ID: <code className="text-xs bg-muted px-1 py-0.5 rounded">{result.dispatch_id}</code></p>
                <p className="text-muted-foreground">Room: <code className="text-xs bg-muted px-1 py-0.5 rounded">{result.room_name}</code></p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
              <p className="text-sm text-destructive">Failed to dispatch. Check agent logs.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
