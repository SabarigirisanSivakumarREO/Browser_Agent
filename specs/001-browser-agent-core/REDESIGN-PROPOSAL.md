# CRO Agent Redesign: Goal-Oriented Analysis

**Status**: PROPOSAL
**Created**: 2026-01-21
**Problem**: Current system is a pattern-matcher, not a CRO analyst

---

## Executive Summary

Replace the current "find all elements → dump to LLM" approach with a **Goal-Oriented Analysis** system that:

1. **Understands** what the page is trying to achieve
2. **Identifies** the primary conversion action
3. **Maps** the conversion funnel
4. **Evaluates** each funnel step for friction
5. **Generates** insights tied to business impact

---

## Current vs Proposed

| Aspect | Current | Proposed |
|--------|---------|----------|
| Detection | Pattern match all elements | Semantic understanding of purpose |
| Priority | All elements equal | Primary → Supporting → Secondary |
| Analysis | Generic observations | Funnel-step evaluation |
| Insights | "Button could be better" | "Primary CTA has 3 blockers reducing conversion by ~15%" |
| DOM+Vision | Parallel, disconnected | Deeply correlated |

---

## New Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     GOAL-ORIENTED CRO ANALYSIS                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PHASE 1: PAGE UNDERSTANDING                                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  PageAnalyzer                                                    │   │
│  │  ├─ detectPageType() → PDP | PLP | Homepage | LeadGen | SaaS    │   │
│  │  ├─ identifyBusinessGoal() → "Purchase" | "SignUp" | "Lead"     │   │
│  │  ├─ findPrimaryAction() → THE one element that matters          │   │
│  │  └─ mapConversionFunnel() → Steps user must take                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│  PHASE 2: ELEMENT HIERARCHY                                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ElementClassifier                                               │   │
│  │  ├─ PRIMARY: The conversion action (Add to Cart, Sign Up)       │   │
│  │  ├─ SUPPORTING: Required for conversion (Size selector, Price)  │   │
│  │  ├─ SECONDARY: Helpful but not required (Reviews, Related)      │   │
│  │  └─ PERIPHERAL: Navigation, footer, etc.                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│  PHASE 3: FUNNEL ANALYSIS                                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  FunnelAnalyzer                                                  │   │
│  │  For each funnel step:                                          │   │
│  │  ├─ Is element visible/findable?                                │   │
│  │  ├─ Is element prominent enough?                                │   │
│  │  ├─ What friction exists?                                       │   │
│  │  ├─ What's the conversion probability impact?                   │   │
│  │  └─ What competes for attention?                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│  PHASE 4: INTEGRATED ANALYSIS                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  DOMVisionCorrelator                                             │   │
│  │  ├─ DOM: Element properties, attributes, position               │   │
│  │  ├─ Vision: Visual prominence, contrast, whitespace             │   │
│  │  └─ Combined: "Primary CTA is structurally correct but          │   │
│  │              visually overwhelmed by competing elements"         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│  PHASE 5: INSIGHT GENERATION                                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  InsightEngine                                                   │   │
│  │  ├─ Funnel position determines severity                         │   │
│  │  ├─ Impact estimated from element importance                    │   │
│  │  ├─ Recommendations tied to specific friction                   │   │
│  │  └─ A/B hypotheses with expected lift                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. PageAnalyzer

**Purpose**: Understand what the page IS and what it's trying to ACHIEVE.

```typescript
interface PageAnalysis {
  pageType: PageType;
  businessGoal: BusinessGoal;
  primaryAction: PrimaryAction;
  conversionFunnel: FunnelStep[];
  confidence: number;
}

interface PrimaryAction {
  element: DOMNode;
  actionType: 'purchase' | 'signup' | 'lead_capture' | 'engagement';
  importance: 'critical';  // Always critical - it's THE action
  visualBoundingBox: BoundingBox;
}

interface FunnelStep {
  order: number;
  name: string;  // "Select Size", "Enter Email", "Click Add to Cart"
  element: DOMNode | null;
  required: boolean;
  status: 'found' | 'missing' | 'unclear';
}
```

