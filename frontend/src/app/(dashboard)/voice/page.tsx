import { Phone, TrendingUp, Clock, CheckCircle, DollarSign } from "lucide-react";
import { getAnalytics, getActiveCalls } from "@/lib/voice-api";
import { formatDuration } from "@/lib/utils";

async function VoiceDashboard() {
  let analytics = null;
  let activeCalls = null;
  try {
    [analytics, activeCalls] = await Promise.all([
      getAnalytics(undefined, 30),
      getActiveCalls(),
    ]);
  } catch {}

  const stats = [
    {
      label: "Total Calls (30d)", value: analytics?.total_calls ?? "—",
      icon: Phone, color: "text-blue-400",
    },
    {
      label: "Bookings", value: analytics?.total_bookings ?? "—",
      icon: CheckCircle, color: "text-green-400",
    },
    {
      label: "Booking Rate", value: analytics ? `${analytics.booking_rate}%` : "—",
      icon: TrendingUp, color: "text-purple-400",
    },
    {
      label: "Avg Duration", value: analytics ? formatDuration(analytics.avg_duration_seconds) : "—",
      icon: Clock, color: "text-orange-400",
    },
    {
      label: "Est. Cost (30d)", value: analytics ? `$${analytics.total_cost_usd}` : "—",
      icon: DollarSign, color: "text-yellow-400",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Voice Agent</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Outbound AI calling dashboard — LiveKit + Sarvam/OpenAI
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${(activeCalls?.active_calls?.length ?? 0) > 0 ? "bg-green-400 animate-pulse" : "bg-muted"}`} />
          <span className="text-sm text-muted-foreground">
            {(activeCalls?.active_calls?.length ?? 0) > 0
              ? `${activeCalls!.active_calls.length} active call(s)`
              : "No active calls"}
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">{label}</p>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <p className="text-xl font-semibold text-foreground">{String(value)}</p>
          </div>
        ))}
      </div>

      {/* Sentiment breakdown */}
      {analytics?.sentiment_breakdown && Object.keys(analytics.sentiment_breakdown).length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium text-foreground mb-3">Sentiment Breakdown</h2>
          <div className="flex gap-6 flex-wrap">
            {Object.entries(analytics.sentiment_breakdown).map(([sentiment, count]) => (
              <div key={sentiment} className="text-center">
                <p className="text-lg font-semibold text-foreground">{count as number}</p>
                <p className="text-xs text-muted-foreground capitalize">{sentiment}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active calls */}
      {(activeCalls?.active_calls?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-5">
          <h2 className="text-sm font-medium text-green-400 mb-3">🟢 Active Calls</h2>
          <div className="space-y-2">
            {activeCalls!.active_calls.map((call) => (
              <div key={call.room_id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{call.caller_name || call.phone}</span>
                <span className="text-muted-foreground">{call.room_id}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="flex gap-3 flex-wrap">
        <a href="/voice/make-call" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          + Make a Call
        </a>
        <a href="/voice/calls" className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">
          View Call Logs
        </a>
        <a href="/voice/config" className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">
          Agent Config
        </a>
        <a href="/voice/analytics" className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">
          Analytics
        </a>
      </div>
    </div>
  );
}

export default VoiceDashboard;
