**Navigation**: [Index](./index.md) | [Previous](./phase-20.md) | [Next](./phase-22.md)

## Phase 21: Vision-Based CRO Heuristics

### Summary

Implement a **vision-based CRO heuristics system** that uses GPT-4o Vision to analyze page screenshots against a knowledge base of UX best practices from Baymard Institute research.

**Key Insight**: Selector-based DOM detection is unreliable across different ecommerce platforms (obfuscated classes, varied naming). Vision-based analysis sees what users see.

**Scope**: Starting with PDP (Product Detail Page), extensible to all page types.

---

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VISION-BASED CRO HEURISTICS SYSTEM                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. PAGE TYPE DETECTION (Phase 21a - COMPLETE ✅)                           │
│     PageState → PageTypeDetector → PageType ('pdp', 'plp', etc.)            │
│                                                                             │
│  2. KNOWLEDGE BASE (Phase 21b - COMPLETE ✅)                                │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ src/heuristics/knowledge/                                       │    │
│     │ ├── pdp/                                                        │    │
│     │ │   ├── layout-structure.json      (4 heuristics)              │    │
│     │ │   ├── imagery-media.json         (4 heuristics)              │    │
│     │ │   ├── pricing-transparency.json  (4 heuristics)              │    │
│     │ │   ├── description-value-prop.json (3 heuristics)             │    │
│     │ │   ├── specifications.json        (3 heuristics)              │    │
│     │ │   ├── reviews-social-proof.json  (4 heuristics)              │    │
│     │ │   ├── selection-configuration.json (3 heuristics)            │    │
│     │ │   ├── cta-purchase-confidence.json (4 heuristics)            │    │
│     │ │   ├── mobile-usability.json      (3 heuristics)              │    │
│     │ │   └── utility-secondary.json     (3 heuristics)              │    │
│     │ ├── plp/        (future)                                        │    │
│     │ ├── homepage/   (future)                                        │    │
│     │ └── index.ts    (loader)                                        │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  3. VISION ANALYZER (Phase 21c - COMPLETE ✅)                               │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │                                                                 │    │
│     │  Screenshot + PageType + Viewport                               │    │
│     │        │                                                        │    │
│     │        ▼                                                        │    │
│     │  ┌──────────────────┐                                          │    │
│     │  │ loadHeuristics() │ → PageTypeHeuristics (35 PDP heuristics) │    │
│     │  └──────────────────┘                                          │    │
│     │        │                                                        │    │
│     │        ▼                                                        │    │
│     │  ┌──────────────────┐                                          │    │
│     │  │ buildPrompt()    │ → Prompt with heuristics + instructions  │    │
│     │  └──────────────────┘                                          │    │
│     │        │                                                        │    │
│     │        ▼                                                        │    │
│     │  ┌──────────────────┐                                          │    │
│     │  │ GPT-4o Vision    │ → Structured JSON response               │    │
│     │  └──────────────────┘                                          │    │
│     │        │                                                        │    │
│     │        ▼                                                        │    │
│     │  ┌──────────────────┐                                          │    │
│     │  │ parseResponse()  │ → HeuristicEvaluation[]                  │    │
│     │  └──────────────────┘                                          │    │
│     │        │                                                        │    │
│     │        ▼                                                        │    │
│     │  CROVisionAnalysisResult (evaluations + insights + summary)     │    │
│     │                                                                 │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  4. INTEGRATION (Phase 21d)                                                 │
│     PageState.visionAnalysis ← CROVisionAnalysisResult                      │
│     CRO Report includes vision-based insights                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### File Structure

```
src/heuristics/
├── knowledge/                      # NEW: Heuristics knowledge base
│   ├── index.ts                    # Loader functions
│   ├── types.ts                    # Knowledge base types
│   └── pdp/                        # PDP heuristics (35 total)
│       ├── index.ts                # PDP aggregator
│       ├── layout-structure.json
│       ├── imagery-media.json
│       ├── pricing-transparency.json
│       ├── description-value-prop.json
│       ├── specifications.json
│       ├── reviews-social-proof.json
│       ├── selection-configuration.json
│       ├── cta-purchase-confidence.json
│       ├── mobile-usability.json
│       └── utility-secondary.json
│
├── vision/                         # NEW: Vision analysis system
│   ├── index.ts                    # Exports
│   ├── types.ts                    # Vision analysis types
│   ├── analyzer.ts                 # CROVisionAnalyzer class
│   ├── prompt-builder.ts           # Prompt construction
│   └── response-parser.ts          # Response parsing
│
├── page-type-detector.ts           # EXISTS: Phase 21a
├── heuristic-engine.ts             # EXISTS: DOM-based rules
├── types.ts                        # EXISTS: Extended with vision types
└── index.ts                        # MODIFY: Add vision exports

tests/
├── unit/
│   ├── page-type-detector.test.ts  # EXISTS: Phase 21a
│   ├── knowledge-loader.test.ts    # NEW
│   └── vision-analyzer.test.ts     # NEW
└── integration/
    └── vision-analysis.test.ts     # NEW
```

---

### Knowledge Base Types

```typescript
// src/heuristics/knowledge/types.ts

/**
 * Single heuristic item from Baymard research
 */
export interface HeuristicItem {
  /** Unique identifier: PDP-CATEGORY-NNN */
  id: string;
  /** The UX principle from Baymard research */
  principle: string;
  /** Specific checkpoints to verify visually */
  checkpoints: string[];
  /** Issue severity if heuristic fails */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Parent category name */
  category: string;
}

/**
 * Category grouping related heuristics
 */
export interface HeuristicCategory {
  /** Category name */
  name: string;
  /** Category description */
  description: string;
  /** Heuristics in this category */
  heuristics: HeuristicItem[];
}

/**
 * All heuristics for a page type
 */
export interface PageTypeHeuristics {
  /** Page type this applies to */
  pageType: PageType;
  /** Source of heuristics */
  source: string;
  /** Last updated date */
  lastUpdated: string;
  /** Total heuristic count */
  totalCount: number;
  /** Heuristic categories */
  categories: HeuristicCategory[];
}
```

---

### Knowledge Base JSON Schema

