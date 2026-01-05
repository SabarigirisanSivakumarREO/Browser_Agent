**Navigation**: [Index](./index.md) | [Previous](./phase-16.md) | [Next](./phase-18.md)
### Phase 17: CRO Tools Implementation Details

**Purpose**: Implement all CRO-specific tools with defined schemas, insight types, and tests.

**Directory Structure**:
```
src/agent/tools/cro/
├── index.ts              # Barrel exports
├── analyze-ctas.ts       # ✅ EXISTS (Phase 15b)
├── scroll-tool.ts        # NEW (T091)
├── click-tool.ts         # NEW (T092)
├── analyze-forms-tool.ts # NEW (T093)
├── analyze-trust-tool.ts # NEW (T094)
├── analyze-value-prop-tool.ts # NEW (T095)
├── record-insight-tool.ts # NEW (T096)
└── done-tool.ts          # NEW (T097)
```

#### Tool Categories

**1. Navigation Tools** - Change page state, return no insights

| Tool | Purpose | Parameters | Returns |
|------|---------|------------|---------|
| `scroll_page` | Scroll viewport | direction, amount | newY, atBottom |
| `click` | Click element | elementIndex, waitForNavigation | clickedElement |

**2. Analysis Tools** - Examine elements, return CROInsight[]

| Tool | Purpose | Parameters | Insight Count |
|------|---------|------------|---------------|
| `analyze_ctas` | CTA clarity/placement | focusArea, minConfidence | 6 types |
| `analyze_forms` | Form UX issues | formSelector, includeHidden | 6 types |
| `detect_trust_signals` | Trust signal presence | focusArea | 5 types |
| `assess_value_prop` | Headline clarity | checkH1Only | 5 types |

**3. Control Tools** - Agent state management

| Tool | Purpose | Parameters | Behavior |
|------|---------|------------|----------|
| `record_insight` | Manual insight | type, severity, issue, recommendation | Creates CROInsight |
| `done` | Signal completion | summary, confidenceScore | Triggers agent exit |

#### Tool Interface Implementations

**scroll-tool.ts** (T091):
```typescript
import { z } from 'zod';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult } from '../../../models/index.js';

export const ScrollParamsSchema = z.object({
  direction: z.enum(['up', 'down', 'top', 'bottom']),
  amount: z.number().positive().optional().default(500),
});

export const scrollTool: Tool = {
  name: 'scroll_page',
  description: 'Scroll the page to reveal more content. Use to analyze below-the-fold elements.',
  parameters: ScrollParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as z.infer<typeof ScrollParamsSchema>;
    const page = context.page;

    const previousY = await page.evaluate(() => window.scrollY);

    switch (params.direction) {
      case 'down':
        await page.evaluate((amt) => window.scrollBy(0, amt), params.amount);
        break;
      case 'up':
        await page.evaluate((amt) => window.scrollBy(0, -amt), params.amount);
        break;
      case 'top':
        await page.evaluate(() => window.scrollTo(0, 0));
        break;
      case 'bottom':
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        break;
    }

    const newY = await page.evaluate(() => window.scrollY);
    const maxY = await page.evaluate(() =>
      document.documentElement.scrollHeight - window.innerHeight
    );

    return {
      success: true,
      insights: [], // Navigation tool - no insights
      extracted: {
        previousY,
        newY,
        atTop: newY === 0,
        atBottom: newY >= maxY - 1,
      },
    };
  },
};
```

**click-tool.ts** (T092):
```typescript
import { z } from 'zod';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult, DOMNode } from '../../../models/index.js';

export const ClickParamsSchema = z.object({
  elementIndex: z.number().int().positive(),
  waitForNavigation: z.boolean().optional().default(false),
});

export const clickTool: Tool = {
  name: 'click',
  description: 'Click an element by its index number. Use for expanding sections or testing interactions.',
  parameters: ClickParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as z.infer<typeof ClickParamsSchema>;
    const { page, state, logger } = context;

    // Find element by index in DOM tree
    const element = findElementByIndex(state.domTree.root, params.elementIndex);

    if (!element) {
      return {
        success: false,
        insights: [],
        error: `Element with index ${params.elementIndex} not found`,
      };
    }

    if (!element.isVisible) {
      return {
        success: false,
        insights: [],
        error: `Element ${params.elementIndex} is not visible`,
      };
    }

    try {
      const locator = page.locator(`xpath=${element.xpath}`);

      if (params.waitForNavigation) {
        await Promise.all([
          page.waitForNavigation({ timeout: 5000 }).catch(() => null),
          locator.click(),
        ]);
      } else {
        await locator.click();
      }

      const navigationOccurred = page.url() !== state.url;

      return {
        success: true,
        insights: [],
        extracted: {
          clickedElement: element.xpath,
          elementText: element.text,
          navigationOccurred,
        },
      };
    } catch (error) {
      return {
        success: false,
        insights: [],
        error: `Click failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

