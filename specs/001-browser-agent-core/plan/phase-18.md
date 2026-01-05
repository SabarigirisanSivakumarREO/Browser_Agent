**Navigation**: [Index](./index.md) | [Previous](./phase-17.md) | [Next](./phase-19.md)
## Phase 18: Heuristics & Post-Processing Architecture

### Overview

Phase 18 implements the post-processing pipeline that runs AFTER the agent loop completes:
1. Business type detection
2. Heuristic rule execution
3. Insight deduplication & prioritization
4. Hypothesis generation
5. Report generation

### New Models (`src/models/`)

#### BusinessType (`src/models/business-type.ts`)

```typescript
/**
 * Business type classification for CRO analysis
 */
export type BusinessType =
  | 'ecommerce'
  | 'saas'
  | 'banking'
  | 'insurance'
  | 'travel'
  | 'media'
  | 'other';

/**
 * Result of business type detection
 */
export interface BusinessTypeResult {
  type: BusinessType;
  confidence: number;           // 0-1
  signals: string[];            // What matched (e.g., "cart icon", "pricing page")
}

/**
 * Signals used to detect business type
 */
export interface BusinessTypeSignals {
  urlPatterns: RegExp[];        // URL patterns (e.g., /shop/, /cart/)
  elementSelectors: string[];   // CSS selectors for business-specific elements
  keywords: string[];           // Text keywords in page content
}

export const BUSINESS_TYPE_SIGNALS: Record<BusinessType, BusinessTypeSignals> = {
  ecommerce: {
    urlPatterns: [/\/shop/i, /\/cart/i, /\/product/i, /\/checkout/i],
    elementSelectors: ['.add-to-cart', '.buy-now', '[class*="cart"]', '[class*="product"]'],
    keywords: ['add to cart', 'buy now', 'checkout', 'shipping', 'price'],
  },
  saas: {
    urlPatterns: [/\/pricing/i, /\/features/i, /\/demo/i, /\/signup/i],
    elementSelectors: ['.pricing-table', '.feature-list', '[class*="trial"]'],
    keywords: ['free trial', 'start free', 'per month', 'per user', 'enterprise'],
  },
  banking: {
    urlPatterns: [/\/account/i, /\/loans/i, /\/mortgage/i, /\/credit-card/i],
    elementSelectors: ['.account-balance', '[class*="loan"]', '[class*="rate"]'],
    keywords: ['apr', 'interest rate', 'account', 'balance', 'transfer'],
  },
  insurance: {
    urlPatterns: [/\/quote/i, /\/coverage/i, /\/policy/i, /\/claims/i],
    elementSelectors: ['.quote-form', '[class*="coverage"]', '[class*="premium"]'],
    keywords: ['get a quote', 'coverage', 'premium', 'deductible', 'policy'],
  },
  travel: {
    urlPatterns: [/\/flights/i, /\/hotels/i, /\/booking/i, /\/destination/i],
    elementSelectors: ['.search-flights', '.hotel-search', '[class*="booking"]'],
    keywords: ['book now', 'departure', 'arrival', 'check-in', 'travelers'],
  },
  media: {
    urlPatterns: [/\/article/i, /\/news/i, /\/blog/i, /\/video/i],
    elementSelectors: ['.article-content', '.video-player', '[class*="subscribe"]'],
    keywords: ['read more', 'watch now', 'subscribe', 'newsletter', 'latest'],
  },
  other: {
    urlPatterns: [],
    elementSelectors: [],
    keywords: [],
  },
};
```

#### Hypothesis (`src/models/hypothesis.ts`)