```json
// src/heuristics/knowledge/pdp/pricing-transparency.json
{
  "name": "Pricing & Cost Transparency",
  "description": "How pricing information should be displayed on product pages",
  "heuristics": [
    {
      "id": "PDP-PRICE-001",
      "principle": "The full price should be immediately visible without requiring interaction",
      "checkpoints": [
        "Price is visible above the fold",
        "Price does not require clicking tabs or expandable sections",
        "Price is prominently displayed near product title",
        "Price uses adequate font size and contrast"
      ],
      "severity": "critical",
      "category": "Pricing & Cost Transparency"
    },
    {
      "id": "PDP-PRICE-002",
      "principle": "Unit pricing should be shown where quantity or size varies",
      "checkpoints": [
        "Price per unit is displayed for variable quantity products",
        "Size/quantity relationship to price is clear"
      ],
      "severity": "medium",
      "category": "Pricing & Cost Transparency"
    }
  ]
}
```

---

### Vision Analyzer Types

```typescript
// src/heuristics/vision/types.ts

import type { PageType } from '../../models/index.js';
import type { CROInsight } from '../../models/index.js';

/**
 * Configuration for CRO Vision Analyzer
 */
export interface CROVisionAnalyzerConfig {
  /** Vision model to use */
  model: 'gpt-4o' | 'gpt-4o-mini';
  /** Max tokens for response */
  maxTokens: number;
  /** Temperature for response */
  temperature: number;
}

/**
 * Evaluation result for a single heuristic
 */
export interface HeuristicEvaluation {
  /** Heuristic ID: PDP-PRICE-001 */
  heuristicId: string;
  /** Original principle text */
  principle: string;
  /** Evaluation status */
  status: 'pass' | 'fail' | 'partial' | 'not_applicable';
  /** Issue severity */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** What the LLM observed in the screenshot */
  observation: string;
  /** If failed, what's wrong */
  issue?: string;
  /** How to fix the issue */
  recommendation?: string;
  /** Confidence score 0-1 */
  confidence: number;
}

/**
 * Complete vision analysis result
 */
export interface CROVisionAnalysisResult {
  /** Page type analyzed */
  pageType: PageType;
  /** Timestamp of analysis */
  analyzedAt: number;
  /** Whether screenshot was used */
  screenshotUsed: boolean;
  /** Per-heuristic evaluations */
  evaluations: HeuristicEvaluation[];
  /** Transformed CROInsights for compatibility */
  insights: CROInsight[];
  /** Summary statistics */
  summary: {
    totalHeuristics: number;
    passed: number;
    failed: number;
    partial: number;
    notApplicable: number;
    bySeverity: Record<string, number>;
  };
}
```

---

### CROVisionAnalyzer Class

```typescript
// src/heuristics/vision/analyzer.ts

export class CROVisionAnalyzer {
  private config: CROVisionAnalyzerConfig;
  private knowledgeCache: Map<PageType, PageTypeHeuristics>;

  constructor(config?: Partial<CROVisionAnalyzerConfig>) {
    this.config = {
      model: 'gpt-4o-mini',
      maxTokens: 4096,
      temperature: 0.1,
      ...config,
    };
    this.knowledgeCache = new Map();
  }

  /**
   * Analyze a page screenshot against heuristics
   */
  async analyze(
    screenshot: string,        // Base64 encoded
    pageType: PageType,
    viewport: ViewportInfo
  ): Promise<CROVisionAnalysisResult> {
    // 1. Load heuristics for page type
    const heuristics = await this.loadHeuristics(pageType);

    // 2. Build prompt with heuristics context
    const prompt = this.buildPrompt(heuristics, viewport);

    // 3. Call GPT-4o Vision API
    const response = await this.callVisionAPI(screenshot, prompt);

    // 4. Parse response into evaluations
    const evaluations = this.parseResponse(response, heuristics);

    // 5. Transform to CROInsights for compatibility
    const insights = this.transformToInsights(evaluations);

    // 6. Calculate summary
    const summary = this.calculateSummary(evaluations);

    return {
      pageType,
      analyzedAt: Date.now(),
      screenshotUsed: true,
      evaluations,
      insights,
      summary,
    };
  }

  /**
   * Load heuristics from knowledge base
   */
  private async loadHeuristics(pageType: PageType): Promise<PageTypeHeuristics> {
    if (this.knowledgeCache.has(pageType)) {
      return this.knowledgeCache.get(pageType)!;
    }

    const heuristics = await loadHeuristics(pageType);
    this.knowledgeCache.set(pageType, heuristics);
    return heuristics;
  }

  /**
   * Build prompt for vision analysis
   */
  private buildPrompt(
    heuristics: PageTypeHeuristics,
    viewport: ViewportInfo
  ): string {
    // Include all heuristics with principles and checkpoints
    // Request structured JSON output
    // See prompt-builder.ts for full implementation
  }

  /**
   * Call GPT-4o Vision API
   */
  private async callVisionAPI(
    screenshot: string,
    prompt: string
  ): Promise<string> {
    // Use OpenAI API with vision capability
    // Return structured JSON response
  }

  /**
   * Parse API response into evaluations
   */
  private parseResponse(
    response: string,
    heuristics: PageTypeHeuristics
  ): HeuristicEvaluation[] {
    // Parse JSON response
    // Validate against expected heuristic IDs
    // Return typed evaluations
  }

  /**
   * Transform evaluations to CROInsight[] for compatibility
   */
  private transformToInsights(evaluations: HeuristicEvaluation[]): CROInsight[] {
    return evaluations
      .filter(e => e.status === 'fail' || e.status === 'partial')
      .map(e => ({
        id: uuid(),
        category: this.mapCategory(e.heuristicId),
        type: e.heuristicId.toLowerCase().replace(/-/g, '_'),
        severity: e.severity,
        element: 'viewport',
        issue: e.issue || e.observation,
        recommendation: e.recommendation || '',
        evidence: { text: e.observation },
        heuristicId: e.heuristicId,
        confidence: e.confidence,
      }));
  }
}
```

---

### Prompt Template

