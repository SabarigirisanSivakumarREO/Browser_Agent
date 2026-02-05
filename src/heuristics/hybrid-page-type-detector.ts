/**
 * Hybrid Page Type Detector - Phase 24 (T465-T469)
 *
 * Three-tier detection strategy:
 * 1. Playwright-based detection (PRIMARY) - Rich DOM analysis
 * 2. URL/selector heuristics (SECONDARY) - Fast pattern matching
 * 3. LLM vision (FALLBACK) - Only when both tiers uncertain (~10% of cases)
 */

import type { Page } from 'playwright';
import type { PageType, PageTypeResult } from '../models/page-type.js';
import type { PageState } from '../models/index.js';
import { createLogger } from '../utils/index.js';

import {
  PlaywrightPageTypeDetector,
  createPlaywrightPageTypeDetector,
  type PlaywrightDetectionResult,
} from './playwright-page-detector.js';
import { PageTypeDetector, createPageTypeDetector } from './page-type-detector.js';
import {
  LLMPageTypeDetector,
  createLLMPageTypeDetector,
  type LLMDetectionResult,
} from './llm-page-type-detector.js';
import {
  DomainPatternCache,
  createDomainPatternCache,
  type CachedDetectionResult,
} from './domain-pattern-cache.js';

const logger = createLogger('HybridPageTypeDetector');

/**
 * Configuration for hybrid detection
 */
export interface HybridDetectionConfig {
  /** Enable Playwright-based detection (default: true) */
  enablePlaywrightDetection: boolean;
  /** Playwright confidence threshold to skip other tiers (default: 0.7) */
  playwrightConfidenceThreshold: number;
  /** Enable URL heuristic detection (default: true) */
  enableHeuristicDetection: boolean;
  /** Enable LLM fallback (default: true) */
  enableLLMFallback: boolean;
  /** Combined confidence threshold to trigger LLM (default: 0.5) */
  llmFallbackThreshold: number;
  /** LLM timeout in milliseconds (default: 10000) */
  llmDetectionTimeout: number;
  /** Enable domain caching (default: true) */
  enableDomainCache: boolean;
  /** Force LLM detection (skip Playwright/heuristic) */
  forceLLMDetection: boolean;
  /** Vision model for LLM fallback */
  llmModel: 'gpt-4o' | 'gpt-4o-mini';
}

const DEFAULT_HYBRID_CONFIG: HybridDetectionConfig = {
  enablePlaywrightDetection: true,
  playwrightConfidenceThreshold: 0.7,
  enableHeuristicDetection: true,
  enableLLMFallback: true,
  llmFallbackThreshold: 0.5,
  llmDetectionTimeout: 10000,
  enableDomainCache: true,
  forceLLMDetection: false,
  llmModel: 'gpt-4o-mini',
};

/**
 * Combined result from hybrid detection
 */
export interface HybridDetectionResult {
  /** Final detected page type */
  pageType: PageType;
  /** Final confidence score 0-1 */
  confidence: number;
  /** Detection tier that produced the final result */
  tier: 'cache' | 'playwright' | 'heuristic' | 'combined' | 'llm';
  /** Signals that led to detection */
  signals: string[];
  /** Time taken for detection in milliseconds */
  detectionTimeMs: number;
  /** Playwright result if available */
  playwrightResult?: PlaywrightDetectionResult;
  /** Heuristic result if available */
  heuristicResult?: PageTypeResult;
  /** LLM result if used */
  llmResult?: LLMDetectionResult;
  /** Was result from cache? */
  fromCache: boolean;
}

/**
 * Hybrid page type detector that combines three detection strategies.
 */
export class HybridPageTypeDetector {
  private config: HybridDetectionConfig;
  private playwrightDetector: PlaywrightPageTypeDetector;
  private heuristicDetector: PageTypeDetector;
  private llmDetector: LLMPageTypeDetector;
  private cache: DomainPatternCache;

  constructor(
    config: Partial<HybridDetectionConfig> = {},
    playwrightDetector?: PlaywrightPageTypeDetector,
    heuristicDetector?: PageTypeDetector,
    llmDetector?: LLMPageTypeDetector,
    cache?: DomainPatternCache
  ) {
    this.config = { ...DEFAULT_HYBRID_CONFIG, ...config };
    this.playwrightDetector = playwrightDetector ?? createPlaywrightPageTypeDetector();
    this.heuristicDetector = heuristicDetector ?? createPageTypeDetector();
    this.llmDetector =
      llmDetector ??
      createLLMPageTypeDetector({
        model: this.config.llmModel,
        timeout: this.config.llmDetectionTimeout,
      });
    this.cache = cache ?? createDomainPatternCache();
  }

