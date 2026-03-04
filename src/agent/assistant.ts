import Anthropic from '@anthropic-ai/sdk';
import { ToolRegistry } from './tool-registry.js';
import { ConversationMessage } from '../types/index.js';

const MAX_TOOL_ITERATIONS = 10; // Safety cap on agentic loop iterations

const SYSTEM_PROMPT = `You are a highly capable personal assistant with access to Google Workspace (Gmail and Google Calendar) and other tools. You help your user manage their professional life efficiently.

Your capabilities:
- Read, search, compose, send, and reply to emails via Gmail
- View, create, update, and delete Google Calendar events
- Create Google Meet video conference links for meetings
- Know the current date and time

Personality & style:
- Be concise and direct — your responses are delivered via SMS, so keep them brief unless the user asks for detail
- Confirm completed actions clearly (e.g. "Done — email sent to alice@example.com")
- When listing items (emails, events), use a numbered or bulleted format that's readable on mobile
- If you need to do multiple things, do them all before responding
- Proactively include relevant details (e.g. include meeting link when creating calendar events)
- If something fails, explain clearly and suggest what to do next

Privacy & safety:
- Never share the contents of emails or calendar events with third parties
- Ask for confirmation before deleting events or sending emails to unfamiliar addresses
- If unsure of the user's intent, ask a clarifying question

When you don't know the current date/time (e.g. for scheduling), always call get_current_datetime first.`;

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