function findElementByIndex(node: DOMNode, index: number): DOMNode | null {
  if (node.index === index) return node;
  for (const child of node.children) {
    const found = findElementByIndex(child, index);
    if (found) return found;
  }
  return null;
}
```

**analyze-forms-tool.ts** (T093):
```typescript
import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult, CROInsight, DOMNode } from '../../../models/index.js';

export const AnalyzeFormsParamsSchema = z.object({
  formSelector: z.string().optional(),
  includeHiddenFields: z.boolean().optional().default(false),
});

// Insight type constants
const INSIGHT_TYPES = {
  FORM_FIELD_OVERLOAD: 'form_field_overload',
  MISSING_FIELD_LABEL: 'missing_field_label',
  MISSING_INPUT_TYPE: 'missing_input_type',
  NO_REQUIRED_INDICATOR: 'no_required_indicator',
  NO_ERROR_CONTAINER: 'no_error_container',
  NO_SUBMIT_BUTTON: 'no_submit_button',
} as const;

export const analyzeFormsTool: Tool = {
  name: 'analyze_forms',
  description: 'Analyze form elements for UX issues: field count, labels, validation, submit buttons.',
  parameters: AnalyzeFormsParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as z.infer<typeof AnalyzeFormsParamsSchema>;
    const insights: CROInsight[] = [];
    const forms: DOMNode[] = [];

    collectForms(context.state.domTree.root, forms);
    context.logger.debug(`Found ${forms.length} forms`);

    for (const form of forms) {
      const fields = getFormFields(form, params.includeHiddenFields);

      // F001: Form Field Overload (>5 fields)
      if (fields.length > 5) {
        insights.push({
          id: randomUUID().slice(0, 8),
          type: INSIGHT_TYPES.FORM_FIELD_OVERLOAD,
          severity: 'high',
          element: form.xpath,
          issue: `Form has ${fields.length} fields. Forms with >5 fields have higher abandonment rates`,
          recommendation: 'Reduce to essential fields only. Consider multi-step form or progressive disclosure',
          category: 'form',
        });
      }

      // F002-F006: Additional checks per field...
      for (const field of fields) {
        // F002: Missing label
        if (!hasLabel(field)) {
          insights.push({
            id: randomUUID().slice(0, 8),
            type: INSIGHT_TYPES.MISSING_FIELD_LABEL,
            severity: 'medium',
            element: field.xpath,
            issue: 'Input field missing visible label or placeholder',
            recommendation: 'Add descriptive label above field for clarity',
            category: 'form',
          });
        }

        // F003: Missing input type
        if (field.tagName === 'INPUT' && !hasInputType(field)) {
          insights.push({
            id: randomUUID().slice(0, 8),
            type: INSIGHT_TYPES.MISSING_INPUT_TYPE,
            severity: 'medium',
            element: field.xpath,
            issue: 'Input lacks type attribute, defaults to text',
            recommendation: 'Specify type (email, tel, number) for mobile keyboard optimization',
            category: 'form',
          });
        }
      }

      // F006: No submit button
      if (!hasSubmitButton(form)) {
        insights.push({
          id: randomUUID().slice(0, 8),
          type: INSIGHT_TYPES.NO_SUBMIT_BUTTON,
          severity: 'high',
          element: form.xpath,
          issue: 'Form has no visible submit button',
          recommendation: 'Add clear submit button with action-oriented text',
          category: 'form',
        });
      }
    }

    return {
      success: true,
      insights,
      extracted: {
        totalForms: forms.length,
        totalFields: forms.reduce((sum, f) => sum + getFormFields(f, false).length, 0),
      },
    };
  },
};

// Helper functions omitted for brevity
```

**analyze-trust-tool.ts** (T094):
```typescript
import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult, CROInsight, DOMNode } from '../../../models/index.js';

export const AnalyzeTrustParamsSchema = z.object({
  focusArea: z.string().optional().default('full_page'),
}).transform((data) => ({
  focusArea: normalizeAreaParam(data.focusArea), // Handles LLM variations like "aboveFold", "above-fold"
}));

const INSIGHT_TYPES = {
  NO_TRUST_SIGNALS: 'no_trust_signals',
  NO_REVIEWS: 'no_reviews',
  NO_SECURITY_BADGE: 'no_security_badge',
  TRUST_SIGNAL_PLACEMENT: 'trust_signal_placement',
  UNVERIFIED_CLAIMS: 'unverified_claims',
} as const;