```typescript
// src/heuristics/vision/prompt-builder.ts

export function buildVisionPrompt(
  heuristics: PageTypeHeuristics,
  viewport: ViewportInfo
): string {
  return `
You are a CRO (Conversion Rate Optimization) expert analyzing a ${heuristics.pageType.toUpperCase()} page screenshot.

## Context
- Viewport: ${viewport.width}x${viewport.height}px
- Device: ${viewport.isMobile ? 'Mobile' : 'Desktop'}
- Above fold: Content visible without scrolling (top ${viewport.height}px)

## Heuristics to Evaluate

${heuristics.categories.map(cat => `
### ${cat.name}

${cat.heuristics.map(h => `
**${h.id}** [${h.severity.toUpperCase()}]
Principle: ${h.principle}
Checkpoints:
${h.checkpoints.map(c => `  - ${c}`).join('\n')}
`).join('\n')}
`).join('\n')}

## Task

Analyze the screenshot and evaluate EACH heuristic. Return a JSON array with one object per heuristic:

\`\`\`json
{
  "evaluations": [
    {
      "heuristicId": "PDP-PRICE-001",
      "status": "pass" | "fail" | "partial" | "not_applicable",
      "observation": "What you observed in the screenshot",
      "issue": "If fail/partial, describe the specific problem",
      "recommendation": "Actionable fix recommendation",
      "confidence": 0.95
    }
  ]
}
\`\`\`

## Guidelines
- Be specific in observations - reference what you actually see
- "partial" = some checkpoints met but not all
- "not_applicable" = cannot evaluate (e.g., no variants to configure)
- Confidence: 0.9+ for clear cases, 0.7-0.9 for interpretation needed
- Focus on user experience impact, not technical implementation
`;
}
```

---

### Integration with PageState

```typescript
// src/models/page-state.ts (extended)

import type { CROVisionAnalysisResult } from '../heuristics/vision/types.js';

export interface PageState {
  url: string;
  title: string;
  domTree: DOMTree;
  viewport: ViewportInfo;
  scrollPosition: ScrollPosition;
  timestamp: number;
  screenshotPath?: string;

  // NEW: Vision analysis result
  visionAnalysis?: CROVisionAnalysisResult;
}
```

---

### Sub-Phases

| Sub-Phase | Scope | Files | Tests | Status |
|-----------|-------|-------|-------|--------|
| 21a | PageType Detection | 4 | 35+ | COMPLETE ✅ |
| 21b | Knowledge Base (types + 10 JSON files) | 14 | 25 | COMPLETE ✅ |
| 21c | Vision Analyzer (analyzer + prompt + parser) | 6 | 44 | COMPLETE ✅ |
| 21d | Integration (PageState + Agent + CLI) | 5 | 44+ | COMPLETE ✅ |
| ~~21e~~ | ~~Multi-Viewport Full-Page Vision~~ | - | - | ✅ REMOVED (CR-001) |
| ~~21f~~ | ~~Full-Page Screenshot Mode~~ | - | - | ✅ REMOVED (CR-001) |
| ~~21g~~ | ~~Vision Agent Loop~~ | - | - | ✅ MERGED into CRO Agent (CR-001) |
| **CR-001** | **Architecture Simplification** | 8+ | 51 | **COMPLETE ✅** |
| 21h | Evidence Capture | 14 | 49 | 📋 Pending |
| 21i | DOM-Screenshot Mapping | 17 | 88 | 📋 Pending |

---

### Test Strategy

1. **Knowledge Base Tests** (15+)
   - JSON files are valid and parseable
   - loadHeuristics() returns correct structure
   - All heuristics have required fields
   - Heuristic counts match expected totals

2. **Vision Analyzer Tests** (20+)
   - Prompt includes all heuristics
   - Response parsing handles all status types
   - Transformation to CROInsight works correctly
   - Summary calculation is accurate
   - Mock GPT-4o responses for unit tests

3. **Integration Tests** (15+)
   - Full flow: screenshot → analysis → insights
   - PageState includes visionAnalysis
   - CLI flags control vision analysis
   - Real PDP page analysis (E2E)

---

### Phase 20 Compatibility

Phase 21's vision analysis is designed to work alongside Phase 20's extraction pipeline:

```typescript
// Future integration
interface PageKnowledge {
  // Phase 20 extraction...
  vision?: {
    screenshots: Screenshot[];
    analysis?: CROVisionAnalysisResult;  // Phase 21
  };
}
```

Phase 21's `CROVisionAnalyzer` can be integrated as Phase 20's vision analysis module.

---

---

## Phase 21e: Multi-Viewport Full-Page Vision Analysis

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│               MULTI-VIEWPORT FULL-PAGE VISION ANALYSIS                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  LEVERAGES PHASE 19 INFRASTRUCTURE                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ CoverageTracker → Scroll positions → Multiple viewport screenshots       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  CAPTURE FLOW                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                         │   │
│  │  Page (2700px)          Screenshots                                     │   │
│  │  ┌──────────┐           ┌─────────────────────────────────────────┐    │   │
│  │  │ 0-900px  │ ────────► │ Viewport 0: screenshot_0.png (base64)   │    │   │
│  │  ├──────────┤           ├─────────────────────────────────────────┤    │   │
│  │  │ 900-1800 │ ────────► │ Viewport 1: screenshot_1.png (base64)   │    │   │
│  │  ├──────────┤           ├─────────────────────────────────────────┤    │   │
│  │  │1800-2700 │ ────────► │ Viewport 2: screenshot_2.png (base64)   │    │   │
│  │  └──────────┘           └─────────────────────────────────────────┘    │   │
│  │                                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  PARALLEL ANALYSIS (gpt-4o-mini)                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                         │   │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                   │   │
│  │  │ Viewport 0  │   │ Viewport 1  │   │ Viewport 2  │                   │   │
│  │  │ gpt-4o-mini │   │ gpt-4o-mini │   │ gpt-4o-mini │   ← Parallel      │   │
│  │  │   ~$0.002   │   │   ~$0.002   │   │   ~$0.002   │     API calls     │   │
│  │  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘                   │   │
│  │         │                 │                 │                           │   │
│  │         ▼                 ▼                 ▼                           │   │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                   │   │
│  │  │ Evaluations │   │ Evaluations │   │ Evaluations │                   │   │
│  │  │  (35 each)  │   │  (35 each)  │   │  (35 each)  │                   │   │
│  │  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘                   │   │
│  │         │                 │                 │                           │   │
│  │         └────────────────┬┴─────────────────┘                           │   │
│  │                          ▼                                              │   │
│  │                 ┌─────────────────┐                                     │   │
│  │                 │ MERGE & DEDUPE  │                                     │   │
│  │                 └────────┬────────┘                                     │   │
│  │                          ▼                                              │   │
│  │                 ┌─────────────────┐                                     │   │
│  │                 │ Final Result    │                                     │   │
│  │                 │ ~35-50 findings │   (deduplicated)                    │   │
│  │                 └─────────────────┘                                     │   │
│  │                                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  COST: ~$0.006-0.01 for 3 viewports with gpt-4o-mini                           │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### File Structure

```
src/heuristics/vision/
├── index.ts                    # MODIFY: Add multi-viewport exports
├── types.ts                    # MODIFY: Add multi-viewport types
├── analyzer.ts                 # EXISTS: Single viewport analyzer
├── multi-viewport-analyzer.ts  # NEW: Multi-viewport orchestrator
├── result-merger.ts            # NEW: Merge & dedupe logic
├── prompt-builder.ts           # EXISTS: Reused
└── response-parser.ts          # EXISTS: Reused