**Detection Strategy**:

```typescript
// PDP Detection (high confidence)
const pdpSignals = {
  hasProductTitle: checkForProductTitle(dom),      // h1 with product name pattern
  hasPrice: checkForPrice(dom),                    // $XX.XX pattern
  hasAddToCart: checkForAddToCart(dom),            // Button with cart intent
  hasProductImages: checkForProductGallery(dom),   // Image carousel/gallery
  hasVariantSelectors: checkForVariants(dom),      // Size, color selectors
  urlPattern: /\/(product|item|p)\//.test(url),    // URL structure
};

// Confidence = weighted sum of signals
// If confidence > 0.7, classify as PDP
```

---

### 2. ElementClassifier

**Purpose**: Create hierarchy based on conversion importance, not just pattern matching.

```typescript
enum ElementPriority {
  PRIMARY = 1,      // THE conversion action
  SUPPORTING = 2,   // Required for primary (size selector, price)
  SECONDARY = 3,    // Helpful (reviews, related products)
  PERIPHERAL = 4,   // Navigation, footer, unrelated
}

interface ClassifiedElement {
  node: DOMNode;
  priority: ElementPriority;
  role: ElementRole;  // What this element DOES in the funnel
  visualMetrics: VisualMetrics;
}
```

**Classification Logic**:

```typescript
function classifyElement(
  element: DOMNode,
  pageType: PageType,
  primaryAction: PrimaryAction
): ClassifiedElement {

  // Is this THE primary action?
  if (isPrimaryAction(element, primaryAction)) {
    return { priority: PRIMARY, role: 'conversion_trigger' };
  }

  // Is this required for primary action to work?
  if (isRequiredForConversion(element, pageType)) {
    // Size selector, color picker, quantity input
    return { priority: SUPPORTING, role: 'conversion_enabler' };
  }

  // Is this a decision factor?
  if (isDecisionFactor(element, pageType)) {
    // Price, reviews, trust signals near primary
    return { priority: SUPPORTING, role: 'decision_support' };
  }

  // Is this helpful but not required?
  if (isSecondaryContent(element)) {
    // Related products, full reviews section
    return { priority: SECONDARY, role: 'secondary_content' };
  }

  // Everything else
  return { priority: PERIPHERAL, role: 'peripheral' };
}
```

---

### 3. FunnelAnalyzer

**Purpose**: Evaluate each step of the conversion funnel.

```typescript
interface FunnelAnalysis {
  steps: FunnelStepAnalysis[];
  overallScore: number;  // 0-100
  criticalBlockers: FrictionPoint[];
  estimatedConversionImpact: number;  // % impact
}

interface FunnelStepAnalysis {
  step: FunnelStep;
  visibility: VisibilityAnalysis;
  prominence: ProminenceAnalysis;
  friction: FrictionPoint[];
  competitors: CompetingElement[];  // Elements stealing attention
  score: number;  // 0-100 for this step
}

interface FrictionPoint {
  type: FrictionType;
  severity: 'blocker' | 'high' | 'medium' | 'low';
  description: string;
  element?: DOMNode;
  estimatedImpact: number;  // % conversion loss
  recommendation: string;
}

enum FrictionType {
  NOT_VISIBLE = 'not_visible',           // Below fold, hidden
  LOW_PROMINENCE = 'low_prominence',     // Small, low contrast
  COMPETING_ELEMENTS = 'competing',       // Other CTAs nearby
  UNCLEAR_NEXT_STEP = 'unclear',         // User doesn't know what to do
  TOO_MANY_OPTIONS = 'choice_overload',  // Decision paralysis
  MISSING_INFO = 'missing_info',         // Can't make decision
  TRUST_BARRIER = 'trust_barrier',       // Security concerns
  FORM_FRICTION = 'form_friction',       // Too many fields
}
```

**Funnel Templates by Page Type**:

