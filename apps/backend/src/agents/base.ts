import Anthropic from '@anthropic-ai/sdk';
import { ModelTier, MODELS } from '../types/index.js';
import { ToolRegistry } from '../agent/tool-registry.js';
import { CostTracker } from '../agent/cost-tracker.js';
import { eventBus } from '../services/event-bus.js';
import { logToolExecution } from '../services/database.js';

export type AgentRole = 'coordinator' | 'researcher' | 'coder' | 'planner' | 'executor';

export type AgentStatus = 'idle' | 'busy' | 'error';

export interface AgentConfig {
  role: AgentRole;
  name: string;
  description: string;
  systemPrompt: string;
  modelTier: ModelTier;
  toolCategories?: string[];  // restrict to specific tool categories
  maxIterations?: number;
}

export interface AgentTask {
  id: string;
  instruction: string;
  context?: string;
  parentTaskId?: string;
  delegatedBy?: AgentRole;
}

export interface AgentResult {
  taskId: string;
  agentRole: AgentRole;
  success: boolean;
  output: string;
  toolCalls: number;
  tokensUsed: { input: number; output: number };
  durationMs: number;
}

/**
 * SpecialistAgent — A focused AI agent with a specific role, system prompt,
 * model tier, and optional tool restrictions.
 *
 * Each specialist runs its own agentic loop with tool use,
 * reporting results back to the coordinator.
 */
export class SpecialistAgent {
  private client: Anthropic;
  private config: AgentConfig;
  private registry: ToolRegistry;
  private costTracker: CostTracker;
  private _status: AgentStatus = 'idle';
  private _tasksCompleted = 0;

  constructor(config: AgentConfig, registry: ToolRegistry, costTracker: CostTracker) {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.config = config;
    this.registry = registry;
    this.costTracker = costTracker;
  }

  get role(): AgentRole { return this.config.role; }
  get name(): string { return this.config.name; }
  get description(): string { return this.config.description; }
  get modelTier(): ModelTier { return this.config.modelTier; }
  get status(): AgentStatus { return this._status; }
  get tasksCompleted(): number { return this._tasksCompleted; }

  /**
   * Execute a task using this agent's specialized configuration.
   */
  async execute(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();
    this._status = 'busy';
    let totalToolCalls = 0;
    let totalTokensIn = 0;
    let totalTokensOut = 0;

    eventBus.emit('agent:executing', {
      role: this.config.role,
      taskId: task.id,
      instruction: task.instruction.slice(0, 100),
    });

    try {
      const model = MODELS[this.config.modelTier];
      const maxIterations = this.config.maxIterations || 8;

      // Get tools — filtered by category if specified
      const tools = this.config.toolCategories?.length
        ? this.registry.getToolsByCategories(this.config.toolCategories)
        : this.registry.getTools();

      // Build messages
      const userContent = task.context
        ? `Context from ${task.delegatedBy || 'user'}:\n${task.context}\n\nTask:\n${task.instruction}`
        : task.instruction;

      const messages: Anthropic.MessageParam[] = [
        { role: 'user', content: userContent },
      ];

      let iteration = 0;

      while (iteration < maxIterations) {
        iteration++;

        const response = await this.client.messages.create({
          model: model.id,
          max_tokens: model.maxTokens,
          system: this.config.systemPrompt,
          tools,
          messages,
        });

        totalTokensIn += response.usage.input_tokens;
        totalTokensOut += response.usage.output_tokens;

        this.costTracker.recordUsage({
          sessionId: `agent-${this.config.role}`,
          model: model.id,
          tokensIn: response.usage.input_tokens,
          tokensOut: response.usage.output_tokens,
        });

        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
        );
        const textBlocks = response.content.filter(
          (b): b is Anthropic.TextBlock => b.type === 'text'
        );

        if (response.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
          const output = textBlocks.map((b) => b.text).join('\n').trim() || 'Done.';
          this._status = 'idle';
          this._tasksCompleted++;

          const result: AgentResult = {
            taskId: task.id,
            agentRole: this.config.role,
            success: true,
            output,
            toolCalls: totalToolCalls,
            tokensUsed: { input: totalTokensIn, output: totalTokensOut },
            durationMs: Date.now() - startTime,
          };

          eventBus.emit('agent:completed', result);
          return result;
        }

        messages.push({ role: 'assistant', content: response.content });

        const toolResults = await Promise.all(
          toolUseBlocks.map(async (block) => {
            totalToolCalls++;
            const toolInput = block.input as Record<string, unknown>;
            const toolStart = Date.now();

            eventBus.emitToolStart({
              sessionId: `agent-${this.config.role}`,
              toolName: block.name,
              input: toolInput,
            });

            let result: string;
            let status: 'success' | 'error' = 'success';

            try {
              result = await this.registry.execute(block.name, toolInput);
            } catch (err: any) {
              result = `Error: ${err?.message ?? String(err)}`;
              status = 'error';
            }

            const durationMs = Date.now() - toolStart;
            logToolExecution(`agent-${this.config.role}`, block.name, toolInput, result, durationMs, status);
            eventBus.emitToolComplete({
              sessionId: `agent-${this.config.role}`,
              toolName: block.name,
              result: result.slice(0, 500),
              durationMs,
              status,
            });

            // Truncate long results
            const truncated = result.length > 2000
              ? result.slice(0, 2000) + `\n...[truncated]`
              : result;

            return {
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: truncated,
            };
          })
        );

        messages.push({ role: 'user', content: toolResults });
      }

      // Max iterations reached
      this._status = 'idle';
      this._tasksCompleted++;
      return {
        taskId: task.id,
        agentRole: this.config.role,
        success: false,
        output: 'Agent reached maximum iterations without completing the task.',
        toolCalls: totalToolCalls,
        tokensUsed: { input: totalTokensIn, output: totalTokensOut },
        durationMs: Date.now() - startTime,
      };

    } catch (err: any) {
      this._status = 'error';
      eventBus.emit('agent:error', { role: this.config.role, taskId: task.id, error: err.message });
      return {
        taskId: task.id,
        agentRole: this.config.role,
        success: false,
        output: `Agent error: ${err.message}`,
        toolCalls: totalToolCalls,
        tokensUsed: { input: totalTokensIn, output: totalTokensOut },
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Get agent info for API/dashboard.
   */
  getInfo() {
    return {
      role: this.config.role,
      name: this.config.name,
      description: this.config.description,
      modelTier: this.config.modelTier,
      modelId: MODELS[this.config.modelTier].id,
      status: this._status,
      tasksCompleted: this._tasksCompleted,
      toolCategories: this.config.toolCategories || [],
    };
  }
}