src/agent/
└── cro-agent.ts                # MODIFY: Add full-page-vision mode
```

### Multi-Viewport Analyzer Class

```typescript
// src/heuristics/vision/multi-viewport-analyzer.ts

export class MultiViewportVisionAnalyzer {
  private singleAnalyzer: CROVisionAnalyzer;
  private config: MultiViewportVisionConfig;

  constructor(config?: Partial<MultiViewportVisionConfig>) {
    this.config = {
      model: 'gpt-4o-mini',      // Cost-optimized default
      parallelAnalysis: true,
      dedupeThreshold: 0.8,
      maxViewports: 10,
      ...config,
    };
    this.singleAnalyzer = new CROVisionAnalyzer({ model: this.config.model });
  }

  /**
   * Analyze multiple viewport screenshots for full-page coverage
   */
  async analyzeFullPage(
    screenshots: ViewportScreenshot[],
    pageType: PageType,
    viewport: ViewportInfo
  ): Promise<MultiViewportAnalysisResult> {
    // 1. Limit to maxViewports
    const limitedScreenshots = screenshots.slice(0, this.config.maxViewports);

    // 2. Analyze each viewport (parallel or sequential)
    const viewportResults = this.config.parallelAnalysis
      ? await this.analyzeParallel(limitedScreenshots, pageType, viewport)
      : await this.analyzeSequential(limitedScreenshots, pageType, viewport);

    // 3. Merge and deduplicate results
    const merged = mergeViewportResults(viewportResults, this.config.dedupeThreshold);

    return {
      pageType,
      analyzedAt: Date.now(),
      screenshotUsed: true,
      viewport,
      viewportCount: limitedScreenshots.length,
      viewportResults,
      evaluations: merged.evaluations,
      mergedEvaluations: merged.evaluations,
      deduplicatedCount: merged.deduplicatedCount,
      insights: this.transformToInsights(merged.evaluations),
      summary: this.calculateSummary(merged.evaluations),
    };
  }

  private async analyzeParallel(
    screenshots: ViewportScreenshot[],
    pageType: PageType,
    viewport: ViewportInfo
  ): Promise<ViewportVisionResult[]> {
    const promises = screenshots.map(async (ss, index) => {
      const start = Date.now();
      const result = await this.singleAnalyzer.analyze(ss.base64, pageType, viewport);
      return {
        viewportIndex: index,
        scrollPosition: ss.scrollPosition,
        evaluations: result.evaluations,
        analysisTimeMs: Date.now() - start,
      };
    });
    return Promise.all(promises);
  }
}
```

### Result Merger

```typescript
// src/heuristics/vision/result-merger.ts

export function mergeViewportResults(
  results: ViewportVisionResult[],
  dedupeThreshold: number
): MergedResult {
  const allEvaluations: HeuristicEvaluation[] = [];
  const seenHeuristics = new Map<string, HeuristicEvaluation>();
  let deduplicatedCount = 0;

  for (const result of results) {
    for (const evaluation of result.evaluations) {
      const existing = seenHeuristics.get(evaluation.heuristicId);

      if (existing) {
        // Same heuristic - keep highest confidence
        if (evaluation.confidence > existing.confidence) {
          seenHeuristics.set(evaluation.heuristicId, {
            ...evaluation,
            viewportIndex: result.viewportIndex,
          });
        }
        deduplicatedCount++;
      } else {
        seenHeuristics.set(evaluation.heuristicId, {
          ...evaluation,
          viewportIndex: result.viewportIndex,
        });
      }
    }
  }

  return {
    evaluations: Array.from(seenHeuristics.values()),
    deduplicatedCount,
  };
}
```

### Integration with CRO Agent

```typescript
// In cro-agent.ts analyze() method

if (useFullPageVision && scanMode === 'full_page') {
  // Capture screenshots at each scroll position
  const screenshots: ViewportScreenshot[] = [];

  for (let i = 0; i < segments.length && i < maxViewports; i++) {
    await page.evaluate(`window.scrollTo(0, ${segments[i].scrollY})`);
    await this.sleep(300);

    const buffer = await page.screenshot({ type: 'png', fullPage: false });
    screenshots.push({
      base64: buffer.toString('base64'),
      scrollPosition: segments[i].scrollY,
      viewportIndex: i,
      coverage: { start: segments[i].scrollY, end: segments[i].scrollY + viewportHeight },
    });
  }

  // Run multi-viewport analysis
  const multiAnalyzer = new MultiViewportVisionAnalyzer({
    model: visionModel || 'gpt-4o-mini',
    parallelAnalysis: true,
  });

  visionAnalysis = await multiAnalyzer.analyzeFullPage(screenshots, detectedPageType, viewport);
}
```

### CLI Flags

```bash
# Enable full-page vision analysis (multi-viewport)
npm run start -- --full-page-vision https://example.com/product