export const analyzeTrustTool: Tool = {
  name: 'detect_trust_signals',
  description: 'Detect trust signals: reviews, badges, testimonials, security seals, guarantees.',
  parameters: AnalyzeTrustParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as z.infer<typeof AnalyzeTrustParamsSchema>;
    const insights: CROInsight[] = [];
    const trustElements: DOMNode[] = [];

    collectTrustElements(context.state.domTree.root, trustElements);

    // Filter by focus area
    let targetElements = trustElements;
    if (params.focusArea === 'above_fold') {
      const vh = context.state.viewport.height;
      targetElements = trustElements.filter(e => e.boundingBox && e.boundingBox.y < vh);
    }

    // TR001: No trust signals above fold
    const aboveFoldTrust = trustElements.filter(e =>
      e.boundingBox && e.boundingBox.y < context.state.viewport.height
    );
    if (aboveFoldTrust.length === 0) {
      insights.push({
        id: randomUUID().slice(0, 8),
        type: INSIGHT_TYPES.NO_TRUST_SIGNALS,
        severity: 'medium',
        element: '',
        issue: 'No trust signals visible above the fold',
        recommendation: 'Add trust badges, ratings, or testimonials near primary CTA',
        category: 'trust',
      });
    }

    // TR002-TR005: Additional checks...

    return {
      success: true,
      insights,
      extracted: {
        totalTrustElements: trustElements.length,
        aboveFoldCount: aboveFoldTrust.length,
      },
    };
  },
};
```

**analyze-value-prop-tool.ts** (T095):
```typescript
import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult, CROInsight, DOMNode } from '../../../models/index.js';

export const AnalyzeValuePropParamsSchema = z.object({
  checkH1Only: z.boolean().optional().default(false),
});

const INSIGHT_TYPES = {
  MISSING_H1: 'missing_h1',
  MULTIPLE_H1: 'multiple_h1',
  GENERIC_HEADLINE: 'generic_headline',
  NO_SUBHEADLINE: 'no_subheadline',
  HEADLINE_TOO_LONG: 'headline_too_long',
} as const;

const GENERIC_PATTERNS = [
  /^welcome$/i,
  /^home$/i,
  /^homepage$/i,
  /^untitled$/i,
  /^page\s*\d*$/i,
];

export const analyzeValuePropTool: Tool = {
  name: 'assess_value_prop',
  description: 'Analyze headlines and value proposition clarity. Checks H1/H2 for specificity and benefit communication.',
  parameters: AnalyzeValuePropParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as z.infer<typeof AnalyzeValuePropParamsSchema>;
    const insights: CROInsight[] = [];
    const valueProps: DOMNode[] = [];

    collectValueProps(context.state.domTree.root, valueProps);

    const h1Elements = valueProps.filter(e => e.tagName === 'H1');
    const h2Elements = valueProps.filter(e => e.tagName === 'H2');

    // VP001: Missing H1
    if (h1Elements.length === 0) {
      insights.push({
        id: randomUUID().slice(0, 8),
        type: INSIGHT_TYPES.MISSING_H1,
        severity: 'high',
        element: '',
        issue: 'Page has no H1 heading. Primary value proposition unclear',
        recommendation: 'Add clear H1 that communicates core benefit or offering',
        category: 'value_prop',
      });
    }

    // VP002: Multiple H1
    if (h1Elements.length > 1) {
      insights.push({
        id: randomUUID().slice(0, 8),
        type: INSIGHT_TYPES.MULTIPLE_H1,
        severity: 'medium',
        element: h1Elements[1]?.xpath || '',
        issue: `Page has ${h1Elements.length} H1 elements. Dilutes focus`,
        recommendation: 'Use single H1 for main value prop, H2-H6 for sections',
        category: 'value_prop',
      });
    }

    // VP003: Generic headline
    for (const h1 of h1Elements) {
      const text = h1.text?.trim() || '';
      if (GENERIC_PATTERNS.some(p => p.test(text))) {
        insights.push({
          id: randomUUID().slice(0, 8),
          type: INSIGHT_TYPES.GENERIC_HEADLINE,
          severity: 'medium',
          element: h1.xpath,
          issue: `Generic H1: "${text}". Fails to communicate value`,
          recommendation: 'Rewrite to highlight specific benefit or unique value',
          category: 'value_prop',
          evidence: { text },
        });
      }

      // VP005: Headline too long
      const wordCount = text.split(/\s+/).length;
      if (wordCount > 10) {
        insights.push({
          id: randomUUID().slice(0, 8),
          type: INSIGHT_TYPES.HEADLINE_TOO_LONG,
          severity: 'low',
          element: h1.xpath,
          issue: `H1 has ${wordCount} words. May lose reader attention`,
          recommendation: 'Condense to <10 words, move details to subheadline',
          category: 'value_prop',
          evidence: { text },
        });
      }
    }

    // VP004: No subheadline
    if (h1Elements.length > 0 && h2Elements.length === 0) {
      insights.push({
        id: randomUUID().slice(0, 8),
        type: INSIGHT_TYPES.NO_SUBHEADLINE,
        severity: 'low',
        element: '',
        issue: 'H1 present but no H2 to support value proposition',
        recommendation: 'Add H2 subheadline to elaborate on primary benefit',
        category: 'value_prop',
      });
    }

    return {
      success: true,
      insights,
      extracted: {
        h1Count: h1Elements.length,
        h2Count: h2Elements.length,
        h1Text: h1Elements[0]?.text || null,
      },
    };
  },
};
```

**record-insight-tool.ts** (T096):
```typescript
import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult, CROInsight } from '../../../models/index.js';