```typescript
import { z } from 'zod';

/**
 * Expected impact levels for A/B tests
 */
export type ExpectedImpact = 'low' | 'medium' | 'high';

/**
 * A/B test hypothesis generated from CRO insights
 */
export interface Hypothesis {
  id: string;                    // Unique ID (H001, H002, etc.)
  title: string;                 // Short title for the test
  hypothesis: string;            // "If X then Y because Z" format
  controlDescription: string;    // Current state
  treatmentDescription: string;  // Proposed change
  primaryMetric: string;         // What to measure (CTR, conversion rate, etc.)
  secondaryMetrics?: string[];   // Additional metrics to track
  expectedImpact: ExpectedImpact;
  priority: number;              // 1-10, higher = more important
  relatedInsights: string[];     // CROInsight IDs that led to this hypothesis
  estimatedEffort?: 'low' | 'medium' | 'high';
}

/**
 * Zod schema for Hypothesis validation
 */
export const HypothesisSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(5).max(100),
  hypothesis: z.string().min(20).max(500),
  controlDescription: z.string().min(10).max(300),
  treatmentDescription: z.string().min(10).max(300),
  primaryMetric: z.string().min(3).max(100),
  secondaryMetrics: z.array(z.string()).optional(),
  expectedImpact: z.enum(['low', 'medium', 'high']),
  priority: z.number().int().min(1).max(10),
  relatedInsights: z.array(z.string()).min(1),
  estimatedEffort: z.enum(['low', 'medium', 'high']).optional(),
});

export type HypothesisValidated = z.infer<typeof HypothesisSchema>;
```

#### Extended CROAnalysisResult

```typescript
// Update to src/agent/cro-agent.ts CROAnalysisResult

export interface CROAnalysisResult {
  // Existing fields
  url: string;
  success: boolean;
  insights: CROInsight[];           // Tool-generated insights
  stepsExecuted: number;
  totalTimeMs: number;
  terminationReason: string;
  errors: string[];
  pageTitle?: string;

  // Phase 18 additions
  businessType?: BusinessTypeResult;
  heuristicInsights: CROInsight[];  // Heuristic-generated insights
  hypotheses: Hypothesis[];
  scores: CROScores;
  report?: {
    markdown?: string;
    json?: string;
  };
}

export interface CROScores {
  overall: number;                   // 0-100
  byCategory: Record<InsightCategory, number>;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}
```

### Heuristics Module (`src/heuristics/`)

#### Directory Structure

```
src/heuristics/
├── index.ts                      # Module exports
├── types.ts                      # HeuristicRule, HeuristicResult interfaces
├── heuristic-engine.ts           # Main engine class
├── business-type-detector.ts     # Business type detection
├── severity-scorer.ts            # Severity adjustment by business type
└── rules/
    ├── index.ts                  # Export all rules
    ├── cta-rules.ts              # H001, H002
    ├── form-rules.ts             # H003, H004
    ├── trust-rules.ts            # H005, H006
    ├── value-prop-rules.ts       # H007, H008
    └── navigation-rules.ts       # H009, H010
```

#### Types (`src/heuristics/types.ts`)

```typescript
import type { CROInsight, PageState, BusinessType } from '../models/index.js';

/**
 * Single heuristic rule definition
 */
export interface HeuristicRule {
  id: string;                      // H001, H002, etc.
  name: string;                    // Human-readable name
  description: string;             // What this rule checks
  category: InsightCategory;       // cta, form, trust, etc.
  severity: Severity;              // Default severity
  businessTypes?: BusinessType[];  // Only apply to these types (empty = all)

  /**
   * Check function - returns insight if violation found, null otherwise
   */
  check(state: PageState): CROInsight | null;
}

/**
 * Result of running all heuristics
 */
export interface HeuristicResult {
  insights: CROInsight[];
  rulesExecuted: number;
  rulesPassed: number;
  rulesFailed: number;
  executionTimeMs: number;
}
```

#### HeuristicEngine (`src/heuristics/heuristic-engine.ts`)

