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

## Phase 21b: Heuristics Knowledge Base - COMPLETE

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

## Phase 21c: CRO Vision Analyzer - COMPLETE

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

## Phase 21d: Integration - COMPLETE

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

- **CR-040**: Vision model MUST default to 'gpt-4o-mini' for cost optimization
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

## Phase 21e: Multi-Viewport Full-Page Vision Analysis - REMOVED (CR-001)

### Overview

Phase 21e extends vision analysis to cover the **entire page** using multiple viewport screenshots analyzed with gpt-4o-mini for cost efficiency.

**Problem**: Current vision analysis only captures above-the-fold content, missing CRO issues below the fold.

**Solution**: Capture screenshots at each scroll position (leveraging Phase 19 infrastructure), analyze each with gpt-4o-mini, merge/dedupe results.

**Cost Target**: ~$0.01-0.02/page (vs $0.10-0.20 with gpt-4o multi-viewport)

### Functional Requirements

**FR-260**: System MUST support `fullPageVision` mode that captures multiple viewport screenshots
**FR-261**: System MUST capture screenshot at each scroll position during full-page scan
**FR-262**: System MUST run vision analysis on each viewport screenshot independently
**FR-263**: System MUST merge vision results from multiple viewports into single result
**FR-264**: System MUST deduplicate findings that appear in overlapping viewport regions
**FR-265**: System MUST default to `gpt-4o-mini` model for full-page vision to optimize cost
**FR-266**: System MUST support parallel analysis of viewport screenshots for performance
**FR-267**: System MUST track which viewport each finding originated from

### Multi-Viewport Types

**FR-268**: System MUST provide these types:
```typescript
interface ViewportScreenshot {
  base64: string;
  scrollPosition: number;      // Y offset
  viewportIndex: number;       // 0, 1, 2, ...
  coverage: { start: number; end: number };  // Pixel range covered
}

interface MultiViewportVisionConfig {
  model: 'gpt-4o' | 'gpt-4o-mini';  // Default: gpt-4o-mini
  parallelAnalysis: boolean;        // Default: true
  dedupeThreshold: number;          // Similarity threshold (0-1), default: 0.8
  maxViewports: number;             // Max screenshots, default: 10
}

interface MultiViewportAnalysisResult extends CROVisionAnalysisResult {
  viewportCount: number;
  viewportResults: ViewportVisionResult[];
  mergedEvaluations: HeuristicEvaluation[];
  deduplicatedCount: number;
}

interface ViewportVisionResult {
  viewportIndex: number;
  scrollPosition: number;
  evaluations: HeuristicEvaluation[];
  analysisTimeMs: number;
}
```

### Deduplication Logic

**FR-269**: Deduplication MUST use these rules:
- Same heuristicId across viewports = dedupe (keep highest confidence)
- Similar observation text (>80% similarity) = dedupe
- Different scroll regions with same issue = keep both (different locations)

### CLI Integration

**FR-270**: CLI MUST support multi-viewport vision flags:
- `--full-page-vision`: Enable multi-viewport full-page vision analysis
- `--vision-max-viewports <N>`: Maximum viewports to analyze (default: 10)
- `--no-parallel-vision`: Disable parallel analysis (sequential)

### Configuration Requirements

- **CR-050**: Full-page vision MUST default to `gpt-4o-mini` model
- **CR-051**: Parallel analysis MUST be enabled by default
- **CR-052**: Maximum viewports MUST default to 10
- **CR-053**: Dedupe threshold MUST default to 0.8

### Success Criteria

- **SC-170**: Multi-viewport capture works with Phase 19 scroll infrastructure
- **SC-171**: Each viewport analyzed independently
- **SC-172**: Results merged without duplicate findings
- **SC-173**: Cost per page stays within ~$0.01-0.02 target
- **SC-174**: CLI --full-page-vision flag works correctly
- **SC-175**: Parallel analysis completes faster than sequential

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

---

## Phase 21g: Vision Agent Loop with DOM + Vision Context - MERGED (CR-001)

### Overview

Phase 21g implements an **iterative Vision Agent** that uses an observe-reason-act loop with parallel DOM + Vision context. Unlike single-pass analysis (21c-21f), this agent scrolls through the page, captures DOM and screenshots at each position, and systematically evaluates all heuristics with deep analysis.

**Key Innovation**: Send BOTH serialized DOM AND screenshot to LLM, enabling cross-referencing:
- "Element [0] in DOM has text 'Buy Now' but appears too small in screenshot"
- "Trust badge [5] exists in DOM but is obscured by modal in screenshot"