  /**
   * Detect page type using three-tier hybrid strategy
   * @param page - Playwright Page object
   * @param state - Page state with DOM tree (for heuristic tier)
   */
  async detect(page: Page, state: PageState): Promise<HybridDetectionResult> {
    const startTime = Date.now();
    const signals: string[] = [];

    logger.info(`Starting hybrid detection for: ${state.url}`);

    // Force LLM detection if configured
    if (this.config.forceLLMDetection) {
      logger.info('Force LLM detection enabled, skipping other tiers');
      return this.runLLMDetection(page, state, startTime, signals);
    }

    // 1. Check cache first
    if (this.config.enableDomainCache) {
      const cached = this.cache.get(state.url);
      if (cached) {
        signals.push('Cache hit for domain');
        logger.info(`Cache hit: ${cached.pageType} (confidence: ${cached.confidence})`);
        return {
          pageType: cached.pageType,
          confidence: cached.confidence,
          tier: 'cache',
          signals,
          detectionTimeMs: Date.now() - startTime,
          fromCache: true,
        };
      }
    }

    // 2. Tier 1: Playwright detection (PRIMARY)
    let playwrightResult: PlaywrightDetectionResult | undefined;

    if (this.config.enablePlaywrightDetection) {
      try {
        playwrightResult = await this.playwrightDetector.detect(page, state.url);
        signals.push(
          `Playwright: ${playwrightResult.pageType} (${(playwrightResult.confidence * 100).toFixed(0)}%)`
        );

        // If confident, return early
        if (playwrightResult.confidence >= this.config.playwrightConfidenceThreshold) {
          logger.info(
            `Playwright confident: ${playwrightResult.pageType} (${playwrightResult.confidence})`
          );
          this.cacheResult(state.url, playwrightResult.pageType, playwrightResult.confidence, 'playwright');
          return {
            pageType: playwrightResult.pageType,
            confidence: playwrightResult.confidence,
            tier: 'playwright',
            signals,
            detectionTimeMs: Date.now() - startTime,
            playwrightResult,
            fromCache: false,
          };
        }
      } catch (error) {
        logger.warn('Playwright detection failed', { error });
        signals.push('Playwright: failed');
      }
    }

    // 3. Tier 2: URL/selector heuristics (SECONDARY)
    let heuristicResult: PageTypeResult | undefined;

    if (this.config.enableHeuristicDetection) {
      try {
        heuristicResult = this.heuristicDetector.detect(state);
        signals.push(
          `Heuristic: ${heuristicResult.type} (${(heuristicResult.confidence * 100).toFixed(0)}%)`
        );
      } catch (error) {
        logger.warn('Heuristic detection failed', { error });
        signals.push('Heuristic: failed');
      }
    }

    // 4. Combine Tier 1 and Tier 2 results
    const combined = this.combineResults(playwrightResult, heuristicResult);
    signals.push(`Combined: ${combined.pageType} (${(combined.confidence * 100).toFixed(0)}%)`);

    // If combined is confident enough, return
    if (combined.confidence >= 0.6) {
      logger.info(`Combined confident: ${combined.pageType} (${combined.confidence})`);
      this.cacheResult(state.url, combined.pageType, combined.confidence, 'combined');
      return {
        pageType: combined.pageType,
        confidence: combined.confidence,
        tier: 'combined',
        signals,
        detectionTimeMs: Date.now() - startTime,
        playwrightResult,
        heuristicResult,
        fromCache: false,
      };
    }

    // 5. Tier 3: LLM fallback (only when uncertain)
    if (
      this.config.enableLLMFallback &&
      combined.confidence < this.config.llmFallbackThreshold
    ) {
      logger.info('Both tiers uncertain, invoking LLM fallback');
      return this.runLLMDetection(page, state, startTime, signals, playwrightResult, heuristicResult);
    }

    // Return combined result even if below threshold (LLM disabled or threshold not met)
    logger.info(`Final result (no LLM): ${combined.pageType} (${combined.confidence})`);
    this.cacheResult(state.url, combined.pageType, combined.confidence, 'combined');
    return {
      pageType: combined.pageType,
      confidence: combined.confidence,
      tier: 'combined',
      signals,
      detectionTimeMs: Date.now() - startTime,
      playwrightResult,
      heuristicResult,
      fromCache: false,
    };
  }