```typescript
import type { PageState, CROInsight } from '../models/index.js';
import type { HeuristicRule, HeuristicResult } from './types.js';
import { createLogger } from '../utils/index.js';

export class HeuristicEngine {
  private rules: Map<string, HeuristicRule> = new Map();
  private logger = createLogger('HeuristicEngine');

  /**
   * Register a heuristic rule
   */
  register(rule: HeuristicRule): void {
    if (this.rules.has(rule.id)) {
      throw new Error(`Rule already registered: ${rule.id}`);
    }
    this.rules.set(rule.id, rule);
    this.logger.debug(`Registered rule: ${rule.id} - ${rule.name}`);
  }

  /**
   * Register multiple rules
   */
  registerAll(rules: HeuristicRule[]): void {
    rules.forEach(r => this.register(r));
  }

  /**
   * Run all applicable rules against page state
   */
  run(state: PageState, businessType?: BusinessType): HeuristicResult {
    const start = Date.now();
    const insights: CROInsight[] = [];
    let passed = 0;
    let failed = 0;

    for (const rule of this.rules.values()) {
      // Skip rules not applicable to this business type
      if (rule.businessTypes && rule.businessTypes.length > 0) {
        if (!businessType || !rule.businessTypes.includes(businessType)) {
          this.logger.debug(`Skipping rule ${rule.id} - not applicable to ${businessType}`);
          continue;
        }
      }

      try {
        const insight = rule.check(state);
        if (insight) {
          insight.heuristicId = rule.id;
          insights.push(insight);
          failed++;
          this.logger.info(`Rule ${rule.id} failed: ${insight.issue}`);
        } else {
          passed++;
          this.logger.debug(`Rule ${rule.id} passed`);
        }
      } catch (error) {
        this.logger.error(`Rule ${rule.id} error: ${error}`);
        failed++;
      }
    }

    return {
      insights,
      rulesExecuted: passed + failed,
      rulesPassed: passed,
      rulesFailed: failed,
      executionTimeMs: Date.now() - start,
    };
  }

  /**
   * Get rule by ID
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
   * Clear all rules (for testing)
   */
  clear(): void {
    this.rules.clear();
  }
}
```

#### BusinessTypeDetector (`src/heuristics/business-type-detector.ts`)

```typescript
import type { PageState, BusinessType, BusinessTypeResult } from '../models/index.js';
import { BUSINESS_TYPE_SIGNALS } from '../models/business-type.js';
import { createLogger } from '../utils/index.js';

export class BusinessTypeDetector {
  private logger = createLogger('BusinessTypeDetector');
  private confidenceThreshold: number;

  constructor(confidenceThreshold = 0.6) {
    this.confidenceThreshold = confidenceThreshold;
  }

  /**
   * Detect business type from page state
   */
  detect(state: PageState): BusinessTypeResult {
    const scores: Record<BusinessType, { score: number; signals: string[] }> = {
      ecommerce: { score: 0, signals: [] },
      saas: { score: 0, signals: [] },
      banking: { score: 0, signals: [] },
      insurance: { score: 0, signals: [] },
      travel: { score: 0, signals: [] },
      media: { score: 0, signals: [] },
      other: { score: 0, signals: [] },
    };

    const url = state.url.toLowerCase();
    const pageText = this.extractPageText(state);

    // Check each business type
    for (const [type, signals] of Object.entries(BUSINESS_TYPE_SIGNALS)) {
      if (type === 'other') continue;

      const bizType = type as BusinessType;

      // URL pattern matching
      for (const pattern of signals.urlPatterns) {
        if (pattern.test(url)) {
          scores[bizType].score += 0.3;
          scores[bizType].signals.push(`URL matches ${pattern.source}`);
        }
      }

      // Keyword matching
      for (const keyword of signals.keywords) {
        if (pageText.includes(keyword.toLowerCase())) {
          scores[bizType].score += 0.15;
          scores[bizType].signals.push(`Keyword: "${keyword}"`);
        }
      }

      // Element selector matching (check DOM tree)
      for (const selector of signals.elementSelectors) {
        if (this.hasElementMatching(state, selector)) {
          scores[bizType].score += 0.2;
          scores[bizType].signals.push(`Element: ${selector}`);
        }
      }
    }

    // Find highest scoring type
    let bestType: BusinessType = 'other';
    let bestScore = 0;
    let bestSignals: string[] = [];

    for (const [type, data] of Object.entries(scores)) {
      if (data.score > bestScore) {
        bestScore = Math.min(data.score, 1); // Cap at 1.0
        bestType = type as BusinessType;
        bestSignals = data.signals;
      }
    }

    // Fall back to 'other' if confidence too low
    if (bestScore < this.confidenceThreshold) {
      this.logger.info(`Low confidence (${bestScore.toFixed(2)}), defaulting to 'other'`);
      return { type: 'other', confidence: bestScore, signals: bestSignals };
    }

    this.logger.info(`Detected business type: ${bestType} (confidence: ${bestScore.toFixed(2)})`);
    return { type: bestType, confidence: bestScore, signals: bestSignals };
  }

  private extractPageText(state: PageState): string {
    // Extract all text from DOM tree (simplified)
    const texts: string[] = [];
    this.collectText(state.domTree.root, texts);
    return texts.join(' ').toLowerCase();
  }

  private collectText(node: DOMNode, result: string[]): void {
    if (node.text) result.push(node.text);
    for (const child of node.children) {
      this.collectText(child, result);
    }
  }

  private hasElementMatching(state: PageState, selector: string): boolean {
    // Check if DOM tree has elements matching selector pattern
    // Simplified: check class/tag patterns in xpath or text
    return this.checkNodeForSelector(state.domTree.root, selector);
  }

  private checkNodeForSelector(node: DOMNode, selector: string): boolean {
    const selectorLower = selector.toLowerCase();
    const xpath = node.xpath?.toLowerCase() || '';
    const text = node.text?.toLowerCase() || '';

    if (xpath.includes(selectorLower) || text.includes(selectorLower)) {
      return true;
    }

    for (const child of node.children) {
      if (this.checkNodeForSelector(child, selector)) return true;
    }
    return false;
  }
}
```