# With custom max viewports
npm run start -- --full-page-vision --vision-max-viewports 5 https://example.com/product

# Sequential analysis (disable parallel)
npm run start -- --full-page-vision --no-parallel-vision https://example.com/product

# Override model (use gpt-4o for higher quality)
npm run start -- --full-page-vision --vision-model gpt-4o https://example.com/product
```

---

---

## Phase 21f: Full-Page Screenshot Mode

### Summary

Alternative to multi-viewport analysis: capture the **entire page as ONE tall image** using Playwright's `fullPage: true`, auto-resize if needed, and analyze with existing `CROVisionAnalyzer`.

### Mode Comparison

| Flag | Screenshot | Analysis | Default Model |
|------|------------|----------|---------------|
| `--vision-only` | Viewport only | Single | gpt-4o-mini |
| `--full-page-vision` | Multiple viewports | Merge & dedupe | gpt-4o-mini |
| `--full-page-screenshot` | Full page (1 tall image) | Single | gpt-4o-mini |

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│               FULL-PAGE SCREENSHOT MODE (Phase 21f)                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Capture full page screenshot                                        │
│     page.screenshot({ type: 'png', fullPage: true })                   │
│                                                                         │
│  2. Check dimensions                                                    │
│     If height > 16000px → resize with sharp                           │
│     Maintain aspect ratio                                              │
│                                                                         │
│  3. Analyze with CROVisionAnalyzer                                     │
│     Same as --vision-only but with full page content                   │
│                                                                         │
│  COST: ~$0.002-0.005 per page with gpt-4o-mini                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### File Structure

```
src/heuristics/vision/
├── image-resizer.ts            # NEW: processFullPageScreenshot()
├── types.ts                    # MODIFY: Add FullPageScreenshot types
└── index.ts                    # MODIFY: Export new functions

src/cli.ts                      # MODIFY: Add --full-page-screenshot flag

package.json                    # MODIFY: Add sharp dependency
```

### CLI Usage

```bash
# Basic usage
npm run start -- --full-page-screenshot https://example.com/product

# With gpt-4o for higher quality
npm run start -- --full-page-screenshot --vision-model gpt-4o https://example.com/product
```

---

### Future Extensions

Adding a new page type (e.g., PLP):

1. Create `src/heuristics/knowledge/plp/` directory
2. Add category JSON files with PLP-specific heuristics
3. Create `plp/index.ts` aggregator
4. Register in `knowledge/index.ts` loader
5. Vision analyzer automatically works with new heuristics

No code changes needed in analyzer - only knowledge base additions.

---

## Phase 21g: Vision Agent Loop with DOM + Vision Context

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│               VISION AGENT LOOP (Phase 21g)                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  DUAL CONTEXT: DOM + Vision                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                         │   │
│  │  At Each Scroll Position:                                               │   │
│  │  ┌──────────────┐   ┌──────────────┐                                   │   │
│  │  │ DOMExtractor │   │ Screenshot   │   ← Capture BOTH                  │   │
│  │  │ (existing)   │   │ (Playwright) │                                   │   │
│  │  └──────┬───────┘   └──────┬───────┘                                   │   │
│  │         │                  │                                            │   │
│  │         ▼                  ▼                                            │   │
│  │  ┌──────────────┐   ┌──────────────┐                                   │   │
│  │  │ DOMSerializer│   │ Base64 PNG   │                                   │   │
│  │  │ (existing)   │   │              │                                   │   │
│  │  └──────┬───────┘   └──────┬───────┘                                   │   │
│  │         │                  │                                            │   │
│  │         └────────┬─────────┘                                            │   │
│  │                  ▼                                                      │   │
│  │         ┌──────────────────┐                                           │   │
│  │         │ ViewportSnapshot │  { dom, screenshot, scrollPosition }      │   │
│  │         └──────────────────┘                                           │   │
│  │                                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  AGENT LOOP                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                         │   │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │   │
│  │  │   OBSERVE    │───▶│    REASON    │───▶│     ACT      │              │   │
│  │  │              │    │              │    │              │              │   │
│  │  │ - DOM tree   │    │ - GPT-4o-mini│    │ - capture    │              │   │
│  │  │ - Screenshot │    │ - Cross-ref  │    │ - scroll     │              │   │
│  │  │ - State      │    │   DOM+Vision │    │ - evaluate   │              │   │
│  │  │              │    │ - Decide     │    │ - done       │              │   │
│  │  └──────────────┘    └──────────────┘    └──────────────┘              │   │
│  │         ▲                                       │                       │   │
│  │         └───────────────────────────────────────┘                       │   │
│  │              (until all heuristics evaluated)                           │   │
│  │                                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  COST: ~$0.005-0.010/page with gpt-4o-mini                                     │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### File Structure

```
src/agent/vision/                    # NEW: Vision agent module
├── index.ts                         # Exports
├── types.ts                         # VisionAgentState, ViewportSnapshot, etc.
├── vision-agent.ts                  # Main VisionAgent class
├── vision-state-manager.ts          # State tracking
├── vision-prompt-builder.ts         # Prompt construction with DOM + Vision
├── vision-message-manager.ts        # Message history
└── tools/                           # Vision agent tools
    ├── index.ts
    ├── create-vision-registry.ts
    ├── capture-viewport-tool.ts     # Captures DOM + screenshot
    ├── scroll-page-tool.ts
    ├── evaluate-batch-tool.ts
    └── vision-done-tool.ts

tests/
├── unit/
│   └── vision-agent.test.ts         # Unit tests
└── integration/
    └── vision-agent.test.ts         # Integration tests
```

### Key Types

```typescript
// Vision agent state (includes DOM snapshots)
interface VisionAgentState {
  step: number;
  snapshots: ViewportSnapshot[];      // Both DOM + screenshot at each position
  currentScrollY: number;
  pageHeight: number;
  viewportHeight: number;
  allHeuristicIds: string[];
  evaluatedHeuristicIds: Set<string>;
  pendingHeuristicIds: string[];
  evaluations: HeuristicEvaluation[];
  isDone: boolean;
}