```typescript
const FUNNEL_TEMPLATES: Record<PageType, FunnelTemplate> = {
  pdp: {
    goal: 'Add product to cart',
    steps: [
      { name: 'View Product', required: true, elements: ['product_title', 'product_image'] },
      { name: 'Check Price', required: true, elements: ['price_display'] },
      { name: 'Select Variant', required: 'if_variants', elements: ['size_selector', 'color_selector'] },
      { name: 'Review Decision Factors', required: false, elements: ['reviews', 'trust_signals'] },
      { name: 'Add to Cart', required: true, elements: ['add_to_cart_button'] },
      { name: 'Confirm Action', required: false, elements: ['cart_confirmation', 'mini_cart'] },
    ],
  },

  lead_gen: {
    goal: 'Submit lead form',
    steps: [
      { name: 'Understand Offer', required: true, elements: ['headline', 'value_prop'] },
      { name: 'Build Trust', required: false, elements: ['trust_signals', 'testimonials'] },
      { name: 'Fill Form', required: true, elements: ['lead_form', 'form_fields'] },
      { name: 'Submit', required: true, elements: ['submit_button'] },
    ],
  },

  saas_landing: {
    goal: 'Start trial or sign up',
    steps: [
      { name: 'Understand Product', required: true, elements: ['headline', 'hero'] },
      { name: 'See Value', required: true, elements: ['features', 'benefits'] },
      { name: 'Build Trust', required: false, elements: ['social_proof', 'logos'] },
      { name: 'Choose Plan', required: 'if_pricing', elements: ['pricing_table'] },
      { name: 'Sign Up', required: true, elements: ['signup_cta', 'trial_button'] },
    ],
  },
};
```

---

### 4. DOMVisionCorrelator

**Purpose**: Deeply integrate DOM analysis with visual analysis.

```typescript
interface CorrelatedAnalysis {
  element: DOMNode;
  domFindings: DOMFindings;
  visualFindings: VisualFindings;
  correlatedInsights: CorrelatedInsight[];
}

interface DOMFindings {
  hasCorrectSemantics: boolean;    // Correct tag, role, aria
  hasAccessibleText: boolean;      // Good button text, labels
  hasProperStructure: boolean;     // In logical DOM position
  technicalIssues: string[];
}

interface VisualFindings {
  isAboveFold: boolean;
  visualProminence: number;        // 0-100 based on size, color, whitespace
  contrastRatio: number;
  surroundingWhitespace: number;
  competingElements: number;       // Count of nearby attention-grabbers
  visualHierarchyRank: number;     // Where it ranks visually on page
}

interface CorrelatedInsight {
  type: 'dom_only' | 'visual_only' | 'correlated';
  finding: string;
  domEvidence?: string;
  visualEvidence?: string;
  impact: number;
}
```

**Correlation Logic**:

```typescript
function correlateFindings(
  element: DOMNode,
  domAnalysis: DOMFindings,
  visualAnalysis: VisualFindings,
  priority: ElementPriority
): CorrelatedInsight[] {
  const insights: CorrelatedInsight[] = [];

  // DOM says it's a button, but visually it doesn't look clickable
  if (domAnalysis.hasCorrectSemantics && visualAnalysis.visualProminence < 30) {
    insights.push({
      type: 'correlated',
      finding: 'Element is semantically correct but visually underwhelming',
      domEvidence: `Proper ${element.tagName} with role="${element.attributes?.role}"`,
      visualEvidence: `Visual prominence score: ${visualAnalysis.visualProminence}/100`,
      impact: priority === PRIMARY ? 25 : 10,
    });
  }

  // Primary action but not the most visually prominent
  if (priority === PRIMARY && visualAnalysis.visualHierarchyRank > 1) {
    insights.push({
      type: 'visual_only',
      finding: `Primary CTA is not the most prominent element (rank: ${visualAnalysis.visualHierarchyRank})`,
      visualEvidence: `${visualAnalysis.competingElements} elements compete for attention`,
      impact: 20,
    });
  }

  // Below fold for primary action
  if (priority === PRIMARY && !visualAnalysis.isAboveFold) {
    insights.push({
      type: 'visual_only',
      finding: 'Primary conversion action is below the fold',
      visualEvidence: 'Requires scroll to reach',
      impact: 30,
    });
  }

  return insights;
}
```

