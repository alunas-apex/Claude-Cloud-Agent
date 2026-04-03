import { MODELS, ModelTier, ModelConfig, RoutingRequest, RoutingDecision } from '../types/index.js';
import { getSetting } from '../services/database.js';

/**
 * ModelRouter — Heuristic-based model selection for token efficiency.
 *
 * Routes requests to the optimal Claude model (Haiku/Sonnet/Opus) based on:
 * - Message complexity (length, question words, technical keywords)
 * - Tool requirements (number and type of tools likely needed)
 * - Conversation length (longer conversations need more capable models)
 * - Budget constraints (auto-downgrade when approaching limits)
 *
 * No LLM calls for classification — pure heuristic for zero overhead.
 */

// Keywords that suggest complex reasoning → Opus
const OPUS_KEYWORDS = [
  'analyze', 'architect', 'design', 'plan', 'strategy', 'compare',
  'evaluate', 'recommend', 'optimize', 'debug', 'refactor', 'explain why',
  'trade-off', 'tradeoff', 'pros and cons', 'step by step', 'in detail',
  'comprehensive', 'thorough', 'complex', 'multi-step', 'workflow',
  'code review', 'write code', 'implement', 'build', 'create a',
];

// Keywords that suggest simple tasks → Haiku
const HAIKU_KEYWORDS = [
  'hi', 'hello', 'hey', 'thanks', 'thank you', 'ok', 'okay', 'sure',
  'yes', 'no', 'what time', 'what date', 'today', 'now', 'current',
  'list', 'show', 'get', 'check', 'status', 'how many',
];

// Tool names that suggest multi-tool complex workflows → upgrade to Sonnet/Opus
const COMPLEX_TOOL_PATTERNS = [
  'gcp_', 'admin_', 'create_', 'update_', 'delete_', 'deploy_',
  'manage_', 'configure_', 'build_',
];

// Tool names that are simple lookups → can stay on Haiku
const SIMPLE_TOOL_PATTERNS = [
  'get_current_datetime', 'list_google_accounts', 'search_emails',
  'list_events', 'list_projects',
];

export class ModelRouter {
  /**
   * Select the optimal model for a request using heuristics.
   */
  route(request: RoutingRequest): RoutingDecision {
    // Check for user override in settings
    const override = this.getSettingsOverride();
    if (override) {
      return this.buildDecision(override, 'User-configured model override', request);
    }

    // Check if auto-routing is disabled (default to a specific model)
    const autoRoute = getSetting('model.autoRoute');
    if (autoRoute === 'false') {
      const defaultTier = (getSetting('model.default') as ModelTier) || 'sonnet';
      return this.buildDecision(defaultTier, 'Auto-routing disabled, using default', request);
    }

    // Score the request for complexity
    const score = this.calculateComplexityScore(request);

    // Budget-based downgrade
    if (request.budgetRemaining !== undefined && request.budgetRemaining < 0.01) {
      return this.buildDecision('haiku', 'Budget nearly exhausted, using cheapest model', request);
    }
    if (request.budgetRemaining !== undefined && request.budgetRemaining < 0.10) {
      const tier = score >= 70 ? 'sonnet' : 'haiku';
      return this.buildDecision(tier, `Low budget ($${request.budgetRemaining.toFixed(2)} remaining), downgrading`, request);
    }

    // Route based on complexity score
    let tier: ModelTier;
    let reason: string;

    if (score >= 70) {
      tier = 'opus';
      reason = `High complexity (score: ${score}) — complex reasoning/multi-step task`;
    } else if (score >= 30) {
      tier = 'sonnet';
      reason = `Medium complexity (score: ${score}) — standard task`;
    } else {
      tier = 'haiku';
      reason = `Low complexity (score: ${score}) — simple query/greeting`;
    }

    return this.buildDecision(tier, reason, request);
  }