export const RecordInsightParamsSchema = z.object({
  type: z.string().min(1),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  element: z.string().optional(),
  issue: z.string().min(1),
  recommendation: z.string().min(1),
  category: z.string().optional().default('custom'),
});

export const recordInsightTool: Tool = {
  name: 'record_insight',
  description: 'Manually record a CRO observation. Use when you identify an issue not covered by other tools.',
  parameters: RecordInsightParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as z.infer<typeof RecordInsightParamsSchema>;
    const insightId = randomUUID().slice(0, 8);

    const insight: CROInsight = {
      id: insightId,
      type: params.type,
      severity: params.severity,
      element: params.element || '',
      issue: params.issue,
      recommendation: params.recommendation,
      category: params.category,
    };

    context.logger.info('Recorded manual insight', { id: insightId, type: params.type });

    return {
      success: true,
      insights: [insight],
      extracted: { insightId },
    };
  },
};
```

**done-tool.ts** (T097):
```typescript
import { z } from 'zod';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult } from '../../../models/index.js';

export const DoneParamsSchema = z.object({
  summary: z.string().min(1).describe('Brief summary of analysis findings'),
  confidenceScore: z.number().min(0).max(1).optional().describe('Confidence in analysis completeness (0-1)'),
});

export const doneTool: Tool = {
  name: 'done',
  description: 'Signal analysis completion. Call when all CRO aspects have been examined or no more actionable elements.',
  parameters: DoneParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as z.infer<typeof DoneParamsSchema>;

    context.logger.info('Analysis complete', { summary: params.summary });

    // Note: CROAgent checks action.name === 'done' to set isDone state
    // This tool just validates params and returns success

    return {
      success: true,
      insights: [], // Control tool - no insights
      extracted: {
        summary: params.summary,
        confidenceScore: params.confidenceScore ?? null,
      },
    };
  },
};
```

#### Updated CROActionNames

```typescript
// src/models/tool-definition.ts
export const CROActionNames = [
  // Analysis tools
  'analyze_ctas',
  'analyze_forms',
  'detect_trust_signals',
  'assess_value_prop',
  'check_navigation',
  'find_friction',
  // Navigation tools
  'scroll_page',
  'click',           // NEW - was missing
  'go_to_url',
  // Control tools
  'record_insight',  // NEW
  'done',
] as const;
```

#### Phase 17 Test Matrix (Split into Sub-Phases)

**Phase 17a: Navigation Tools (18 tests)**
| Tool | Unit Tests | Key Scenarios |
|------|------------|---------------|
| scroll-tool | 6 | directions, boundaries, amount |
| click-tool | 7 | valid/invalid index, hidden, navigation |
| go-to-url-tool | 5 | URL validation, timing, waitUntil |
| **17a Total** | **18** | |

**Phase 17b: Analysis Tools (46 tests)**
| Tool | Unit Tests | Key Scenarios |
|------|------------|---------------|
| analyze-forms | 12 | field count, labels, types, submit |
| analyze-trust | 10 | badges, reviews, guarantees, placement |
| analyze-value-prop | 10 | H1 count, generic text, length |
| check-navigation | 8 | nav, breadcrumbs, search, depth |
| find-friction | 6 | categories, scoring, filtering |
| **17b Total** | **46** | |

**Phase 17c: Control + Integration (27 tests)**
| Tool | Unit Tests | Key Scenarios |
|------|------------|---------------|
| record-insight | 5 | valid params, severity, category |
| done-tool | 4 | summary, confidence validation |
| Integration | 18 | chaining, executor, registry |
| **17c Total** | **27** | |

**Phase 17 Grand Total**: 91 tests (73 unit + 18 integration)

### Dependencies (New)

```json
{
  "@langchain/core": "^0.3.x"  // Already peer dep of @langchain/openai
}
```

No new production dependencies required. Zod already installed.

### Test Strategy (CRO Agent)

**Unit Tests**:
- DOM extraction with mock HTML
- Tool registry registration/execution
- Output parser validation
- Heuristic rule checks
- Serializer token counting

**Integration Tests**:
- CROAgent with real page (example.com)
- Tool execution with mock page state
- Business type detection

**E2E Tests**:
- Full CRO analysis on 3 test sites (ecommerce, saas, other)
- Verify insights generated
- Verify hypothesis output
- Verify report format

---

