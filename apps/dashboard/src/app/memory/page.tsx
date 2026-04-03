export default function MemoryPage() {
  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-2">Memory & AI Brain</h2>
      <p className="text-[var(--muted)] text-sm mb-8">Obsidian vault sync, vector memory, and knowledge graph</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Obsidian Vault</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--muted)]">Vault Path</span>
              <span className="text-gray-300">data/obsidian-vault/</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--muted)]">Notes Synced</span>
              <span className="text-gray-300">--</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--muted)]">Last Sync</span>
              <span className="text-gray-300">--</span>
            </div>
          </div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Vector Memory (ChromaDB)</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--muted)]">Conversation Memories</span>
              <span className="text-gray-300">--</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--muted)]">Knowledge Base Entries</span>
              <span className="text-gray-300">--</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--muted)]">Tool Knowledge Entries</span>
              <span className="text-gray-300">--</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Semantic Search</h3>
          <input
            type="text"
            placeholder="Search across all memories and knowledge..."
            className="w-full bg-black/30 border border-[var(--card-border)] rounded-md px-4 py-3 text-sm text-white placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>
    </div>
  );
}
