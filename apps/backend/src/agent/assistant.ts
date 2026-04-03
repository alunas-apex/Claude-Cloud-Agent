import Anthropic from '@anthropic-ai/sdk';
import { ToolRegistry } from './tool-registry.js';
import { ModelRouter } from './model-router.js';
import { CostTracker } from './cost-tracker.js';
import { ConversationMessage } from '../types/index.js';
import { eventBus } from '../services/event-bus.js';
import { logToolExecution } from '../services/database.js';
import { getSetting } from '../services/database.js';

const MAX_TOOL_ITERATIONS = 10;

const SYSTEM_PROMPT = `You are a highly capable personal assistant with full access to Google Workspace, Google Cloud Platform, and Google Workspace Admin. You help your user manage their professional life and cloud infrastructure efficiently.

Your capabilities:
- Email: Read, search, compose, send, and reply to emails via Gmail
- Calendar: View, create, update, and delete Google Calendar events; create Google Meet links
- Google Cloud Platform (GCP): List and create projects; manage IAM policies and service accounts;
  enable APIs; trigger Cloud Builds; deploy Cloud Run services; manage Cloud Storage buckets
- Google Workspace Admin: Manage users (create, update, suspend), groups, and organisational units;
  view admin audit logs
- Multiple Google accounts: The user can connect multiple Google accounts (e.g. "primary", "work",
  "personal"). Use list_google_accounts to see connected accounts. Pass accountId to any tool to
  target a specific account. If the user mentions "my work email" or "work account", use accountId="work".
- Current date and time

Personality & style:
- Be concise and direct — your responses are delivered via SMS, so keep them brief unless the user asks for detail
- Confirm completed actions clearly (e.g. "Done — email sent to alice@example.com")
- When listing items (emails, events, projects), use a numbered or bulleted format readable on mobile
- If you need to do multiple things, do them all before responding
- Proactively include relevant details (e.g. include meeting link when creating events, include service URL after deploying)
- If something fails, explain clearly and suggest what to do next
- For GCP and Admin actions that are destructive or affect other users, briefly confirm the action before executing unless the user has already confirmed intent

Privacy & safety:
- Never share email contents or calendar details with third parties
- Ask for confirmation before: deleting resources, suspending users, removing IAM bindings
- If unsure of the user's intent, ask a clarifying question

When you don't know the current date/time (e.g. for scheduling), always call get_current_datetime first.
When the user doesn't specify an account, use the default account. When they say "work", "personal", etc., map to the corresponding accountId.`;

export class Assistant {
  private client: Anthropic;
  private registry: ToolRegistry;
  private router: ModelRouter;
  private costTracker: CostTracker;

  constructor(registry: ToolRegistry, router?: ModelRouter, costTracker?: CostTracker) {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.registry = registry;
    this.router = router || new ModelRouter();
    this.costTracker = costTracker || new CostTracker();
  }

  getRouter(): ModelRouter { return this.router; }
  getCostTracker(): CostTracker { return this.costTracker; }

  async chat(
    history: ConversationMessage[],
    userMessage: string,
    sessionId?: string,
    channel?: string
  ): Promise<string> {
    // Route to optimal model
    const budgetRemaining = this.costTracker.getBudgetRemaining(sessionId);
    const routingDecision = this.router.route({
      message: userMessage,
      conversationLength: history.length,
      channel,
      budgetRemaining,
    });

    console.log(`[Agent] Model: ${routingDecision.tier} (${routingDecision.reason})`);

    // Select tools — use selective inclusion based on message if enabled
    const pruneTools = getSetting('model.pruneTools') !== 'false';
    const tools = pruneTools
      ? this.registry.getRelevantTools(userMessage)
      : this.registry.getTools();

    console.log(`[Agent] Tools: ${tools.length}/${this.registry.getTools().length} included`);

    // Build messages
    const messages: Anthropic.MessageParam[] = [
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: userMessage },
    ];

    // Try with primary model, then fallback chain
    const modelsToTry = [routingDecision.modelId, ...routingDecision.fallbackChain];

    for (let modelIdx = 0; modelIdx < modelsToTry.length; modelIdx++) {
      const modelId = modelsToTry[modelIdx];
      const isFallback = modelIdx > 0;

      if (isFallback) {
        console.log(`[Agent] Falling back to model: ${modelId}`);
      }

      try {
        return await this.runAgentLoop(
          modelId,
          routingDecision.maxTokens,
          tools,
          [...messages], // clone so retries start fresh
          sessionId || null,
        );
      } catch (err: any) {
        // If rate limited or overloaded, try next model in chain
        if (err?.status === 429 || err?.status === 529) {
          console.warn(`[Agent] Model ${modelId} returned ${err.status}, trying fallback...`);
          continue;
        }
        // For other errors, throw immediately
        throw err;
      }
    }

    // All models failed
    throw new Error('All models in fallback chain failed (rate limited)');
  }

  private async runAgentLoop(
    modelId: string,
    maxTokens: number,
    tools: Anthropic.Tool[],
    messages: Anthropic.MessageParam[],
    sessionId: string | null,
  ): Promise<string> {
    let iteration = 0;

    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++;

      const response = await this.client.messages.create({
        model: modelId,
        max_tokens: maxTokens,
        system: SYSTEM_PROMPT,
        tools,
        messages,
      });

      // Track cost
      this.costTracker.recordUsage({
        sessionId,
        model: modelId,
        tokensIn: response.usage.input_tokens,
        tokensOut: response.usage.output_tokens,
      });

      // Collect blocks
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      );
      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === 'text'
      );

      // If no tool calls, return final answer
      if (response.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
        return textBlocks.map((b) => b.text).join('\n').trim() || 'Done.';
      }

      // Append assistant response
      messages.push({ role: 'assistant', content: response.content });

      // Execute all tool calls in parallel with event tracking
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => {
          const startTime = Date.now();
          const toolInput = block.input as Record<string, unknown>;

          console.log(`[Agent] Calling tool: ${block.name}`, toolInput);

          // Emit tool start event
          eventBus.emitToolStart({
            sessionId: sessionId || 'unknown',
            toolName: block.name,
            input: toolInput,
          });

          let result: string;
          let status: 'success' | 'error' = 'success';
          let error: string | undefined;

          try {
            result = await this.registry.execute(block.name, toolInput);
          } catch (err: any) {
            result = `Error: ${err?.message ?? String(err)}`;
            status = 'error';
            error = err?.message;
          }

          const durationMs = Date.now() - startTime;

          // Log tool execution to DB
          logToolExecution(sessionId, block.name, toolInput, result, durationMs, status, error);

          // Emit tool complete event
          eventBus.emitToolComplete({
            sessionId: sessionId || 'unknown',
            toolName: block.name,
            result: result.slice(0, 500),
            durationMs,
            status,
          });

          console.log(`[Agent] Tool ${block.name} ${status} (${durationMs}ms, ${result.length} chars)`);

          // Truncate long tool results to save tokens
          const maxResultLength = parseInt(getSetting('model.maxToolResult') || '2000', 10);
          const truncatedResult = result.length > maxResultLength
            ? result.slice(0, maxResultLength) + `\n...[truncated ${result.length - maxResultLength} chars]`
            : result;

          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: truncatedResult,
          };
        })
      );

      // Append tool results and loop
      messages.push({ role: 'user', content: toolResults });
    }

    return 'I ran into an issue completing your request (too many steps). Please try again with a more specific request.';
  }
}