  /**
   * Calculate a 0-100 complexity score for the request.
   */
  private calculateComplexityScore(request: RoutingRequest): number {
    const { message, conversationLength, toolsRequired } = request;
    const msgLower = message.toLowerCase();
    let score = 0;

    // Message length scoring (0-20 points)
    if (message.length > 500) score += 20;
    else if (message.length > 200) score += 15;
    else if (message.length > 100) score += 10;
    else if (message.length > 50) score += 5;

    // Opus keyword matching (0-30 points)
    const opusMatches = OPUS_KEYWORDS.filter(kw => msgLower.includes(kw)).length;
    score += Math.min(opusMatches * 10, 30);

    // Haiku keyword matching (subtract 0-20 points)
    const haikuMatches = HAIKU_KEYWORDS.filter(kw => msgLower.includes(kw)).length;
    score -= Math.min(haikuMatches * 10, 20);

    // Question complexity (0-10 points)
    const questionWords = (msgLower.match(/\b(why|how|what if|could you|would you|explain|compare)\b/g) || []).length;
    score += Math.min(questionWords * 5, 10);

    // Multi-sentence messages suggest complexity (0-10 points)
    const sentences = message.split(/[.!?]+/).filter((s: string) => s.trim().length > 0).length;
    if (sentences >= 4) score += 10;
    else if (sentences >= 2) score += 5;

    // Conversation length (0-10 points) — longer conversations benefit from smarter models
    if (conversationLength > 15) score += 10;
    else if (conversationLength > 8) score += 5;

    // Tool complexity analysis (0-20 points)
    if (toolsRequired && toolsRequired.length > 0) {
      const complexTools = toolsRequired.filter((t: string) =>
        COMPLEX_TOOL_PATTERNS.some((p: string) => t.startsWith(p))
      ).length;
      const simpleTools = toolsRequired.filter((t: string) =>
        SIMPLE_TOOL_PATTERNS.includes(t)
      ).length;

      if (complexTools >= 3) score += 20;
      else if (complexTools >= 1) score += 10;

      if (toolsRequired.length > 3) score += 10;
      if (simpleTools === toolsRequired.length) score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Check for user-configured model override in settings.
   */
  private getSettingsOverride(): ModelTier | null {
    const forced = getSetting('model.forced');
    if (forced && (forced === 'haiku' || forced === 'sonnet' || forced === 'opus')) {
      return forced as ModelTier;
    }
    return null;
  }

  /**
   * Build a full RoutingDecision from a tier selection.
   */
  private buildDecision(tier: ModelTier, reason: string, request: RoutingRequest): RoutingDecision {
    const model = MODELS[tier];
    const fallbackChain = this.buildFallbackChain(tier);

    // Rough cost estimate based on message length
    const estimatedInputTokens = Math.ceil((request.message.length + request.conversationLength * 200) / 4);
    const estimatedOutputTokens = 500; // conservative default

    return {
      modelId: model.id,
      tier,
      maxTokens: model.maxTokens,
      reason,
      estimatedInputCost: (estimatedInputTokens / 1000) * model.inputCostPer1k,
      estimatedOutputCost: (estimatedOutputTokens / 1000) * model.outputCostPer1k,
      fallbackChain: fallbackChain.map(t => MODELS[t].id),
    };
  }

  /**
   * Build fallback chain: try cheaper models on failure.
   */
  private buildFallbackChain(primary: ModelTier): ModelTier[] {
    switch (primary) {
      case 'opus': return ['sonnet', 'haiku'];
      case 'sonnet': return ['haiku'];
      case 'haiku': return ['sonnet']; // upgrade if haiku can't handle it
    }
  }

  /**
   * Estimate cost for a given model and token counts.
   */
  static estimateCost(model: ModelConfig, tokensIn: number, tokensOut: number): number {
    return (tokensIn / 1000) * model.inputCostPer1k + (tokensOut / 1000) * model.outputCostPer1k;
  }
}