  /**
   * Run LLM detection (Tier 3)
   */
  private async runLLMDetection(
    page: Page,
    state: PageState,
    startTime: number,
    signals: string[],
    playwrightResult?: PlaywrightDetectionResult,
    heuristicResult?: PageTypeResult
  ): Promise<HybridDetectionResult> {
    try {
      // Capture screenshot for LLM
      const screenshot = await page.screenshot({ type: 'jpeg', quality: 80 });
      const llmResult = await this.llmDetector.detect(screenshot, state.url, state.title);

      signals.push(`LLM: ${llmResult.pageType} (${(llmResult.confidence * 100).toFixed(0)}%)`);
      logger.info(`LLM result: ${llmResult.pageType} (${llmResult.confidence})`);

      // Cache the LLM result
      this.cacheResult(state.url, llmResult.pageType, llmResult.confidence, 'llm');

      return {
        pageType: llmResult.pageType,
        confidence: llmResult.confidence,
        tier: 'llm',
        signals,
        detectionTimeMs: Date.now() - startTime,
        playwrightResult,
        heuristicResult,
        llmResult,
        fromCache: false,
      };
    } catch (error) {
      logger.error('LLM fallback failed', { error });
      signals.push('LLM: failed');

      // Fall back to combined or 'other'
      const combined = this.combineResults(playwrightResult, heuristicResult);
      return {
        pageType: combined.pageType || 'other',
        confidence: combined.confidence || 0.3,
        tier: 'combined',
        signals,
        detectionTimeMs: Date.now() - startTime,
        playwrightResult,
        heuristicResult,
        fromCache: false,
      };
    }
  }

  /**
   * Combine Playwright and heuristic results
   * Weight: Playwright 70%, Heuristic 30%
   */
  private combineResults(
    playwrightResult?: PlaywrightDetectionResult,
    heuristicResult?: PageTypeResult
  ): { pageType: PageType; confidence: number } {
    // If only one result available, use it
    if (!playwrightResult && !heuristicResult) {
      return { pageType: 'other', confidence: 0.3 };
    }

    if (!playwrightResult) {
      return {
        pageType: heuristicResult!.type,
        confidence: heuristicResult!.confidence * 0.7, // Reduce confidence without Playwright
      };
    }

    if (!heuristicResult) {
      return {
        pageType: playwrightResult.pageType,
        confidence: playwrightResult.confidence,
      };
    }

    // Both results available - weight them
    const playwrightWeight = 0.7;
    const heuristicWeight = 0.3;

    // If they agree, boost confidence
    if (playwrightResult.pageType === heuristicResult.type) {
      const combinedConfidence = Math.min(
        1.0,
        playwrightResult.confidence * playwrightWeight +
          heuristicResult.confidence * heuristicWeight +
          0.1 // Agreement bonus
      );
      return {
        pageType: playwrightResult.pageType,
        confidence: combinedConfidence,
      };
    }

    // They disagree - prefer Playwright (more signals)
    // But reduce confidence due to disagreement
    const disagreementPenalty = 0.15;
    const playwrightScore = playwrightResult.confidence * playwrightWeight;
    const heuristicScore = heuristicResult.confidence * heuristicWeight;

    if (playwrightScore >= heuristicScore) {
      return {
        pageType: playwrightResult.pageType,
        confidence: Math.max(0.3, playwrightResult.confidence - disagreementPenalty),
      };
    } else {
      return {
        pageType: heuristicResult.type,
        confidence: Math.max(0.3, heuristicResult.confidence - disagreementPenalty),
      };
    }
  }

  /**
   * Cache detection result
   */
  private cacheResult(
    url: string,
    pageType: PageType,
    confidence: number,
    tier: CachedDetectionResult['tier']
  ): void {
    if (!this.config.enableDomainCache) return;

    this.cache.set(url, {
      pageType,
      confidence,
      tier,
    });
  }

  /**
   * Clear the domain cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; domains: string[] } {
    return {
      size: this.cache.size(),
      domains: this.cache.domains(),
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): HybridDetectionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<HybridDetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create a new hybrid page type detector
 */
export function createHybridPageTypeDetector(
  config?: Partial<HybridDetectionConfig>
): HybridPageTypeDetector {
  return new HybridPageTypeDetector(config);
}
