export default function SessionsPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Sessions</h2>
          <p className="text-[var(--muted)] text-sm mt-1">Manage conversation sessions across all channels</p>
        </div>
        <button className="px-4 py-2 bg-[var(--accent)] text-white text-sm rounded-md hover:opacity-90 transition-opacity">
          New Session
        </button>
      </div>

      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg">
        <div className="p-4 border-b border-[var(--card-border)] flex gap-3">
          <input
            type="text"
            placeholder="Search sessions..."
            className="flex-1 bg-black/30 border border-[var(--card-border)] rounded-md px-3 py-2 text-sm text-white placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
          />
          <select className="bg-black/30 border border-[var(--card-border)] rounded-md px-3 py-2 text-sm text-white">
            <option>All Channels</option>
            <option>SMS (Twilio)</option>
            <option>Web Chat</option>
            <option>Telegram</option>
            <option>Slack</option>
          </select>
          <select className="bg-black/30 border border-[var(--card-border)] rounded-md px-3 py-2 text-sm text-white">
            <option>All Status</option>
            <option>Active</option>
            <option>Archived</option>
          </select>
        </div>
        <div className="p-8 text-center text-[var(--muted)] text-sm">
          Connect to backend to load sessions
        </div>
      </div>
    </div>
  );
}