#### Heuristic Rules Examples

```typescript
// src/heuristics/rules/cta-rules.ts

import { randomUUID } from 'crypto';
import type { HeuristicRule } from '../types.js';
import type { PageState, CROInsight, DOMNode } from '../../models/index.js';

const VAGUE_CTA_PATTERNS = [
  /^click here$/i,
  /^learn more$/i,
  /^read more$/i,
  /^submit$/i,
  /^send$/i,
  /^go$/i,
  /^continue$/i,
  /^next$/i,
];

/**
 * H001: Vague CTA Text
 */
export const vagueCTATextRule: HeuristicRule = {
  id: 'H001',
  name: 'vague_cta_text',
  description: 'CTAs should have specific, action-oriented text',
  category: 'cta',
  severity: 'medium',

  check(state: PageState): CROInsight | null {
    const ctas: DOMNode[] = [];
    collectCTAs(state.domTree.root, ctas);

    for (const cta of ctas) {
      const text = cta.text?.trim() || '';
      if (VAGUE_CTA_PATTERNS.some(p => p.test(text))) {
        return {
          id: randomUUID().slice(0, 8),
          category: 'cta',
          type: 'vague_cta_text',
          severity: 'medium',
          element: cta.xpath,
          issue: `CTA has vague text: "${text}". Generic CTAs reduce click-through rates`,
          recommendation: 'Use specific, benefit-driven text (e.g., "Get Free Quote" instead of "Submit")',
          evidence: { text },
        };
      }
    }
    return null;
  },
};

/**
 * H002: No CTA Above Fold
 */
export const noCTAAboveFoldRule: HeuristicRule = {
  id: 'H002',
  name: 'no_cta_above_fold',
  description: 'At least one CTA should be visible without scrolling',
  category: 'cta',
  severity: 'high',

  check(state: PageState): CROInsight | null {
    const ctas: DOMNode[] = [];
    collectCTAs(state.domTree.root, ctas);

    const viewportHeight = state.viewport.height;
    const aboveFoldCTAs = ctas.filter(
      cta => cta.boundingBox && cta.boundingBox.y < viewportHeight
    );

    if (aboveFoldCTAs.length === 0) {
      return {
        id: randomUUID().slice(0, 8),
        category: 'cta',
        type: 'no_cta_above_fold',
        severity: 'high',
        element: '',
        issue: 'No call-to-action visible above the fold',
        recommendation: 'Add primary CTA in hero section or above-fold area for immediate engagement',
      };
    }
    return null;
  },
};

function collectCTAs(node: DOMNode, result: DOMNode[]): void {
  if (node.croType === 'cta' && node.isVisible) {
    result.push(node);
  }
  for (const child of node.children) {
    collectCTAs(child, result);
  }
}

export const ctaRules: HeuristicRule[] = [vagueCTATextRule, noCTAAboveFoldRule];
```

