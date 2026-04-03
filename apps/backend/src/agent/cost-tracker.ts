import { MODELS, ModelTier, ModelConfig, BudgetStatus, CostBreakdown } from '../types/index.js';
import { insertCost, updateSessionCost, getTodayCost, getSetting } from '../services/database.js';
import { eventBus } from '../services/event-bus.js';

const DEFAULT_DAILY_BUDGET = 10.0;  // $10/day
const DEFAULT_SESSION_BUDGET = 2.0; // $2/session

/**
 * CostTracker — Tracks token usage, calculates costs, enforces budgets.
 *
 * Records every API call's token usage to the cost_ledger table,
 * updates session totals, emits cost events, and checks budget limits.
 */
export class CostTracker {
  // In-memory session cost tracking (for budget checks without DB queries)
  private sessionCosts: Map<string, number> = new Map();
  // In-memory daily tracking (refreshed from DB periodically)
  private dailyCostCache: number = 0;
  private dailyCostCacheTime: number = 0;

  // In-memory cost breakdown by model for the current day
  private modelBreakdown: Map<string, { tokensIn: number; tokensOut: number; costUsd: number; requests: number }> = new Map();

  /**
   * Record an API call's token usage and cost.
   */
  recordUsage(params: {
    sessionId: string | null;
    model: string;
    tokensIn: number;
    tokensOut: number;
  }): { costUsd: number } {
    const { sessionId, model, tokensIn, tokensOut } = params;

    // Find the model config to calculate cost
    const modelConfig = this.findModelConfig(model);
    const costUsd = modelConfig
      ? (tokensIn / 1000) * modelConfig.inputCostPer1k + (tokensOut / 1000) * modelConfig.outputCostPer1k
      : 0;

    // Persist to cost_ledger
    insertCost(sessionId, model, tokensIn, tokensOut, costUsd);

    // Update session totals
    if (sessionId) {
      updateSessionCost(sessionId, tokensIn, tokensOut, costUsd);
      const current = this.sessionCosts.get(sessionId) || 0;
      this.sessionCosts.set(sessionId, current + costUsd);
    }

    // Update in-memory daily cache
    this.dailyCostCache += costUsd;

    // Update model breakdown
    const existing = this.modelBreakdown.get(model) || { tokensIn: 0, tokensOut: 0, costUsd: 0, requests: 0 };
    existing.tokensIn += tokensIn;
    existing.tokensOut += tokensOut;
    existing.costUsd += costUsd;
    existing.requests += 1;
    this.modelBreakdown.set(model, existing);

    // Emit cost event for dashboard
    eventBus.emitCostIncurred({
      sessionId: sessionId || undefined,
      model,
      tokensIn,
      tokensOut,
      costUsd,
    });

    return { costUsd };
  }

  /**
   * Get budget status for routing decisions.
   */
  getBudgetStatus(sessionId?: string): BudgetStatus {
    const dailyBudget = parseFloat(getSetting('budget.daily') || String(DEFAULT_DAILY_BUDGET));
    const sessionBudget = parseFloat(getSetting('budget.session') || String(DEFAULT_SESSION_BUDGET));
    const autoDowngrade = getSetting('budget.autoDowngrade') !== 'false';

    // Refresh daily cost from DB if cache is stale (>60s)
    const now = Date.now();
    if (now - this.dailyCostCacheTime > 60_000) {
      this.dailyCostCache = getTodayCost();
      this.dailyCostCacheTime = now;
    }

    const sessionSpent = sessionId ? (this.sessionCosts.get(sessionId) || 0) : 0;

    return {
      dailyBudgetUsd: dailyBudget,
      dailySpentUsd: this.dailyCostCache,
      dailyRemainingUsd: Math.max(0, dailyBudget - this.dailyCostCache),
      sessionBudgetUsd: sessionBudget,
      sessionSpentUsd: sessionSpent,
      sessionRemainingUsd: Math.max(0, sessionBudget - sessionSpent),
      isOverBudget: this.dailyCostCache >= dailyBudget || sessionSpent >= sessionBudget,
      autoDowngrade,
    };
  }

  /**
   * Get the remaining budget for routing (lowest of daily/session remaining).
   */
  getBudgetRemaining(sessionId?: string): number {
    const status = this.getBudgetStatus(sessionId);
    return Math.min(status.dailyRemainingUsd, status.sessionRemainingUsd);
  }

  /**
   * Get cost breakdown by model for dashboard display.
   */
  getCostBreakdown(): CostBreakdown {
    const byModel: CostBreakdown['byModel'] = {};
    let totalIn = 0, totalOut = 0, totalCost = 0, totalReqs = 0;

    for (const [model, data] of this.modelBreakdown) {
      byModel[model] = { ...data };
      totalIn += data.tokensIn;
      totalOut += data.tokensOut;
      totalCost += data.costUsd;
      totalReqs += data.requests;
    }

    return {
      byModel,
      total: { tokensIn: totalIn, tokensOut: totalOut, costUsd: totalCost, requests: totalReqs },
    };
  }

  /**
   * Reset session tracking (e.g., when session ends).
   */
  clearSession(sessionId: string): void {
    this.sessionCosts.delete(sessionId);
  }

  private findModelConfig(modelId: string): ModelConfig | undefined {
    return Object.values(MODELS).find(m => m.id === modelId);
  }
}