### Functional Requirements

**Vision Agent Core**:
- **FR-280**: System MUST provide VisionAgent class implementing observe-reason-act loop
- **FR-281**: VisionAgent MUST extract DOM AND capture screenshot at each scroll position
- **FR-282**: VisionAgent MUST serialize DOM using existing DOMSerializer (no changes to extractor)
- **FR-283**: VisionAgent MUST send both DOM context and screenshot image to LLM
- **FR-284**: VisionAgent MUST track which heuristics have been evaluated
- **FR-285**: VisionAgent MUST terminate when all heuristics evaluated OR max steps reached

**Vision Agent State**:
- **FR-286**: VisionAgentState MUST include ViewportSnapshot[] with both DOM and screenshot
- **FR-287**: VisionAgentState MUST track evaluatedHeuristicIds and pendingHeuristicIds
- **FR-288**: VisionAgentState MUST track scroll position, page height, viewport dimensions
- **FR-289**: VisionStateManager MUST provide getCoveragePercent() for heuristic coverage

**Vision Agent Tools**:
- **FR-290**: capture_viewport tool MUST capture screenshot AND extract DOM in single call
- **FR-291**: scroll_page tool MUST scroll page and return new scroll position
- **FR-292**: evaluate_batch tool MUST accept 5-8 heuristic evaluations with status/observation/issue/recommendation
- **FR-293**: done tool MUST require coverageConfirmation before allowing termination
- **FR-294**: done tool MUST block if pending heuristics remain without explanation

**Vision Agent Prompts**:
- **FR-295**: System prompt MUST instruct LLM to cross-reference DOM elements with visual appearance
- **FR-296**: User prompt MUST include <dom_context> section with serialized CRO elements
- **FR-297**: User prompt MUST include <pending_heuristics> section with remaining heuristics
- **FR-298**: User prompt MUST include screenshot image using GPT-4o Vision API format

**CLI Integration**:
- **FR-299**: CLI MUST support `--vision-agent` flag for iterative vision analysis
- **FR-300**: VisionAgent MUST default to gpt-4o-mini model for cost optimization
- **FR-301**: VisionAgent MUST be compatible with existing --headless, --verbose flags

### Configuration Requirements

- **CR-060**: VisionAgent MUST default to maxSteps: 20
- **CR-061**: VisionAgent MUST default to batchSize: 5-8 heuristics per evaluation
- **CR-062**: VisionAgent MUST default to scrollIncrement: 500px
- **CR-063**: VisionAgent MUST default to domTokenBudget: 4000 tokens
- **CR-064**: VisionAgent MUST terminate after 3 consecutive failures

### Success Criteria

- **SC-180**: VisionAgent scrolls through entire page
- **SC-181**: VisionAgent evaluates all 35 PDP heuristics (100% coverage)
- **SC-182**: VisionAgent sends both DOM context and screenshot to LLM
- **SC-183**: VisionAgent cross-references DOM elements in evaluations
- **SC-184**: CLI --vision-agent flag works correctly
- **SC-185**: Cost per page stays within ~$0.005-0.010 target with gpt-4o-mini

---

## Phase 21h: Evidence Capture for Heuristic Evaluations - PLANNED

### Overview

Phase 21h enhances the Vision Agent to capture and store evidence for each heuristic evaluation, enabling audit trails and visual documentation of CRO issues found.

### Problem Statement

Currently, heuristic evaluations contain only text descriptions (observation, issue, recommendation) with no link to:
- Which viewport/screenshot the evaluation came from
- Specific DOM elements referenced
- Visual coordinates of the issue area
- When the evaluation was made

This makes it difficult to audit findings, create visual reports, or verify issues later.

### Solution

Add 5 evidence fields to HeuristicEvaluation:
1. `viewportIndex` - Which viewport snapshot the evaluation came from
2. `screenshotRef` - Path/reference to the screenshot file (when saved)
3. `domElementRefs` - Structured references to DOM elements mentioned
4. `boundingBox` - Coordinates extracted from DOM elements via Playwright
5. `timestamp` - When evaluation was made (epoch ms)

### Functional Requirements

