/**
 * Heuristic Engine - Phase 18b (T106a) + Phase 21 (T291)
 *
 * Core engine for running heuristic rules against page state.
 */

import type { PageState, CROInsight, BusinessType, PageType } from '../models/index.js';
import type { HeuristicRule, HeuristicResult, HeuristicEngineOptions } from './types.js';
import { createLogger } from '../utils/index.js';

const logger = createLogger('HeuristicEngine');

/**
 * Heuristic engine for running CRO rules
 */
export class HeuristicEngine {
  private rules: Map<string, HeuristicRule> = new Map();

  /**
   * Register a heuristic rule
   * @throws Error if rule with same ID already registered
   */
  register(rule: HeuristicRule): void {
    if (this.rules.has(rule.id)) {
      throw new Error(`Rule already registered: ${rule.id}`);
    }
    this.rules.set(rule.id, rule);
    logger.debug(`Registered heuristic rule: ${rule.id} (${rule.name})`);
  }

  /**
   * Register multiple rules at once
   * @throws Error if any rule has duplicate ID
   */
  registerAll(rules: HeuristicRule[]): void {
    for (const rule of rules) {
      this.register(rule);
    }
  }

  /**
   * Get a rule by ID
   */
  getRule(id: string): HeuristicRule | undefined {
    return this.rules.get(id);
  }

  /**
   * Get all registered rules
   */
  getAllRules(): HeuristicRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get count of registered rules
   */
  getRuleCount(): number {
    return this.rules.size;
  }

  /**
   * Clear all registered rules
   */
  clear(): void {
    this.rules.clear();
    logger.debug('Cleared all heuristic rules');
  }

  /**
   * Run all applicable rules against page state
   * @param state - Current page state with DOM tree
   * @param businessType - Detected business type for filtering
   * @param pageType - Detected page type for filtering (optional, Phase 21)
   * @param options - Optional filtering options
   */
  run(
    state: PageState,
    businessType: BusinessType,
    pageType?: PageType,
    options: HeuristicEngineOptions = {}
  ): HeuristicResult {
    const startTime = Date.now();
    const insights: CROInsight[] = [];
    let rulesExecuted = 0;
    let rulesPassed = 0;
    let rulesFailed = 0;

    const { categories, ruleIds, filterByBusinessType = true, filterByPageType = true } = options;

    for (const rule of this.rules.values()) {
      // Filter by rule IDs if specified
      if (ruleIds && !ruleIds.includes(rule.id)) {
        continue;
      }

      // Filter by categories if specified
      if (categories && !categories.includes(rule.category)) {
        continue;
      }

      // Filter by business type if enabled
      if (
        filterByBusinessType &&
        rule.businessTypes.length > 0 &&
        !rule.businessTypes.includes(businessType)
      ) {
        logger.debug(
          `Skipping rule ${rule.id}: business type ${businessType} not in ${rule.businessTypes.join(', ')}`
        );
        continue;
      }

      // Filter by page type if enabled (Phase 21)
      if (
        filterByPageType &&
        rule.pageTypes &&
        rule.pageTypes.length > 0 &&
        pageType &&
        !rule.pageTypes.includes(pageType)
      ) {
        logger.debug(
          `Skipping rule ${rule.id}: page type ${pageType} not in ${rule.pageTypes.join(', ')}`
        );
        continue;
      }

      rulesExecuted++;

      try {
        const insight = rule.check(state, businessType, pageType);
        if (insight) {
          insights.push(insight);
          rulesFailed++;
          logger.debug(`Rule ${rule.id} found violation: ${insight.type}`);
        } else {
          rulesPassed++;
          logger.debug(`Rule ${rule.id} passed`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`Rule ${rule.id} threw error: ${errorMsg}`);
        // Count as failed but don't generate insight for rule error
        rulesFailed++;
      }
    }

    const executionTimeMs = Date.now() - startTime;

    logger.info(`Heuristics complete`, {
      rulesExecuted,
      rulesPassed,
      rulesFailed,
      insightCount: insights.length,
      durationMs: executionTimeMs,
    });

    return {
      insights,
      rulesExecuted,
      rulesPassed,
      rulesFailed,
      executionTimeMs,
    };
  }
}

/**
 * Create a new heuristic engine instance
 */
export function createHeuristicEngine(): HeuristicEngine {
  return new HeuristicEngine();
}