// Combined snapshot at each scroll position
interface ViewportSnapshot {
  scrollPosition: number;
  viewportIndex: number;
  screenshot: {
    base64: string;
    capturedAt: number;
  };
  dom: {
    tree: DOMTree;                    // Reuse existing DOMTree type
    serialized: string;               // Pre-serialized for LLM
    elementCount: number;
  };
  heuristicsEvaluated: string[];
}
```

### Prompt Structure

User message includes BOTH contexts:
- `<dom_context>`: Serialized CRO elements with indexes [0], [1], [2]...
- `<pending_heuristics>`: Remaining heuristics to evaluate
- [IMAGE]: Screenshot of current viewport

LLM cross-references: "Element [0] in DOM appears too small in screenshot"

### CLI Usage

```bash
# Vision mode (iterative deep analysis) - CR-001-D simplified API
npm run start -- --vision https://example.com/product

# With gpt-4o for higher quality
npm run start -- --vision --vision-model gpt-4o https://example.com/product

# Deprecated aliases still work:
npm run start -- --vision-agent https://example.com/product  # maps to --vision
```

---

## Phase 21h: Evidence Capture for Heuristic Evaluations

### Overview

Enhance HeuristicEvaluation with 5 evidence fields to enable audit trails and visual documentation.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│               EVIDENCE CAPTURE FLOW (Phase 21h)                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  CAPTURE PHASE (capture-viewport-tool)                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  1. Screenshot → base64                                                 │   │
│  │  2. DOM → serialized with element indices [0], [1], [2]...             │   │
│  │  3. Bounding Boxes → element.boundingBox() for each CRO element        │   │
│  │                                                                         │   │
│  │  ViewportSnapshot {                                                     │   │
│  │    viewportIndex: 0,                                                    │   │
│  │    screenshot: { base64, capturedAt },                                  │   │
│  │    dom: { tree, serialized, elementCount },                            │   │
│  │    elementBoundingBoxes: Map<index, BoundingBox>  ← NEW                │   │
│  │  }                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  EVALUATION PHASE (evaluate-batch-tool → state-manager)                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  LLM returns:                                                           │   │
│  │  {                                                                      │   │
│  │    heuristicId: "PDP-PRICE-001",                                       │   │
│  │    status: "fail",                                                      │   │
│  │    observation: "Element [12] shows price...",                         │   │
│  │    elementIndices: [12, 15],  ← NEW: structured element refs           │   │
│  │    ...                                                                  │   │
│  │  }                                                                      │   │
│  │                                                                         │   │
│  │  State manager enriches with:                                           │   │
│  │  - viewportIndex: from current snapshot                                 │   │
│  │  - timestamp: Date.now()                                                │   │
│  │  - domElementRefs: built from elementIndices + DOM tree                │   │
│  │  - boundingBox: from elementBoundingBoxes map                          │   │
│  │  - screenshotRef: set later if --save-evidence                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  SAVE PHASE (screenshot-writer, optional)                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  --save-evidence flag triggers:                                         │   │
│  │  1. Create evidence/ directory                                          │   │
│  │  2. Save viewport-0.png, viewport-1.png, ...                           │   │
│  │  3. Update screenshotRef in evaluations                                │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Type Definitions

```typescript
// NEW: Evidence types (src/heuristics/vision/types.ts)
interface DOMElementRef {
  index: number;           // Element [N] from serialization
  selector?: string;       // CSS selector
  xpath?: string;          // XPath
  elementType?: string;    // cta, form, trust_signal
  textContent?: string;    // Text snippet
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  viewportIndex: number;
}

// EXTENDED: HeuristicEvaluation
interface HeuristicEvaluation {
  // ... existing fields ...

  // NEW: Evidence fields
  viewportIndex?: number;
  screenshotRef?: string;
  domElementRefs?: DOMElementRef[];
  boundingBox?: BoundingBox;
  timestamp?: number;
}

// EXTENDED: ViewportSnapshot (src/agent/vision/types.ts)
interface ViewportSnapshot {
  // ... existing fields ...

  // NEW: Bounding box cache
  elementBoundingBoxes?: Map<number, BoundingBox>;
}
```

### CLI Integration

```bash
# Vision mode with evidence saving - CR-001-D simplified API
npm run start -- --vision --save-evidence https://example.com/product

# Custom evidence directory
npm run start -- --vision --save-evidence --evidence-dir ./reports/evidence https://example.com/product