---

### 5. InsightEngine

**Purpose**: Generate actionable, prioritized insights tied to business impact.

```typescript
interface FunnelInsight {
  id: string;
  funnelStep: string;
  elementPriority: ElementPriority;

  // The issue
  issue: string;
  evidence: {
    dom?: string;
    visual?: string;
    behavioral?: string;
  };

  // The impact
  severity: Severity;
  estimatedImpact: {
    conversionLoss: number;     // % estimated conversion loss
    confidence: number;          // How confident in estimate
    basis: string;               // "Industry benchmark" | "Heuristic" | "Comparative"
  };

  // The fix
  recommendation: string;
  expectedLift: {
    min: number;
    max: number;
    basis: string;
  };

  // Priority for fixing
  priority: number;  // Calculated from severity * impact * ease_of_fix
}
```

**Severity Calculation**:

```typescript
function calculateSeverity(
  elementPriority: ElementPriority,
  frictionType: FrictionType,
  funnelStepRequired: boolean
): Severity {
  // Primary action issues are always critical or high
  if (elementPriority === PRIMARY) {
    if (frictionType === 'NOT_VISIBLE' || frictionType === 'blocker') {
      return 'critical';
    }
    return 'high';
  }

  // Supporting element issues for required steps
  if (elementPriority === SUPPORTING && funnelStepRequired) {
    return 'high';
  }

  // Supporting element issues for optional steps
  if (elementPriority === SUPPORTING) {
    return 'medium';
  }

  // Secondary and peripheral
  return 'low';
}
```

**Impact Estimation**:

```typescript
const IMPACT_BENCHMARKS: Record<FrictionType, ImpactRange> = {
  NOT_VISIBLE: { min: 15, max: 40, basis: 'Primary CTA visibility studies' },
  LOW_PROMINENCE: { min: 5, max: 20, basis: 'Button prominence A/B tests' },
  COMPETING_ELEMENTS: { min: 10, max: 25, basis: 'Attention studies' },
  UNCLEAR_NEXT_STEP: { min: 20, max: 50, basis: 'UX research' },
  TOO_MANY_OPTIONS: { min: 10, max: 30, basis: 'Choice overload research' },
  MISSING_INFO: { min: 15, max: 35, basis: 'Decision factor studies' },
  TRUST_BARRIER: { min: 10, max: 25, basis: 'Trust signal research' },
  FORM_FRICTION: { min: 5, max: 15, basis: 'Form optimization studies' },
};
```

---

## New DOM Extraction Strategy

### Problem with Current Approach
- Extracts ALL elements matching patterns
- No prioritization
- Token budget wastes space on peripheral elements

### New Approach: Priority-Based Extraction

```typescript
interface SmartDOMExtraction {
  // Phase 1: Find primary action (always included, full detail)
  primaryAction: ExtractedElement;

  // Phase 2: Find supporting elements (always included)
  supportingElements: ExtractedElement[];

  // Phase 3: Find secondary elements (included if token budget allows)
  secondaryElements: ExtractedElement[];

  // Phase 4: Peripheral summary (count only, no detail)
  peripheralSummary: {
    navigationLinks: number;
    footerElements: number;
    otherButtons: number;
  };

  // Metadata
  tokenUsage: {
    primary: number;
    supporting: number;
    secondary: number;
    total: number;
    budget: number;
  };
}
```

**Token Allocation**:

```typescript
const TOKEN_ALLOCATION = {
  primary: 0.3,      // 30% of budget for THE action
  supporting: 0.4,   // 40% for supporting elements
  secondary: 0.2,    // 20% for secondary
  metadata: 0.1,     // 10% for page context
};

// For 8K budget:
// Primary: 2400 tokens (full detail, context, surrounding elements)
// Supporting: 3200 tokens (all required funnel elements)
// Secondary: 1600 tokens (top N by relevance)
// Metadata: 800 tokens (page type, funnel, summary)
```