**Evidence Types**:
- **FR-302**: System MUST define DOMElementRef interface with index, selector, xpath, elementType, textContent
- **FR-303**: System MUST define BoundingBox interface with x, y, width, height, viewportIndex
- **FR-304**: HeuristicEvaluation MUST include optional viewportIndex field
- **FR-305**: HeuristicEvaluation MUST include optional screenshotRef field
- **FR-306**: HeuristicEvaluation MUST include optional domElementRefs array field
- **FR-307**: HeuristicEvaluation MUST include optional boundingBox field
- **FR-308**: HeuristicEvaluation MUST include optional timestamp field

**Evidence Capture**:
- **FR-309**: BatchEvaluation MUST accept optional elementIndices array from LLM
- **FR-310**: evaluate-batch-tool MUST pass viewport context to state manager
- **FR-311**: vision-state-manager MUST attach viewportIndex to evaluations
- **FR-312**: vision-state-manager MUST attach timestamp to evaluations
- **FR-313**: vision-state-manager MUST build domElementRefs from element indices
- **FR-314**: capture-viewport-tool MUST extract bounding boxes for DOM elements via Playwright

**Screenshot Saving**:
- **FR-315**: System MUST provide ScreenshotWriter utility for saving base64 to PNG files
- **FR-316**: CLI MUST support `--save-evidence` flag to enable screenshot saving
- **FR-317**: CLI MUST support `--evidence-dir <path>` option (default: ./evidence)
- **FR-318**: When evidence is saved, screenshotRef MUST be set to saved file path

**Output Display**:
- **FR-319**: Output formatter MUST display viewportIndex for each evaluation
- **FR-320**: Output formatter MUST display screenshotRef when available
- **FR-321**: Output formatter MUST display domElementRefs in structured format

### Configuration Requirements

- **CR-065**: Evidence fields MUST be optional (backward compatible)
- **CR-066**: Screenshot saving MUST be disabled by default (opt-in via --save-evidence)
- **CR-067**: Default evidence directory MUST be ./evidence
- **CR-068**: Bounding boxes MUST be extracted from DOM using Playwright element.boundingBox()

### Success Criteria

- **SC-186**: All evaluations have viewportIndex linking to snapshot
- **SC-187**: All evaluations have timestamp of when evaluation occurred
- **SC-188**: Element references in observations are captured as structured domElementRefs
- **SC-189**: --save-evidence flag saves viewport screenshots to evidence directory
- **SC-190**: Bounding boxes are extracted from Playwright for referenced elements
- **SC-191**: Output shows evidence metadata (viewport, screenshot path, elements)

---

## Phase 21i: DOM-Screenshot Coordinate Mapping - PLANNED

### Overview

Phase 21i implements **explicit coordinate mapping** between DOM elements and their visual positions in screenshots. This enables verification of LLM observations, precise action targeting, and visual evidence generation.

### Problem Statement

Currently, DOM extraction and screenshot capture are parallel but disconnected:
- DOM elements have `boundingBox` in absolute page coordinates
- Screenshots are captured at specific scroll positions
- LLM must mentally correlate DOM text with visual elements (unreliable)
- No verification that LLM correctly identified elements
- No way to highlight specific elements in screenshots for reports

### Solution

Implement coordinate transformation and element mapping:
1. Transform absolute page coordinates to screenshot-relative coordinates
2. Track which elements are visible in each screenshot
3. Include coordinates in LLM prompts for precise element identification
4. Parse element references from LLM responses
5. Generate annotated screenshots with element bounding boxes

### Functional Requirements

**Coordinate Mapping**:
- **FR-322**: System MUST provide `toScreenshotCoords(pageCoords, scrollY, viewportHeight)` function
- **FR-323**: System MUST calculate screenshot-relative Y as `pageY - scrollY`
- **FR-324**: System MUST determine element visibility in screenshot based on Y bounds
- **FR-325**: System MUST provide `mapElementsToScreenshot(domTree, scrollY, viewport)` function
- **FR-326**: mapElementsToScreenshot MUST return ElementMapping[] with both page and screenshot coords

**ElementMapping Types**:
- **FR-327**: System MUST define ElementMapping interface:
```typescript
interface ElementMapping {
  index: number;              // Element index [5]
  xpath: string;              // /html/body/.../button
  text: string;               // Element text content
  pageCoords: BoundingBox;    // Absolute page coordinates
  screenshotCoords: {         // Relative to screenshot
    x: number;
    y: number;
    width: number;
    height: number;
  };
  visible: boolean;           // Is element within screenshot bounds?
}
```

**ViewportSnapshot Extension**:
- **FR-328**: ViewportSnapshot MUST include `elementMappings: ElementMapping[]`
- **FR-329**: ViewportSnapshot MUST include `visibleElements: ElementMapping[]` (filtered)

