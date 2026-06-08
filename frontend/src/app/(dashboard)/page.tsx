import { Suspense } from "react";
import { MessageSquare, Phone, TrendingUp, Users } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase-server";

async function getStats() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Fetch WA conversation count (last 30 days)
  const { count: waCount } = await supabase
    .from("ai_conversations")
    .select("*", { count: "exact", head: true })
    .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString());

  const { count: contactCount } = await supabase
    .from("ai_contacts")
    .select("*", { count: "exact", head: true });

  return { waConversations: waCount ?? 0, contacts: contactCount ?? 0 };
}

function StatCard({
  label, value, icon: Icon, sub,
}: {
  label: string; value: string | number; icon: React.ElementType; sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const stats = await getStats();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Combined overview of your WhatsApp CRM and Voice Agent activity.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="WA Conversations (30d)"
          value={stats?.waConversations ?? "—"}
          icon={MessageSquare}
        />
        <StatCard
          label="Total Contacts"
          value={stats?.contacts ?? "—"}
          icon={Users}
        />
        <StatCard
          label="Voice Calls Today"
          value="—"
          icon={Phone}
          sub="Check Voice → Analytics"
        />
        <StatCard
          label="Bookings This Month"
          value="—"
          icon={TrendingUp}
          sub="Check Voice → Analytics"
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-medium text-foreground mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            WhatsApp CRM
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Manage your WhatsApp shared inbox, contacts, pipelines, broadcasts, and automations.
          </p>
          <div className="flex gap-2 flex-wrap">
            <a href="/inbox"       className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">Open Inbox</a>
            <a href="/contacts"    className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors">Contacts</a>
            <a href="/broadcasts"  className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors">Broadcasts</a>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-medium text-foreground mb-3 flex items-center gap-2">
            <Phone className="h-4 w-4 text-green-400" />
            AI Voice Agent
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Deploy outbound AI calls with multi-language support, booking integration, and analytics.
          </p>
          <div className="flex gap-2 flex-wrap">
            <a href="/voice/make-call" className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors">Make a Call</a>
            <a href="/voice/calls"     className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors">Call Logs</a>
            <a href="/voice/analytics" className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors">Analytics</a>
          </div>
        </div>
      </div>
    </div>
  );
}
