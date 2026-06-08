import { getAnalytics } from "@/lib/voice-api";
import { formatDuration } from "@/lib/utils";

function BarRow({ label, value, max, color = "bg-primary" }: {
  label: string; value: number; max: number; color?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 text-muted-foreground capitalize truncate">{label}</span>
      <div className="flex-1 bg-muted rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-foreground font-medium">{value}</span>
    </div>
  );
}

export default async function AnalyticsPage() {
  let analytics = null;
  try {
    analytics = await getAnalytics(undefined, 30);
  } catch {}

  if (!analytics) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-foreground mb-2">Analytics</h1>
        <p className="text-muted-foreground">Unable to load analytics. Check that the voice agent service is running.</p>
      </div>
    );
  }

  const sentimentColors: Record<string, string> = {
    positive: "bg-green-500", neutral: "bg-blue-500",
    negative: "bg-orange-500", frustrated: "bg-red-500",
  };
  const maxSentiment = Math.max(...Object.values(analytics.sentiment_breakdown));

  const dateEntries = Object.entries(analytics.calls_by_date)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14); // last 14 days
  const maxCalls = Math.max(...dateEntries.map(([, v]) => v as number), 1);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Last 30 days — voice agent performance</p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total Calls",     value: analytics.total_calls },
          { label: "Bookings",        value: analytics.total_bookings },
          { label: "Booking Rate",    value: `${analytics.booking_rate}%` },
          { label: "Avg Duration",    value: formatDuration(analytics.avg_duration_seconds) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1.5 text-xl font-semibold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Sentiment */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Caller Sentiment</h2>
          {Object.keys(analytics.sentiment_breakdown).length === 0 ? (
            <p className="text-sm text-muted-foreground">No sentiment data yet.</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(analytics.sentiment_breakdown).map(([s, count]) => (
                <BarRow
                  key={s} label={s} value={count as number} max={maxSentiment}
                  color={sentimentColors[s] ?? "bg-muted"}
                />
              ))}
            </div>
          )}
        </div>

        {/* Calls by date */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Calls per Day (last 14d)</h2>
          {dateEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {dateEntries.map(([date, count]) => (
                <BarRow key={date} label={date.slice(5)} value={count as number} max={maxCalls} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cost */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-2">Estimated Cost</h2>
        <p className="text-3xl font-bold text-foreground">${analytics.total_cost_usd}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Based on STT, TTS, and LLM usage estimates. Actual costs may vary.
        </p>
      </div>
    </div>
  );
}