**Prompt Enhancement**:
- **FR-330**: Vision prompt MUST include element coordinates in DOM context
- **FR-331**: Prompt format MUST be: `[index] <tag> "text" → (x, y, width×height)`
- **FR-332**: Prompt MUST instruct LLM to reference elements by index when reporting issues

**Response Parsing**:
- **FR-333**: System MUST extract element references ([N]) from LLM observations
- **FR-334**: ParsedEvaluation MUST include `relatedElements: number[]` array
- **FR-335**: System MUST match element references to ElementMapping entries

**Screenshot Annotation** (Optional):
- **FR-336**: System MUST provide `annotateScreenshot(screenshot, mappings, evaluations)` function
- **FR-337**: Annotations MUST draw bounding boxes around referenced elements
- **FR-338**: Annotations MUST color-code: red for failed, green for passed
- **FR-339**: Annotations MUST include element index labels `[5]`

**Capture Integration**:
- **FR-340**: capture-viewport-tool MUST create element mappings after DOM extraction
- **FR-341**: capture-viewport-tool MUST filter to visible elements for current viewport
- **FR-342**: capture-viewport-tool MUST store mappings in ViewportSnapshot

### Configuration Requirements

- **CR-070**: Coordinate mapping MUST be enabled by default
- **CR-071**: Screenshot annotation MUST be opt-in via `--annotate-screenshots` flag
- **CR-072**: Element visibility threshold MUST allow partial visibility (>50% visible)

### Success Criteria

- **SC-192**: Element mappings correctly transform page coords to screenshot coords
- **SC-193**: Visible elements filtered based on scroll position
- **SC-194**: LLM prompt includes element coordinates
- **SC-195**: Element references parsed from LLM responses
- **SC-196**: Evaluations linked to specific ElementMapping entries
- **SC-197**: Annotated screenshots show correct bounding boxes
- **SC-198**: Issue elements highlighted in red, passed in green

---

## Phase 21l: Default Evidence & Mapping

**Purpose**: Make evidence saving and screenshot annotation part of the default vision workflow, not opt-in flags.

**Rationale**:
- DOM-screenshot mapping is a core feature, not optional
- Evidence capture provides verification and debugging capability by default
- Users shouldn't need to remember extra flags for core functionality
- Opt-out is available for users who need minimal output

### Functional Requirements

**Default Behavior Changes**:
- **FR-343**: System MUST save evidence (screenshots + mappings) by default when `--vision` flag is used
- **FR-344**: System MUST annotate screenshots with bounding boxes by default when `--vision` flag is used
- **FR-345**: System MUST create evidence directory automatically if not specified
- **FR-346**: Default evidence directory MUST be `./evidence/{timestamp}/`

**Opt-Out Flags**:
- **FR-347**: System MUST provide `--no-save-evidence` flag to disable evidence saving
- **FR-348**: System MUST provide `--no-annotate-screenshots` flag to disable annotation
- **FR-349**: Opt-out flags MUST override default-on behavior

**CLI Option Changes**:
- **FR-350**: `saveEvidence` option MUST default to `true` (was `false`)
- **FR-351**: `annotateScreenshots` option MUST default to `true` (was `false`)
- **FR-352**: Help text MUST reflect new default behavior

**Backward Compatibility**:
- **FR-353**: Existing `--save-evidence` flag MUST be accepted (no-op, already default)
- **FR-354**: Existing `--annotate-screenshots` flag MUST be accepted (no-op, already default)
- **FR-355**: Existing `--evidence-dir` flag MUST continue to work

### Configuration Requirements

- **CR-073**: `saveEvidence` MUST default to `true` in VisionAnalysisOptions
- **CR-074**: `annotateScreenshots` MUST default to `true` in VisionAnalysisOptions
- **CR-075**: Default evidence directory MUST include timestamp for uniqueness
- **CR-076**: Evidence saving MUST NOT block or slow down the main workflow significantly

### Success Criteria

- **SC-199**: Running `--vision` without flags saves evidence automatically
- **SC-200**: Running `--vision` without flags produces annotated screenshots
- **SC-201**: `--no-save-evidence` disables evidence saving
- **SC-202**: `--no-annotate-screenshots` disables annotation
- **SC-203**: Old scripts using `--save-evidence` flag continue to work
- **SC-204**: Evidence directory created with timestamp if not specified
- **SC-205**: Help text shows opt-out flags and explains defaults
