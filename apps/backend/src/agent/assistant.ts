import Anthropic from '@anthropic-ai/sdk';
import { ToolRegistry } from './tool-registry.js';
import { ConversationMessage } from '../types/index.js';

const MAX_TOOL_ITERATIONS = 10; // Safety cap on agentic loop iterations

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

  constructor(registry: ToolRegistry) {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.registry = registry;
  }

  async chat(
    history: ConversationMessage[],
    userMessage: string
  ): Promise<string> {
    // Build messages array from history + new user message
    const messages: Anthropic.MessageParam[] = [
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: userMessage },
    ];

    let iteration = 0;

    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++;

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: this.registry.getTools(),
        messages,
      });

      // Collect tool use blocks and text blocks
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      );
      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === 'text'
      );

      // If no tool calls, we have the final answer
      if (response.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
        return textBlocks.map((b) => b.text).join('\n').trim() || 'Done.';
      }

      // Append the assistant's response to the conversation
      messages.push({ role: 'assistant', content: response.content });

      // Execute all tool calls in parallel
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => {
          console.log(`[Agent] Calling tool: ${block.name}`, block.input);
          const result = await this.registry.execute(
            block.name,
            block.input as Record<string, unknown>
          );
          console.log(`[Agent] Tool ${block.name} result (${result.length} chars)`);
          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: result,
          };
        })
      );

      // Append tool results and loop
      messages.push({ role: 'user', content: toolResults });
    }

    return 'I ran into an issue completing your request (too many steps). Please try again with a more specific request.';
  }
}