# Deprecated aliases still work:
npm run start -- --vision-agent --save-evidence https://example.com/product
```

### Output Format

```
│ 🔴 [PDP-PRICE-001] CRITICAL (80% confidence)
│   Viewport: 0 | Timestamp: 2026-01-14T14:30:00Z
│   Screenshot: evidence/viewport-0.png
│   Elements: [12] .product-price (148,320 72x24), [15] .delivery-info
│   Principle: The full price should be immediately visible...
│   Observation: Element [12] shows price but delivery costs not visible...
│   Issue: Users may be unaware of total costs...
│   Recommendation: Display all costs near primary action button...
```

### File Changes

| File | Change |
|------|--------|
| `src/heuristics/vision/types.ts` | Add DOMElementRef, BoundingBox, extend HeuristicEvaluation |
| `src/agent/vision/types.ts` | Add elementIndices to BatchEvaluation, boundingBoxes to ViewportSnapshot |
| `src/agent/vision/tools/capture-viewport-tool.ts` | Extract bounding boxes via Playwright |
| `src/agent/vision/tools/evaluate-batch-tool.ts` | Accept elementIndices from LLM |
| `src/agent/vision/vision-state-manager.ts` | Attach evidence to evaluations |
| `src/agent/vision/vision-agent.ts` | Pass viewport context |
| `src/agent/vision/vision-prompt-builder.ts` | Instruct LLM on elementIndices |
| `src/output/screenshot-writer.ts` | NEW: Save screenshots to files |
| `src/output/agent-progress-formatter.ts` | Display evidence in output |
| `src/cli.ts` | Add --save-evidence, --evidence-dir flags |

---

## Phase 21i: DOM-Screenshot Coordinate Mapping

### Summary

Implement **explicit coordinate mapping** between DOM elements and their visual positions in screenshots, enabling verification of LLM observations and precise element targeting.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│               DOM-SCREENSHOT COORDINATE MAPPING (Phase 21i)                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  COORDINATE TRANSFORMATION                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                         │   │
│  │  DOM Element                         Screenshot                         │   │
│  │  ───────────                         ──────────                         │   │
│  │                                                                         │   │
│  │  boundingBox: {                      Captured at scrollY = 800          │   │
│  │    x: 120,      (page coords)        Viewport: 1280 x 720               │   │
│  │    y: 1150,     ◀────────────────┐                                     │   │
│  │    width: 200,                   │   ┌────────────────────────┐        │   │
│  │    height: 50                    │   │                        │        │   │
│  │  }                               │   │    ┌─────────────┐     │        │   │
│  │                                  │   │    │ Element [5] │     │  y=350 │   │
│  │  TRANSFORM:                      │   │    └─────────────┘     │        │   │
│  │  screenshotY = pageY - scrollY   │   │                        │        │   │
│  │  screenshotY = 1150 - 800 = 350 ─┘   └────────────────────────┘        │   │
│  │                                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  DATA FLOW                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                         │   │
│  │  1. CAPTURE                                                             │   │
│  │     page.screenshot() ─────────────────────┐                           │   │
│  │     domExtractor.extract() ────────────────┼──▶ ViewportSnapshot       │   │
│  │     mapElementsToScreenshot() ─────────────┘    {                      │   │
│  │                                                   screenshot,           │   │
│  │  2. PROMPT                                        dom,                  │   │
│  │     buildUserPrompt(snapshot, heuristics)         elementMappings,     │   │
│  │     ↓                                             visibleElements      │   │
│  │     "[5] <button> 'Add to Cart' → (120, 350)"   }                      │   │
│  │                                                                         │   │
│  │  3. LLM EVALUATION                                                      │   │
│  │     GPT-4o Vision analyzes screenshot + coordinates                    │   │
│  │     ↓                                                                   │   │
│  │     "Element [5] at (120, 350) has insufficient contrast..."           │   │
│  │                                                                         │   │
│  │  4. PARSE                                                               │   │
│  │     parseEvaluationWithElements(response)                              │   │
│  │     ↓                                                                   │   │
│  │     { heuristicId, status, relatedElements: [5] }                      │   │
│  │                                                                         │   │
│  │  5. ENRICH                                                              │   │
│  │     Lookup element [5] in mappings                                     │   │
│  │     ↓                                                                   │   │
│  │     Add xpath, selector, boundingBox to evaluation                     │   │
│  │                                                                         │   │
│  │  6. ANNOTATE (optional)                                                 │   │
│  │     annotateScreenshot() ─────▶ Visual evidence with boxes             │   │
│  │                                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### File Structure

```
src/browser/dom/
├── coordinate-mapper.ts          # NEW: Coordinate transformation functions
└── index.ts                      # MODIFY: Export coordinate mapper

src/agent/vision/
├── types.ts                      # MODIFY: Add ElementMapping, extend ViewportSnapshot
├── tools/capture-viewport-tool.ts # MODIFY: Create element mappings
├── vision-prompt-builder.ts      # MODIFY: Include coordinates in prompt
└── index.ts                      # MODIFY: Export new types

src/heuristics/vision/
├── response-parser.ts            # MODIFY: Parse element references from response
└── types.ts                      # MODIFY: Add relatedElements to evaluation

src/output/
├── screenshot-annotator.ts       # NEW: Draw bounding boxes on screenshots
└── index.ts                      # MODIFY: Export annotator

tests/
├── unit/
│   ├── coordinate-mapper.test.ts # NEW: Coordinate transformation tests
│   └── screenshot-annotator.test.ts # NEW: Annotation tests
└── integration/
    └── dom-screenshot-mapping.test.ts # NEW: End-to-end mapping tests
```

### Key Types

```typescript
// src/browser/dom/coordinate-mapper.ts

interface ScreenshotCoords {
  x: number;
  y: number;
  width: number;
  height: number;
  isVisible: boolean;  // Is element within screenshot bounds?
}

interface ElementMapping {
  index: number;              // Element index [5]
  xpath: string;              // /html/body/.../button
  text: string;               // Element text content
  croType: CROType;           // cta, form, trust, etc.
  pageCoords: BoundingBox;    // Absolute page coordinates
  screenshotCoords: ScreenshotCoords;  // Relative to screenshot
}

// Extended ViewportSnapshot (src/agent/vision/types.ts)
interface ViewportSnapshot {
  // ... existing fields ...

  // NEW: Element-to-screenshot mapping
  elementMappings: ElementMapping[];
  visibleElements: ElementMapping[];  // Filtered to visible only
}

// Extended HeuristicEvaluation
interface ParsedEvaluation extends HeuristicEvaluation {
  relatedElements: number[];  // Element indexes mentioned in observation
}
```

### Coordinate Mapper Implementation

```typescript
// src/browser/dom/coordinate-mapper.ts

/**
 * Transform page coordinates to screenshot-relative coordinates
 */
function toScreenshotCoords(
  pageCoords: BoundingBox,
  scrollY: number,
  viewportHeight: number
): ScreenshotCoords {
  const screenshotY = pageCoords.y - scrollY;

  // Element is visible if at least partially in viewport
  const isVisible = (
    screenshotY + pageCoords.height > 0 &&  // Not above viewport
    screenshotY < viewportHeight             // Not below viewport
  );

  return {
    x: pageCoords.x,
    y: screenshotY,
    width: pageCoords.width,
    height: pageCoords.height,
    isVisible
  };
}

/**
 * Map all indexed DOM elements to screenshot coordinates
 */
function mapElementsToScreenshot(
  domTree: DOMTree,
  scrollY: number,
  viewport: { width: number; height: number }
): ElementMapping[] {
  const mappings: ElementMapping[] = [];

  function traverse(node: DOMNode) {
    if (node.index !== undefined && node.boundingBox) {
      const screenshotCoords = toScreenshotCoords(
        node.boundingBox,
        scrollY,
        viewport.height
      );

      mappings.push({
        index: node.index,
        xpath: node.xpath,
        text: node.text,
        croType: node.croType,
        pageCoords: node.boundingBox,
        screenshotCoords
      });
    }
    node.children.forEach(traverse);
  }

  traverse(domTree.root);
  return mappings;
}
```

### Prompt Enhancement

```typescript
// src/agent/vision/vision-prompt-builder.ts

