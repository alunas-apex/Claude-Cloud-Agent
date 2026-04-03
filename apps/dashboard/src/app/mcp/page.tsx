export default function McpPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">MCP Servers</h2>
          <p className="text-[var(--muted)] text-sm mt-1">Manage Model Context Protocol server connections</p>
        </div>
        <button className="px-4 py-2 bg-[var(--accent)] text-white text-sm rounded-md hover:opacity-90 transition-opacity">
          Add MCP Server
        </button>
      </div>

      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg mb-6 p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Built-in MCP Server</h3>
        <p className="text-sm text-[var(--muted)] mb-3">
          Exposes all registered tools to Claude Desktop and Claude Code via MCP protocol.
        </p>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-yellow-500 rounded-full" />
            <span className="text-[var(--muted)]">Pending setup (Phase 4)</span>
          </div>
        </div>
      </div>

      <h3 className="text-sm font-semibold text-white mb-4">External MCP Servers</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <McpServerCard name="Filesystem" pkg="@modelcontextprotocol/server-filesystem" status="available" />
        <McpServerCard name="GitHub" pkg="@modelcontextprotocol/server-github" status="available" />
        <McpServerCard name="Slack" pkg="@modelcontextprotocol/server-slack" status="available" />
        <McpServerCard name="PostgreSQL" pkg="@modelcontextprotocol/server-postgres" status="available" />
        <McpServerCard name="Playwright" pkg="@playwright/mcp" status="available" />
        <McpServerCard name="Brave Search" pkg="@modelcontextprotocol/server-brave-search" status="available" />
        <McpServerCard name="Memory" pkg="@modelcontextprotocol/server-memory" status="available" />
        <McpServerCard name="Google Drive" pkg="@modelcontextprotocol/server-gdrive" status="available" />
      </div>
    </div>
  );
}

function McpServerCard({ name, pkg, status }: { name: string; pkg: string; status: string }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4">
      <h4 className="font-medium text-white text-sm mb-1">{name}</h4>
      <p className="text-xs text-[var(--muted)] mb-3 font-mono">{pkg}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-gray-500 rounded-full" />
          <span className="text-xs text-[var(--muted)] capitalize">{status}</span>
        </div>
        <button className="text-xs text-[var(--accent)] hover:underline">Connect</button>
      </div>
    </div>
  );
}
