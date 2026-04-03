import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '../types/index.js';
import { ToolRegistry } from '../agent/tool-registry.js';
import { CostTracker } from '../agent/cost-tracker.js';
import { eventBus } from '../services/event-bus.js';
import { SpecialistAgent, AgentRole, AgentResult, AgentTask } from './base.js';
import { ALL_SPECIALIST_CONFIGS, COORDINATOR_CONFIG } from './specialists.js';

interface TeamTask {
  id: string;
  instruction: string;
  status: 'pending' | 'delegating' | 'executing' | 'completed' | 'failed';
  delegations: Array<{ role: AgentRole; instruction: string; result?: AgentResult }>;
  finalResult?: string;
  startedAt: number;
  completedAt?: number;
}

/**
 * AgentTeam — Orchestrates a team of specialist agents.
 *
 * The Coordinator agent analyzes tasks, decides which specialists to involve,
 * delegates sub-tasks, and synthesizes results into a final response.
 *
 * For simple tasks, the Coordinator may delegate to a single agent.
 * For complex tasks, it decomposes and delegates to multiple agents.
 */
export class AgentTeam {
  private agents: Map<AgentRole, SpecialistAgent> = new Map();
  private client: Anthropic;
  private costTracker: CostTracker;
  private taskHistory: TeamTask[] = [];
  private _enabled = true;

  constructor(registry: ToolRegistry, costTracker: CostTracker) {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.costTracker = costTracker;

    // Create all specialist agents
    for (const config of ALL_SPECIALIST_CONFIGS) {
      this.agents.set(config.role, new SpecialistAgent(config, registry, costTracker));
    }

    console.log(`[AgentTeam] Initialized with ${this.agents.size} agents`);
  }

  /**
   * Run a task through the agent team.
   * The coordinator decides which specialist(s) to use.
   */
  async run(instruction: string): Promise<string> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const task: TeamTask = {
      id: taskId,
      instruction,
      status: 'delegating',
      delegations: [],
      startedAt: Date.now(),
    };

    this.taskHistory.unshift(task);
    if (this.taskHistory.length > 50) this.taskHistory.pop();

    eventBus.emit('agent:task_started', { taskId, instruction: instruction.slice(0, 100) });