### Output Module Extensions (`src/output/`)

#### HypothesisGenerator (`src/output/hypothesis-generator.ts`)

```typescript
import { randomUUID } from 'crypto';
import type { CROInsight, Hypothesis, Severity } from '../models/index.js';
import { createLogger } from '../utils/index.js';

const SEVERITY_PRIORITY: Record<Severity, number> = {
  critical: 10,
  high: 8,
  medium: 5,
  low: 2,
};

const METRIC_MAP: Record<string, string> = {
  cta: 'Click-through rate (CTR)',
  form: 'Form completion rate',
  trust: 'Conversion rate',
  value_prop: 'Bounce rate (decrease)',
  navigation: 'Pages per session',
  friction: 'Task completion rate',
};

export class HypothesisGenerator {
  private logger = createLogger('HypothesisGenerator');
  private minSeverity: Severity;

  constructor(minSeverity: Severity = 'high') {
    this.minSeverity = minSeverity;
  }

  /**
   * Generate hypotheses from insights
   */
  generate(insights: CROInsight[]): Hypothesis[] {
    const hypotheses: Hypothesis[] = [];
    let counter = 1;

    // Filter to high/critical by default
    const eligibleInsights = insights.filter(
      i => SEVERITY_PRIORITY[i.severity] >= SEVERITY_PRIORITY[this.minSeverity]
    );

    this.logger.info(`Generating hypotheses from ${eligibleInsights.length} eligible insights`);

    for (const insight of eligibleInsights) {
      const hypothesis = this.createHypothesis(insight, counter++);
      if (hypothesis) {
        hypotheses.push(hypothesis);
      }
    }

    // Sort by priority (highest first)
    hypotheses.sort((a, b) => b.priority - a.priority);

    return hypotheses;
  }

  private createHypothesis(insight: CROInsight, index: number): Hypothesis | null {
    const metric = METRIC_MAP[insight.category] || 'Conversion rate';

    return {
      id: `HYP-${String(index).padStart(3, '0')}`,
      title: this.generateTitle(insight),
      hypothesis: `If we ${insight.recommendation.toLowerCase()}, then ${metric.toLowerCase()} will improve because ${insight.issue.toLowerCase()}`,
      controlDescription: `Current state: ${insight.issue}`,
      treatmentDescription: insight.recommendation,
      primaryMetric: metric,
      expectedImpact: this.mapSeverityToImpact(insight.severity),
      priority: SEVERITY_PRIORITY[insight.severity],
      relatedInsights: [insight.id],
      estimatedEffort: this.estimateEffort(insight),
    };
  }

  private generateTitle(insight: CROInsight): string {
    const typeWords = insight.type.replace(/_/g, ' ');
    return `Fix ${typeWords}`;
  }

  private mapSeverityToImpact(severity: Severity): 'low' | 'medium' | 'high' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      default:
        return 'low';
    }
  }

  private estimateEffort(insight: CROInsight): 'low' | 'medium' | 'high' {
    // Simple heuristic based on category
    if (insight.category === 'form' || insight.category === 'navigation') {
      return 'medium';
    }
    if (insight.category === 'value_prop') {
      return 'low';
    }
    return 'low';
  }
}
```

#### MarkdownReporter (`src/output/markdown-reporter.ts`)

