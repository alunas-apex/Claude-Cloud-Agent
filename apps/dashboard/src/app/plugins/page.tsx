export default function PluginsPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Plugins</h2>
          <p className="text-[var(--muted)] text-sm mt-1">Install and manage agent plugins</p>
        </div>
        <button className="px-4 py-2 bg-[var(--accent)] text-white text-sm rounded-md hover:opacity-90 transition-opacity">
          Browse Marketplace
        </button>
      </div>

      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-8 text-center">
        <p className="text-[var(--muted)] text-sm mb-4">No plugins installed yet</p>
        <p className="text-[var(--muted)] text-xs">Plugin system available in Phase 7</p>
      </div>
    </div>
  );
}
