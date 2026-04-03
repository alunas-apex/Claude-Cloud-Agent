export default function DashboardHome() {
  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-2">Dashboard</h2>
      <p className="text-[var(--muted)] mb-8">Claude Cloud Agent Command Center</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Active Sessions" value="--" subtitle="Across all channels" />
        <StatCard title="Tools Registered" value="--" subtitle="Native + MCP + Plugin" />
        <StatCard title="Today's Cost" value="$--" subtitle="Across all models" />
        <StatCard title="Uptime" value="--" subtitle="Since last restart" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Recent Activity">
          <p className="text-sm text-[var(--muted)]">
            Connect to the backend to see live activity. Start the backend server and this dashboard will auto-connect via WebSocket.
          </p>
        </Card>
        <Card title="System Health">
          <div className="space-y-3">
            <HealthRow label="Backend Server" status="checking" />
            <HealthRow label="Database (SQLite)" status="checking" />
            <HealthRow label="WebSocket" status="checking" />
            <HealthRow label="MCP Server" status="checking" />
            <HealthRow label="Obsidian Vault" status="checking" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4">
      <p className="text-xs text-[var(--muted)] uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      <p className="text-xs text-[var(--muted)] mt-1">{subtitle}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-5">
      <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
      {children}
    </div>
  );
}

function HealthRow({ label, status }: { label: string; status: string }) {
  const color = status === 'online' ? 'bg-green-500' : status === 'offline' ? 'bg-red-500' : 'bg-yellow-500';
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-300">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-xs text-[var(--muted)] capitalize">{status}</span>
      </div>
    </div>
  );
}