```typescript
import type { CROAnalysisResult, CROInsight, Hypothesis } from '../models/index.js';

export class MarkdownReporter {
  /**
   * Generate full markdown report
   */
  generate(result: CROAnalysisResult): string {
    const sections: string[] = [];

    sections.push(this.generateHeader(result));
    sections.push(this.generateExecutiveSummary(result));
    sections.push(this.generateCriticalIssues(result));
    sections.push(this.generateHighPriorityIssues(result));
    sections.push(this.generateMediumPriorityIssues(result));
    sections.push(this.generateLowPriorityIssues(result));
    sections.push(this.generateRecommendedTests(result));
    sections.push(this.generateFooter(result));

    return sections.join('\n\n');
  }

  private generateHeader(result: CROAnalysisResult): string {
    return `# CRO Analysis Report

**URL**: ${result.url}
**Page Title**: ${result.pageTitle || 'N/A'}
**Analysis Date**: ${new Date().toISOString().split('T')[0]}
**Business Type**: ${result.businessType?.type || 'Unknown'} (${((result.businessType?.confidence || 0) * 100).toFixed(0)}% confidence)

---`;
  }

  private generateExecutiveSummary(result: CROAnalysisResult): string {
    const allInsights = [...result.insights, ...result.heuristicInsights];
    const scores = result.scores;

    return `## Executive Summary

| Metric | Value |
|--------|-------|
| Overall CRO Score | **${scores.overall}/100** |
| Critical Issues | ${scores.criticalCount} |
| High Priority | ${scores.highCount} |
| Medium Priority | ${scores.mediumCount} |
| Low Priority | ${scores.lowCount} |
| Recommended Tests | ${result.hypotheses.length} |
| Analysis Steps | ${result.stepsExecuted} |
| Total Time | ${(result.totalTimeMs / 1000).toFixed(1)}s |`;
  }

  private generateCriticalIssues(result: CROAnalysisResult): string {
    const critical = this.filterBySeverity(result, 'critical');
    if (critical.length === 0) return '## Critical Issues\n\n✅ No critical issues found.';

    return `## Critical Issues

${critical.map(i => this.formatInsight(i)).join('\n\n')}`;
  }

  private generateHighPriorityIssues(result: CROAnalysisResult): string {
    const high = this.filterBySeverity(result, 'high');
    if (high.length === 0) return '## High Priority Issues\n\n✅ No high priority issues found.';

    return `## High Priority Issues

${high.map(i => this.formatInsight(i)).join('\n\n')}`;
  }

  private generateMediumPriorityIssues(result: CROAnalysisResult): string {
    const medium = this.filterBySeverity(result, 'medium');
    if (medium.length === 0) return '## Medium Priority Issues\n\n✅ No medium priority issues found.';

    return `## Medium Priority Issues

${medium.map(i => this.formatInsight(i)).join('\n\n')}`;
  }

  private generateLowPriorityIssues(result: CROAnalysisResult): string {
    const low = this.filterBySeverity(result, 'low');
    if (low.length === 0) return '## Low Priority Issues\n\n✅ No low priority issues found.';

    return `## Low Priority Issues

${low.map(i => this.formatInsight(i)).join('\n\n')}`;
  }

  private generateRecommendedTests(result: CROAnalysisResult): string {
    if (result.hypotheses.length === 0) {
      return '## Recommended A/B Tests\n\nNo tests recommended based on current analysis.';
    }

    return `## Recommended A/B Tests

${result.hypotheses.map((h, i) => this.formatHypothesis(h, i + 1)).join('\n\n')}`;
  }

  private generateFooter(result: CROAnalysisResult): string {
    return `---

*Generated by CRO Browser Agent | ${new Date().toISOString()}*`;
  }

  private filterBySeverity(result: CROAnalysisResult, severity: string): CROInsight[] {
    const all = [...result.insights, ...result.heuristicInsights];
    return all.filter(i => i.severity === severity);
  }

  private formatInsight(insight: CROInsight): string {
    return `### ${insight.type.replace(/_/g, ' ').toUpperCase()}

