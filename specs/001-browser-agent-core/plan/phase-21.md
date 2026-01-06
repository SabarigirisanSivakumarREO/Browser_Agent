**Navigation**: [Index](./index.md) | [Previous](./phase-20.md) | Next

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
      model: 'gpt-4o',
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
| 21d | Integration (PageState + Agent + CLI) | 5 | 23+ | Pending 📋 |

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

### Future Extensions

Adding a new page type (e.g., PLP):

1. Create `src/heuristics/knowledge/plp/` directory
2. Add category JSON files with PLP-specific heuristics
3. Create `plp/index.ts` aggregator
4. Register in `knowledge/index.ts` loader
5. Vision analyzer automatically works with new heuristics

No code changes needed in analyzer - only knowledge base additions.
