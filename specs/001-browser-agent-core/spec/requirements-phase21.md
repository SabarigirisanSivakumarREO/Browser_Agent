# Requirements: Phase 21 (Vision-Based CRO Heuristics)

**Navigation**: [Index](./index.md) | [CRO Requirements](./requirements-cro.md) | [Phase 19-20](./requirements-phase19-20.md)

---

## Overview

Phase 21 implements a **vision-based CRO heuristics system** that uses GPT-4o Vision to analyze page screenshots against a knowledge base of UX best practices from Baymard Institute research.

**Key Insight**: Selector-based DOM detection is unreliable across different ecommerce platforms. Vision-based analysis sees what users see and can evaluate nuanced UX principles.

**Architecture**:
- **Knowledge Base**: Heuristics stored as structured JSON, organized by page type
- **Vision Analyzer**: GPT-4o analyzes screenshots against loaded heuristics
- **Extensible**: Add new page types by adding knowledge files + prompts

**Starting Point**: PDP (Product Detail Page) - extensible to PLP, Homepage, Cart, Checkout

---

## Phase 21a: Foundation (PageType Detection) - COMPLETE

**Functional Requirements** (Already Implemented):
- **FR-171**: System MUST provide PageType enum: 'pdp' | 'plp' | 'homepage' | 'cart' | 'checkout' | 'account' | 'other'
- **FR-172**: System MUST provide PageTypeResult interface with type, confidence, and signals
- **FR-173**: System MUST provide PageTypeSignals with urlPatterns, elementSelectors, and keywords
- **FR-174**: System MUST provide PageTypeDetector class that detects page type from PageState
- **FR-175**: PageTypeDetector MUST use weighted scoring: URL (45%), elements (35%), keywords (20%)
- **FR-176**: PageTypeDetector MUST return confidence score and detection signals
- **FR-177**: PageTypeDetector MUST detect homepage from root URL path
- **FR-178**: PageTypeDetector MUST default to 'other' when confidence < threshold (0.5)

---

## Phase 21b: Heuristics Knowledge Base

### Knowledge Base Structure

**Functional Requirements**:
- **FR-222**: System MUST provide HeuristicItem interface with id, principle, checkpoints, severity, category
- **FR-223**: System MUST provide HeuristicCategory interface grouping related heuristics
- **FR-224**: System MUST provide PageTypeHeuristics interface aggregating all categories for a page type
- **FR-225**: System MUST store heuristics as JSON files in `src/heuristics/knowledge/{pageType}/`
- **FR-226**: System MUST provide loadHeuristics(pageType) function to load knowledge base
- **FR-227**: System MUST support 10 PDP heuristic categories from Baymard research

### PDP Heuristic Categories

**FR-228**: PDP knowledge base MUST include these 10 categories:

| Category | File | Heuristics |
|----------|------|------------|
| Layout & Structure | layout-structure.json | 4 |
| Product Imagery & Media | imagery-media.json | 4 |
| Pricing & Cost Transparency | pricing-transparency.json | 4 |
| Description & Value Proposition | description-value-prop.json | 3 |
| Specifications & Details | specifications.json | 3 |
| Reviews & Social Proof | reviews-social-proof.json | 4 |
| Selection & Configuration | selection-configuration.json | 3 |
| CTA & Purchase Confidence | cta-purchase-confidence.json | 4 |
| Mobile Usability | mobile-usability.json | 3 |
| Utility & Secondary Actions | utility-secondary.json | 3 |

### Heuristic Item Schema

**FR-229**: Each HeuristicItem MUST have:
```typescript
interface HeuristicItem {
  id: string;                    // e.g., "PDP-LAYOUT-001"
  principle: string;             // The UX principle from Baymard
  checkpoints: string[];         // Specific things to verify visually
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;              // Parent category name
}
```

### PDP Heuristics Content (From Baymard Research)

**Layout & Structure** (FR-230):
- PDP-LAYOUT-001: Page should follow clear vertical flow supporting natural scanning
- PDP-LAYOUT-002: Critical info (price, delivery, returns, specs) not hidden in horizontal tabs
- PDP-LAYOUT-003: Expandable sections clearly labelled and easy to open
- PDP-LAYOUT-004: Visual hierarchy prioritises product name, imagery, price, primary action

