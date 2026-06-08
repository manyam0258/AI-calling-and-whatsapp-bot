import { listCalls } from "@/lib/voice-api";
import { formatDuration, formatDateTime, sentimentColor } from "@/lib/utils";
import { Phone, CheckCircle, XCircle, Play } from "lucide-react";

export default async function CallLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page   = parseInt(sp.page ?? "1") - 1;
  const limit  = 25;
  const offset = page * limit;

  let calls = { calls: [] as ReturnType<typeof Array>, total: 0 };
  try {
    calls = await listCalls({ limit, offset });
  } catch {}

  const totalPages = Math.ceil(calls.total / limit);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Call Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {calls.total} total calls recorded
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">CALLER</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">DURATION</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">BOOKED</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">SENTIMENT</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">DATE</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">COST</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {calls.calls.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No calls recorded yet.
                </td>
              </tr>
            ) : (
              calls.calls.map((call: {
                id: string;
                phone_number: string;
                caller_name?: string;
                duration_seconds: number;
                was_booked: boolean;
                sentiment?: string;
                created_at: string;
                estimated_cost_usd?: number;
                recording_url?: string;
              }) => (
                <tr key={call.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground">{call.caller_name || call.phone_number}</p>
                      {call.caller_name && (
                        <p className="text-xs text-muted-foreground">{call.phone_number}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDuration(call.duration_seconds)}
                  </td>
                  <td className="px-4 py-3">
                    {call.was_booked
                      ? <CheckCircle className="h-4 w-4 text-green-400" />
                      : <XCircle className="h-4 w-4 text-muted-foreground" />
                    }
                  </td>
                  <td className={`px-4 py-3 capitalize ${sentimentColor(call.sentiment)}`}>
                    {call.sentiment ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDateTime(call.created_at)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {call.estimated_cost_usd ? `$${call.estimated_cost_usd}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {call.recording_url && (
                        <a
                          href={call.recording_url}
                          target="_blank"
                          rel="noreferrer"
                          title="Play recording"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Play className="h-4 w-4" />
                        </a>
                      )}
                      <a
                        href={`/voice/calls/${call.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        Details
                      </a>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Showing {offset + 1}–{Math.min(offset + limit, calls.total)} of {calls.total}
          </p>
          <div className="flex gap-2">
            {page > 0 && (
              <a href={`?page=${page}`} className="rounded-lg border border-border px-3 py-1.5 hover:bg-accent transition-colors">
                Previous
              </a>
            )}
            {page + 1 < totalPages && (
              <a href={`?page=${page + 2}`} className="rounded-lg border border-border px-3 py-1.5 hover:bg-accent transition-colors">
                Next
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