function formatDOMContextWithCoords(
  visibleElements: ElementMapping[]
): string {
  let context = `### Visible Elements (with screenshot coordinates)\n`;
  context += `Format: [index] <tag> "text" → position (x, y, width × height)\n\n`;

  for (const elem of visibleElements) {
    const { x, y, width, height } = elem.screenshotCoords;
    const tag = getTagFromXpath(elem.xpath);
    const text = elem.text.slice(0, 30);
    context += `[${elem.index}] <${tag}> "${text}" → (${x}, ${y}, ${width}×${height})\n`;
  }

  context += `\n### IMPORTANT: Reference Elements by Index\n`;
  context += `When reporting issues, specify which element [index] is affected.\n`;
  context += `Example: "Element [5] at (120, 350) has low contrast..."\n`;

  return context;
}
```

### Response Parser Enhancement

```typescript
// src/heuristics/vision/response-parser.ts

function parseEvaluationWithElements(raw: RawLLMEvaluation): ParsedEvaluation {
  // Extract element references like [5], [12] from text
  const elementPattern = /\[(\d+)\]/g;
  const allText = `${raw.observation} ${raw.issue || ''} ${raw.recommendation || ''}`;
  const matches = [...allText.matchAll(elementPattern)];

  const relatedElements = [...new Set(matches.map(m => parseInt(m[1])))];

  return {
    heuristicId: raw.heuristicId,
    status: normalizeStatus(raw.status),
    observation: raw.observation,
    issue: raw.issue,
    recommendation: raw.recommendation,
    confidence: raw.confidence,
    relatedElements
  };
}
```

### CLI Integration

```bash
# Enable annotated screenshots - CR-001-D simplified API
npm run start -- --vision --annotate-screenshots https://example.com/product

# With evidence saving (combines with Phase 21h)
npm run start -- --vision --save-evidence --annotate-screenshots https://example.com/product

# Deprecated alias still works:
npm run start -- --vision-agent --annotate-screenshots https://example.com/product
```

### Benefits Summary

| Benefit | Without Mapping | With Mapping |
|---------|-----------------|--------------|
| **Verification** | Trust LLM blindly | Validate against actual DOM |
| **Precision** | "A button somewhere" | "Element [5] at (120,350)" |
| **Deduplication** | By heuristic ID only | By element identity |
| **Evidence** | Text description | Annotated screenshot |
| **Automation** | Manual follow-up | Auto-generate fixes |
| **Confidence** | LLM self-reported | Validated by system |

---

## Phase 21l: Default Evidence & Mapping

### Summary

Make DOM-screenshot mapping and evidence saving part of the default vision workflow. Currently these features require explicit CLI flags (`--save-evidence`, `--annotate-screenshots`). This phase flips the defaults so they're ON by default, with opt-out flags for minimal output.

### Motivation

```
CURRENT (suboptimal):
npm run start -- --vision https://example.com
→ No evidence saved, no annotations

npm run start -- --vision --save-evidence --annotate-screenshots https://example.com
→ Full evidence (but user must remember 2 extra flags)

AFTER PHASE 21l:
npm run start -- --vision https://example.com
→ Full evidence saved by default

npm run start -- --vision --no-save-evidence https://example.com
→ Opt-out when needed
```

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DEFAULT EVIDENCE FLOW (Phase 21l)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CLI: --vision https://example.com                                          │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ parseArgs()                                                          │   │
│  │   saveEvidence = true        (was false)                            │   │
│  │   annotateScreenshots = true (was false)                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Default Evidence Directory                                           │   │
│  │   if (!evidenceDir) {                                                │   │
│  │     evidenceDir = `./evidence/${timestamp}`;                        │   │
│  │   }                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Vision Analysis                                                      │   │
│  │   → Capture viewports (existing)                                     │   │
│  │   → Map DOM to screenshots (existing)                                │   │
│  │   → Annotate screenshots (now default)                               │   │
│  │   → Save evidence (now default)                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       ▼                                                                     │
│  Output: ./evidence/2026-02-03T10-30-00/                                    │
│          ├── viewport-0.png (annotated)                                     │
│          ├── viewport-1.png (annotated)                                     │
│          └── evidence.json                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### CLI Changes

| Before | After |
|--------|-------|
| `--save-evidence` (opt-in) | `--no-save-evidence` (opt-out) |
| `--annotate-screenshots` (opt-in) | `--no-annotate-screenshots` (opt-out) |
| Default: no evidence | Default: evidence saved |

### Implementation Details

```typescript
// src/cli.ts - Key changes

// 1. Flip defaults
let saveEvidence = true;         // was false
let annotateScreenshots = true;  // was false

// 2. Add opt-out flags
} else if (arg === '--no-save-evidence') {
  saveEvidence = false;
} else if (arg === '--no-annotate-screenshots') {
  annotateScreenshots = false;
}

// 3. Default evidence directory with timestamp
if (saveEvidence && !evidenceDir) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  evidenceDir = `./evidence/${timestamp}`;
}
```

### Backward Compatibility

Old scripts using explicit flags will continue to work:
```bash
# These still work (just redundant now)
npm run start -- --vision --save-evidence https://example.com
npm run start -- --vision --annotate-screenshots https://example.com
```

### Tasks

See [tasks/phase-21l.md](../tasks/phase-21l.md) for detailed task breakdown.

| Task | Description |
|------|-------------|
| T391 | Change `saveEvidence` default to `true` |
| T392 | Change `annotateScreenshots` default to `true` |
| T393 | Add `--no-save-evidence` opt-out flag |
| T394 | Add `--no-annotate-screenshots` opt-out flag |
| T395 | Create default evidence directory with timestamp |
| T396 | Update CLI help text |
| T397 | Update examples in help |
| T398 | Unit tests for new defaults |
| T399 | Integration tests for evidence creation |
