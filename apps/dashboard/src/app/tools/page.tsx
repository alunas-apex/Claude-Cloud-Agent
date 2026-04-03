export default function ToolsPage() {
  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-2">Tools</h2>
      <p className="text-[var(--muted)] text-sm mb-8">View registered tools and execution history</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg">
            <div className="p-4 border-b border-[var(--card-border)]">
              <h3 className="text-sm font-semibold text-white">Tool Registry</h3>
            </div>
            <div className="p-4 space-y-2">
              <ToolCategory name="Google Workspace" count={11} />
              <ToolCategory name="GCP" count={16} />
              <ToolCategory name="Admin" count={13} />
              <ToolCategory name="Utility" count={1} />
              <ToolCategory name="MCP (External)" count={0} />
              <ToolCategory name="Plugins" count={0} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg">
            <div className="p-4 border-b border-[var(--card-border)]">
              <h3 className="text-sm font-semibold text-white">Execution Log</h3>
            </div>
            <div className="p-8 text-center text-[var(--muted)] text-sm">
              Connect to backend to see tool execution history
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolCategory({ name, count }: { name: string; count: number }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-white/5 cursor-pointer">
      <span className="text-sm text-gray-300">{name}</span>
      <span className="text-xs text-[var(--muted)] bg-white/5 px-2 py-0.5 rounded">{count}</span>
    </div>
  );
}
