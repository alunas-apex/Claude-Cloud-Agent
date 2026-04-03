export default function AgentsPage() {
  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-2">Agent Teams</h2>
      <p className="text-[var(--muted)] text-sm mb-8">Configure and monitor specialized AI agent teams</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AgentCard
          name="Coordinator"
          model="Sonnet"
          description="Decomposes tasks, delegates to specialists, synthesizes results"
          status="available"
        />
        <AgentCard
          name="Researcher"
          model="Sonnet"
          description="Web search, knowledge retrieval, information gathering"
          status="available"
        />
        <AgentCard
          name="Coder"
          model="Opus"
          description="Code generation, debugging, repository analysis"
          status="available"
        />
        <AgentCard
          name="Planner"
          model="Opus"
          description="Strategy, architecture, multi-step planning"
          status="available"
        />
        <AgentCard
          name="Executor"
          model="Haiku"
          description="Simple tool calls, data fetching, routine operations"
          status="available"
        />
        <div className="border-2 border-dashed border-[var(--card-border)] rounded-lg p-6 flex items-center justify-center">
          <button className="text-[var(--muted)] text-sm hover:text-white transition-colors">
            + Create Custom Agent
          </button>
        </div>
      </div>
    </div>
  );
}

function AgentCard({ name, model, description, status }: {
  name: string; model: string; description: string; status: string;
}) {
  return (
    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-white">{name}</h3>
        <span className="text-xs px-2 py-1 bg-white/5 rounded text-[var(--muted)]">{model}</span>
      </div>
      <p className="text-sm text-[var(--muted)] mb-4">{description}</p>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 bg-green-500 rounded-full" />
        <span className="text-xs text-[var(--muted)] capitalize">{status}</span>
      </div>
    </div>
  );
}