**Product Imagery & Media** (FR-231):
- PDP-IMAGE-001: Images clearly communicate product's real-world size and proportions
- PDP-IMAGE-002: Contextual imagery shows product in use or on human model where relevant
- PDP-IMAGE-003: Multiple image angles available with zoom or high-resolution viewing
- PDP-IMAGE-004: Media loads quickly and doesn't block access to key purchasing actions

**Pricing & Cost Transparency** (FR-232):
- PDP-PRICE-001: Full price immediately visible without requiring interaction (critical)
- PDP-PRICE-002: Unit pricing shown where quantity or size varies
- PDP-PRICE-003: Delivery costs, taxes, fees clearly signposted near primary action
- PDP-PRICE-004: Promotions or discounts explained clearly without ambiguity

**Description & Value Proposition** (FR-233):
- PDP-DESC-001: Primary description explains what product is and who it's for in plain language
- PDP-DESC-002: Key benefits easy to scan, not buried in long paragraphs
- PDP-DESC-003: Claims supported by evidence (specifications, reviews, imagery)

**Specifications & Details** (FR-234):
- PDP-SPEC-001: Technical specifications scannable and consistently formatted
- PDP-SPEC-002: Terminology explained where not universally understood
- PDP-SPEC-003: Specification content complete, not relying on external documentation

**Reviews & Social Proof** (FR-235):
- PDP-REVIEW-001: Reviews visible on product page without navigation away
- PDP-REVIEW-002: Summary indicators (average rating, count) visible near title or price
- PDP-REVIEW-003: Users can scan and filter reviews by relevance or rating
- PDP-REVIEW-004: Review content includes both positive and critical feedback

**Selection & Configuration** (FR-236):
- PDP-SELECT-001: Variant selection (size, colour, config) clear and unambiguous
- PDP-SELECT-002: Unavailable options clearly labelled and not selectable
- PDP-SELECT-003: Impact of selections on price, availability, delivery immediately visible

**CTA & Purchase Confidence** (FR-237):
- PDP-CTA-001: Primary CTA visually distinct and clearly labelled (critical)
- PDP-CTA-002: CTA remains accessible as users scroll, particularly on mobile
- PDP-CTA-003: Reassurance (returns, delivery, guarantees) visible near action
- PDP-CTA-004: No preventable blockers at point of adding to basket

**Mobile Usability** (FR-238):
- PDP-MOBILE-001: Interactive elements easy to tap without precision
- PDP-MOBILE-002: Important information not hidden behind excessive scrolling/interaction
- PDP-MOBILE-003: Purchase action prioritised within limited screen space

**Utility & Secondary Actions** (FR-239):
- PDP-UTILITY-001: Save, wishlist, compare features available without competing with primary CTA
- PDP-UTILITY-002: Gifting options present on product page when relevant
- PDP-UTILITY-003: Page avoids unnecessary distractions pulling users from purchase decision

---

## Phase 21c: CRO Vision Analyzer

### Vision Analyzer Class

**Functional Requirements**:
- **FR-240**: System MUST provide CROVisionAnalyzer class for screenshot analysis
- **FR-241**: CROVisionAnalyzer MUST accept screenshot (base64), pageType, and viewport info
- **FR-242**: CROVisionAnalyzer MUST load heuristics from knowledge base by pageType
- **FR-243**: CROVisionAnalyzer MUST build prompts that include heuristics as context
- **FR-244**: CROVisionAnalyzer MUST call GPT-4o Vision API with screenshot and prompt
- **FR-245**: CROVisionAnalyzer MUST parse response into structured HeuristicEvaluation[]
- **FR-246**: CROVisionAnalyzer MUST transform evaluations into CROInsight[] for compatibility

### Vision Analysis Types