---

## New Class Matching (Fixed)

Replace substring matching with semantic matching:

```typescript
interface SemanticMatcher {
  // Instead of: classes.includes('btn')
  // Use: matchesSemanticPattern(element, 'button')

  matchesSemanticPattern(element: Element, intent: string): MatchResult;
}

interface MatchResult {
  matches: boolean;
  confidence: number;
  matchType: 'exact' | 'semantic' | 'contextual';
  evidence: string[];
}

function matchesSemanticPattern(element: Element, intent: string): MatchResult {
  const signals: Signal[] = [];

  // 1. Exact class match (highest confidence)
  if (element.classList.contains(intent)) {
    signals.push({ type: 'exact_class', confidence: 0.9 });
  }

  // 2. Word-boundary class match
  const classList = Array.from(element.classList);
  for (const cls of classList) {
    if (matchesWithWordBoundary(cls, intent)) {
      signals.push({ type: 'boundary_class', confidence: 0.8, evidence: cls });
    }
  }

  // 3. Semantic HTML (tag + role)
  if (hasSemanticMatch(element, intent)) {
    signals.push({ type: 'semantic_html', confidence: 0.85 });
  }

  // 4. ARIA attributes
  if (hasAriaMatch(element, intent)) {
    signals.push({ type: 'aria', confidence: 0.9 });
  }

  // 5. Behavioral signals (onclick, href pattern)
  if (hasBehavioralMatch(element, intent)) {
    signals.push({ type: 'behavioral', confidence: 0.7 });
  }

  // Combine signals
  return combineSignals(signals);
}

function matchesWithWordBoundary(className: string, pattern: string): boolean {
  // "btn-primary" matches "btn" ✓
  // "btnWrapper" does NOT match "btn" ✗
  // "submit-btn" matches "btn" ✓
  const regex = new RegExp(`(^|[-_])${escapeRegex(pattern)}([-_]|$)`);
  return regex.test(className);
}
```

---

## New Agent Loop

```typescript
async function analyzePageGoalOriented(url: string): Promise<GoalOrientedAnalysis> {
  // PHASE 1: Understand the page
  const page = await loadPage(url);
  const pageAnalysis = await analyzePagePurpose(page);

  console.log(`Page Type: ${pageAnalysis.pageType}`);
  console.log(`Business Goal: ${pageAnalysis.businessGoal}`);
  console.log(`Primary Action: ${pageAnalysis.primaryAction.element.text}`);
  console.log(`Funnel Steps: ${pageAnalysis.conversionFunnel.length}`);

  // PHASE 2: Classify elements by importance
  const dom = await extractDOM(page);
  const classifiedElements = classifyElements(dom, pageAnalysis);

  console.log(`Primary: 1 element`);
  console.log(`Supporting: ${classifiedElements.supporting.length} elements`);
  console.log(`Secondary: ${classifiedElements.secondary.length} elements`);

  // PHASE 3: Analyze the funnel
  const funnelAnalysis = await analyzeFunnel(
    page,
    pageAnalysis.conversionFunnel,
    classifiedElements
  );

  // PHASE 4: Correlate DOM + Vision for key elements
  const correlatedAnalysis = await correlateDOMVision(
    page,
    classifiedElements.primary,
    classifiedElements.supporting
  );

  // PHASE 5: Generate insights
  const insights = generateFunnelInsights(
    funnelAnalysis,
    correlatedAnalysis,
    pageAnalysis
  );

  return {
    pageAnalysis,
    funnelAnalysis,
    insights,
    hypotheses: generateHypotheses(insights),
    scores: calculateScores(funnelAnalysis),
  };
}
```

---

## File Structure