- **Category**: ${insight.category}
- **Element**: \`${insight.element || 'N/A'}\`
- **Issue**: ${insight.issue}
- **Recommendation**: ${insight.recommendation}
${insight.heuristicId ? `- **Heuristic**: ${insight.heuristicId}` : ''}`;
  }

  private formatHypothesis(h: Hypothesis, num: number): string {
    return `### Test ${num}: ${h.title}

**Hypothesis**: ${h.hypothesis}

| Aspect | Description |
|--------|-------------|
| Control | ${h.controlDescription} |
| Treatment | ${h.treatmentDescription} |
| Primary Metric | ${h.primaryMetric} |
| Expected Impact | ${h.expectedImpact} |
| Priority | ${h.priority}/10 |
| Effort | ${h.estimatedEffort || 'Unknown'} |`;
  }
}
```

### Agent Integration

```typescript
// Addition to CROAgent.analyze() - post-processing pipeline

async analyze(url: string, analyzeOptions?: AnalyzeOptions): Promise<CROAnalysisResult> {
  // ... existing agent loop code ...

  // ─── 4. POST-PROCESSING PIPELINE ───────────────────────────
  this.logger.info('Starting post-processing pipeline');

  // 4a. Detect business type
  const businessTypeDetector = new BusinessTypeDetector();
  const businessType = businessTypeDetector.detect(finalPageState);

  // 4b. Run heuristics
  const heuristicEngine = createHeuristicEngine(); // Factory with all 10 rules
  const heuristicResult = heuristicEngine.run(finalPageState, businessType.type);

  // 4c. Combine and deduplicate insights
  const allInsights = [...stateManager.getInsights(), ...heuristicResult.insights];
  const deduplicator = new InsightDeduplicator();
  const uniqueInsights = deduplicator.deduplicate(allInsights);

  // 4d. Prioritize insights
  const prioritizer = new InsightPrioritizer();
  const prioritizedInsights = prioritizer.prioritize(uniqueInsights, businessType.type);

  // 4e. Generate hypotheses
  const hypothesisGenerator = new HypothesisGenerator('high');
  const hypotheses = hypothesisGenerator.generate(prioritizedInsights);

  // 4f. Calculate scores
  const scores = this.calculateScores(prioritizedInsights);

  // 4g. Generate reports (if requested)
  let report: { markdown?: string; json?: string } | undefined;
  if (analyzeOptions?.outputFormat) {
    if (analyzeOptions.outputFormat === 'markdown' || analyzeOptions.outputFormat === 'all') {
      const reporter = new MarkdownReporter();
      report = { ...report, markdown: reporter.generate(result) };
    }
    if (analyzeOptions.outputFormat === 'json' || analyzeOptions.outputFormat === 'all') {
      const exporter = new JSONExporter();
      report = { ...report, json: exporter.export(result) };
    }
  }

  return {
    url,
    success: true,
    insights: stateManager.getInsights(),
    heuristicInsights: heuristicResult.insights,
    businessType,
    hypotheses,
    scores,
    report,
    stepsExecuted: stateManager.getStep(),
    totalTimeMs: Date.now() - startTime,
    terminationReason: stateManager.getTerminationReason(),
    errors,
    pageTitle,
  };
}
```

### Phase 18 Test Matrix

| Sub-Phase | Component | Unit Tests | Int Tests | Total |
|-----------|-----------|------------|-----------|-------|
| 18a | Models (BusinessType, Hypothesis) | 8 | - | 8 |
| 18b | HeuristicEngine | 10 | - | 10 |
| 18b | BusinessTypeDetector | 8 | - | 8 |
| 18b | SeverityScorer | 4 | - | 4 |
| 18c | 10 Heuristic Rules (2 each) | 20 | - | 20 |
| 18d | HypothesisGenerator | 6 | - | 6 |
| 18d | InsightDeduplicator | 4 | - | 4 |
| 18d | InsightPrioritizer | 3 | - | 3 |
| 18d | MarkdownReporter | 4 | - | 4 |
| 18d | JSONExporter | 3 | - | 3 |
| 18e | Agent Integration | - | 12 | 12 |
| 18-CLI | CLI + FileWriter | 6 | - | 6 |
| **Total** | | **76** | **12** | **88** |

---