**FR-247**: System MUST provide these types:
```typescript
interface CROVisionAnalyzerConfig {
  model: 'gpt-4o' | 'gpt-4o-mini';
  maxTokens: number;
  temperature: number;
}

interface HeuristicEvaluation {
  heuristicId: string;           // "PDP-PRICE-001"
  principle: string;             // Original principle text
  status: 'pass' | 'fail' | 'partial' | 'not_applicable';
  severity: 'critical' | 'high' | 'medium' | 'low';
  observation: string;           // What the LLM observed
  issue?: string;                // If failed, what's wrong
  recommendation?: string;       // How to fix
  confidence: number;            // 0-1
}

interface CROVisionAnalysisResult {
  pageType: PageType;
  analyzedAt: number;
  screenshotUsed: boolean;
  evaluations: HeuristicEvaluation[];
  insights: CROInsight[];        // Transformed for compatibility
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

### Prompt Construction

**FR-248**: Vision prompt MUST include:
- Viewport dimensions and mobile/desktop context
- All heuristics for the page type with principles and checkpoints
- Instructions to evaluate each heuristic against the screenshot
- Required output format (structured JSON)

**FR-249**: Prompt MUST request:
- Status for each heuristic (pass/fail/partial/not_applicable)
- Observation describing what was seen
- Issue description for failures
- Actionable recommendation for improvements
- Confidence score

---

## Phase 21d: Integration

### PageState Extension

**FR-250**: PageState interface MUST be extended:
```typescript
interface PageState {
  // Existing fields...
  visionAnalysis?: CROVisionAnalysisResult;
}
```

### Agent Integration

**FR-251**: CRO Agent MUST:
1. Detect page type using PageTypeDetector
2. If supported page type (pdp initially), run CROVisionAnalyzer
3. Store result in PageState.visionAnalysis
4. Include vision insights in final CRO report

**FR-252**: Vision analysis MUST be opt-in via configuration:
```typescript
interface CROAgentConfig {
  useVisionAnalysis: boolean;    // Default: true for supported page types
  visionModel: 'gpt-4o' | 'gpt-4o-mini';
}
```

### CLI Integration

**FR-253**: CLI MUST support vision analysis flags:
- `--vision` / `--no-vision`: Enable/disable vision analysis
- `--vision-model <model>`: Select vision model (gpt-4o, gpt-4o-mini)

---

## Configuration Requirements

- **CR-040**: Vision model MUST default to 'gpt-4o' for accuracy
- **CR-041**: Vision analysis MUST be enabled by default for supported page types
- **CR-042**: Heuristics knowledge base MUST be loaded lazily on first use
- **CR-043**: Vision prompt MUST target < 2000 tokens for heuristics context
- **CR-044**: Vision response MUST use structured output (JSON mode)

---

## Success Criteria

### Knowledge Base
- **SC-149**: All 10 PDP heuristic category files created and valid JSON
- **SC-150**: loadHeuristics('pdp') returns complete PageTypeHeuristics
- **SC-151**: Each heuristic has id, principle, checkpoints, severity

### Vision Analyzer
- **SC-152**: CROVisionAnalyzer loads correct heuristics for page type
- **SC-153**: CROVisionAnalyzer builds valid prompt with heuristics context
- **SC-154**: CROVisionAnalyzer parses GPT-4o response correctly
- **SC-155**: CROVisionAnalyzer returns valid HeuristicEvaluation[]
- **SC-156**: CROVisionAnalyzer transforms to CROInsight[] correctly

### Integration
- **SC-157**: PageState includes visionAnalysis when vision enabled
- **SC-158**: CRO report includes vision-based insights
- **SC-159**: CLI --vision flag controls vision analysis

### End-to-End
- **SC-160**: Analyze real PDP page with vision, get meaningful insights
- **SC-161**: Vision detects critical issues (missing price, no CTA)
- **SC-162**: Vision insights reference specific Baymard heuristics

---

## Sub-Phase Breakdown

| Sub-Phase | Scope | Tasks | Tests |
|-----------|-------|-------|-------|
| 21a | PageType Detection Foundation | 8 | 20+ | COMPLETE |
| 21b | Heuristics Knowledge Base | 12 | 15+ |
| 21c | CRO Vision Analyzer | 8 | 20+ |
| 21d | Integration & CLI | 6 | 15+ |
| **Total** | | **34** | **70+** |

---

## Future Extensions

This architecture supports adding new page types:

| Page Type | Knowledge Files | Target Phase |
|-----------|-----------------|--------------|
| PLP | plp/*.json | Phase 22 |
| Homepage | homepage/*.json | Phase 23 |
| Cart | cart/*.json | Phase 24 |
| Checkout | checkout/*.json | Phase 25 |

Adding a new page type requires:
1. Create knowledge JSON files with heuristics
2. Register page type in knowledge loader
3. Vision analyzer automatically works with new heuristics