```
src/
├── analyzer/                        # NEW: Goal-oriented analysis
│   ├── page-analyzer.ts            # Page understanding
│   ├── element-classifier.ts       # Priority classification
│   ├── funnel-analyzer.ts          # Funnel step analysis
│   ├── dom-vision-correlator.ts    # Integrated analysis
│   ├── insight-engine.ts           # Insight generation
│   └── index.ts
│
├── funnel/                          # NEW: Funnel definitions
│   ├── templates/
│   │   ├── pdp.ts                  # PDP funnel template
│   │   ├── lead-gen.ts             # Lead gen template
│   │   ├── saas-landing.ts         # SaaS template
│   │   └── index.ts
│   ├── funnel-matcher.ts           # Match page to template
│   └── index.ts
│
├── detection/                       # NEW: Smart detection
│   ├── primary-action-detector.ts  # Find THE action
│   ├── semantic-matcher.ts         # Fixed class matching
│   ├── page-signals.ts             # Page type signals
│   └── index.ts
│
├── browser/dom/                     # MODIFIED
│   ├── smart-extractor.ts          # NEW: Priority-based extraction
│   ├── build-dom-tree.ts           # MODIFIED: Add semantic matching
│   └── ...
│
└── ...existing files...
```

---

## Migration Path

### Phase A: Foundation (Non-Breaking)
1. Add `SemanticMatcher` alongside existing matchers
2. Add `PageAnalyzer` as optional enhancement
3. Add `ElementClassifier` without changing existing flow
4. Tests: 50+ new tests

### Phase B: Integration
1. Add `FunnelAnalyzer`
2. Add `DOMVisionCorrelator`
3. New `--goal-oriented` CLI flag
4. Tests: 40+ new tests

### Phase C: New Agent Loop
1. Add `GoalOrientedAgent` as alternative to `CROAgent`
2. Add `InsightEngine` with funnel-aware scoring
3. New output format
4. Tests: 30+ new tests

### Phase D: Deprecation
1. Make goal-oriented the default
2. Keep `--legacy` flag for old behavior
3. Update documentation

---

## Expected Outcomes

### Before (Current)
```
Insights found: 23
- "Button text could be more action-oriented" (medium)
- "Form has many fields" (medium)
- "Multiple CTAs compete for attention" (low)
- "Trust signals present below fold" (low)
...19 more generic observations
```

### After (Proposed)
```
Page Analysis:
  Type: Product Detail Page (92% confidence)
  Goal: Add to Cart
  Primary Action: "Add to Cart" button (found, below fold)

Funnel Analysis:
  Step 1: View Product ✓ (score: 85/100)
  Step 2: Check Price ✓ (score: 90/100)
  Step 3: Select Size ⚠ (score: 60/100) - 3 issues found
  Step 4: Add to Cart ✗ (score: 35/100) - CRITICAL: 2 blockers

Critical Issues (2):
  1. PRIMARY ACTION BELOW FOLD
     Element: "Add to Cart" button
     Evidence:
       - DOM: Button at y=1200px, viewport height=720px
       - Visual: Requires 1.7 viewport scrolls to reach
     Impact: 25-40% conversion loss (visibility studies)
     Fix: Move Add to Cart into sticky header or above fold
     Expected Lift: 15-25%

  2. SIZE SELECTOR NOT PROMINENT
     Element: Size dropdown
     Evidence:
       - DOM: Small select element (120x30px)
       - Visual: Same color as background, no label visible
     Impact: 15-25% abandonment at this step
     Fix: Use visual size buttons, add clear "Select Size" label
     Expected Lift: 10-15%

High Priority Issues (3):
  ...

Overall Conversion Score: 52/100
Estimated Current Conversion Rate Impact: -35% vs optimal
```

---

## Summary

This redesign transforms the system from:
- **Pattern matcher** → **Goal-oriented analyzer**
- **Element finder** → **Funnel evaluator**
- **Generic observations** → **Impact-quantified insights**
- **Disconnected DOM+Vision** → **Correlated analysis**

The key insight: **CRO analysis is about understanding user goals and evaluating the path to conversion, not finding all elements that look like buttons.**