    try {
      // Step 1: Ask the coordinator to analyze and create a delegation plan
      const plan = await this.createDelegationPlan(instruction);

      if (plan.length === 0) {
        // Coordinator handles it directly
        task.status = 'executing';
        const coordinator = this.agents.get('coordinator')!;
        const result = await coordinator.execute({
          id: `${taskId}_direct`,
          instruction,
        });
        task.finalResult = result.output;
        task.status = result.success ? 'completed' : 'failed';
        task.completedAt = Date.now();
        return result.output;
      }

      // Step 2: Execute delegations (sequentially for now, parallel support later)
      task.status = 'executing';
      for (const delegation of plan) {
        const agent = this.agents.get(delegation.role);
        if (!agent) {
          task.delegations.push({
            role: delegation.role,
            instruction: delegation.instruction,
            result: {
              taskId: `${taskId}_${delegation.role}`,
              agentRole: delegation.role,
              success: false,
              output: `Agent "${delegation.role}" not found`,
              toolCalls: 0,
              tokensUsed: { input: 0, output: 0 },
              durationMs: 0,
            },
          });
          continue;
        }

        const result = await agent.execute({
          id: `${taskId}_${delegation.role}`,
          instruction: delegation.instruction,
          context: instruction,
          delegatedBy: 'coordinator',
        });

        task.delegations.push({
          role: delegation.role,
          instruction: delegation.instruction,
          result,
        });
      }

      // Step 3: Synthesize results if multiple delegations
      if (task.delegations.length === 1 && task.delegations[0].result?.success) {
        task.finalResult = task.delegations[0].result.output;
      } else {
        task.finalResult = await this.synthesizeResults(instruction, task.delegations);
      }

      task.status = 'completed';
      task.completedAt = Date.now();

      eventBus.emit('agent:task_completed', {
        taskId,
        agents: task.delegations.map((d) => d.role),
        durationMs: Date.now() - task.startedAt,
      });

      return task.finalResult;

    } catch (err: any) {
      task.status = 'failed';
      task.finalResult = `Agent team error: ${err.message}`;
      task.completedAt = Date.now();
      return task.finalResult;
    }
  }

  /**
   * Ask the coordinator to create a delegation plan.
   */
  private async createDelegationPlan(instruction: string): Promise<Array<{ role: AgentRole; instruction: string }>> {
    const model = MODELS[COORDINATOR_CONFIG.modelTier];

    const planningPrompt = `Analyze this task and decide which specialist agent(s) should handle it.

Available agents:
- researcher: Information gathering, email/calendar lookups, knowledge retrieval
- coder: Code generation, debugging, technical analysis, GCP operations
- planner: Strategy, architecture, multi-step planning, decision analysis
- executor: Simple tool calls (send email, create event, quick lookups)

Task: ${instruction}

Respond with a JSON array of delegations. Each delegation has "role" and "instruction" fields.
For simple tasks, use a single delegation. For complex tasks, use multiple.
If you can handle it yourself without specialists, respond with an empty array [].

Examples:
- "Send an email to bob" → [{"role": "executor", "instruction": "Send an email to bob"}]
- "Research our Q4 emails and create a strategy" → [{"role": "researcher", "instruction": "Search emails for Q4 related discussions and summarize findings"}, {"role": "planner", "instruction": "Based on the research findings, create a Q4 strategy"}]
- "What time is it?" → [{"role": "executor", "instruction": "Get the current date and time"}]

Respond ONLY with the JSON array, no other text.`;

    try {
      const response = await this.client.messages.create({
        model: model.id,
        max_tokens: 1024,
        messages: [{ role: 'user', content: planningPrompt }],
      });

      this.costTracker.recordUsage({
        sessionId: 'agent-coordinator',
        model: model.id,
        tokensIn: response.usage.input_tokens,
        tokensOut: response.usage.output_tokens,
      });

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');

      // Parse JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const plan = JSON.parse(jsonMatch[0]) as Array<{ role: string; instruction: string }>;
      return plan
        .filter((d) => ['researcher', 'coder', 'planner', 'executor'].includes(d.role))
        .map((d) => ({ role: d.role as AgentRole, instruction: d.instruction }));

    } catch (err: any) {
      console.error(`[AgentTeam] Planning error:`, err.message);
      return [];
    }
  }

  /**
   * Synthesize results from multiple agent delegations.
   */
  private async synthesizeResults(
    originalInstruction: string,
    delegations: TeamTask['delegations']
  ): Promise<string> {
    const model = MODELS[COORDINATOR_CONFIG.modelTier];

    const resultSummaries = delegations.map((d) => {
      const status = d.result?.success ? 'SUCCESS' : 'FAILED';
      return `[${d.role.toUpperCase()} — ${status}]\nTask: ${d.instruction}\nResult: ${d.result?.output || 'No output'}`;
    }).join('\n\n---\n\n');

    const synthesisPrompt = `You are synthesizing results from multiple specialist agents.

Original request: ${originalInstruction}

Agent results:
${resultSummaries}

Provide a clear, unified response to the original request based on the agent results. Be concise.`;

    try {
      const response = await this.client.messages.create({
        model: model.id,
        max_tokens: 2048,
        messages: [{ role: 'user', content: synthesisPrompt }],
      });

      this.costTracker.recordUsage({
        sessionId: 'agent-coordinator',
        model: model.id,
        tokensIn: response.usage.input_tokens,
        tokensOut: response.usage.output_tokens,
      });

      return response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();

    } catch (err: any) {
      // Fallback: just concatenate results
      return delegations
        .map((d) => `**${d.role}**: ${d.result?.output || 'No output'}`)
        .join('\n\n');
    }
  }

  /**
   * Get info about all agents.
   */
  getAgents() {
    return Array.from(this.agents.values()).map((a) => a.getInfo());
  }

  /**
   * Get a specific agent.
   */
  getAgent(role: AgentRole) {
    return this.agents.get(role)?.getInfo();
  }

  /**
   * Get recent task history.
   */
  getTaskHistory(limit = 10) {
    return this.taskHistory.slice(0, limit).map((t) => ({
      id: t.id,
      instruction: t.instruction.slice(0, 200),
      status: t.status,
      agents: t.delegations.map((d) => d.role),
      durationMs: t.completedAt ? t.completedAt - t.startedAt : Date.now() - t.startedAt,
    }));
  }

  get enabled(): boolean { return this._enabled; }
  set enabled(v: boolean) { this._enabled = v; }
}
