**Navigation**: [Index](./index.md) | [Previous](./phase-19.md) | Next

## Phase 20: Unified Extraction Pipeline

### Summary

Build a modular, reusable Page Extraction Pipeline with 10 extraction modules:
- **foundations/**: Shared types, budgets, selector strategies
- **dom/**: DOM snapshot, landmarks, nodes, fingerprinting
- **visible/**: Visibility detection, above-fold, occlusion
- **styles/**: CSS variables, design tokens, computed styles
- **network/**: Request/response capture, API JSON, timing
- **storage/**: Cookies, localStorage, sessionStorage
- **interactions/**: Safe actions (cookie dismiss, expand, scroll)
- **a11y/**: Accessibility snapshot, role mapping, focus order
- **frames/**: iframes + shadow DOM traversal
- **vision/**: Screenshots + LLM visual analysis

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    UNIFIED EXTRACTION PIPELINE v2.0                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  foundations/  (shared types, budgets, selectors)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────────┐   │
│  │ Types &      │  │ Extraction   │  │ Selector Bundle                  │   │
│  │ Schemas      │  │ Budgets      │  │ ├─ preferred: CSS (id/testid)   │   │
│  │ ├─ PageKnow  │  │ ├─ nodes:250 │  │ └─ fallback: [role,text,nth,xp] │   │
│  │ └─ All types │  │ └─ tokens:4k │  └──────────────────────────────────┘   │
│  └──────────────┘  └──────────────┘                                         │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  dom/  (DOM snapshot, landmarks, nodes, fingerprinting)                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────────┐    │
│  │ Meta       │  │ Landmarks  │  │ Key Nodes  │  │ Fingerprint        │    │
│  │ url,title  │  │ a11y+DOM   │  │ enriched   │  │ tag+role+text+pos  │    │
│  └────────────┘  └────────────┘  └────────────┘  └────────────────────┘    │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  visible/  (visibility detection, above-fold, occlusion)                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────────┐    │
│  │ Visibility │  │ Bounding   │  │ Above Fold │  │ Occlusion          │    │
│  │ 10-point   │  │ Boxes      │  │ Detection  │  │ Detection          │    │
│  └────────────┘  └────────────┘  └────────────┘  └────────────────────┘    │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  styles/  (CSS variables, design tokens, computed styles)                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────────┐    │
│  │ CSS Vars   │  │ Computed   │  │ Design     │  │ Theme Detection    │    │
│  │ :root vars │  │ Key Props  │  │ Tokens     │  │ dark/light mode    │    │
│  └────────────┘  └────────────┘  └────────────┘  └────────────────────┘    │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  network/  (request/response capture, API JSON, timing)                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────────┐    │
│  │ Requests   │  │ Responses  │  │ API JSON   │  │ Timing/Perf        │    │
│  │ url,method │  │ status,type│  │ body<50KB  │  │ TTFB, FCP, LCP     │    │
│  └────────────┘  └────────────┘  └────────────┘  └────────────────────┘    │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  storage/  (cookies, localStorage, sessionStorage)                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────────┐    │
│  │ Cookies    │  │ localStorage│ │ sessionStor│  │ IndexedDB Keys     │    │
│  │ name,value │  │ key:value  │  │ key:value  │  │ db names only      │    │
│  └────────────┘  └────────────┘  └────────────┘  └────────────────────┘    │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  interactions/  (safe actions: cookie dismiss, expand, scroll)               │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────────┐    │
│  │ Cookie     │  │ Accordion  │  │ Menu       │  │ Scroll Stepwise    │    │
│  │ Dismiss    │  │ Expand     │  │ Expand     │  │ + DOM delta        │    │
│  └────────────┘  └────────────┘  └────────────┘  └────────────────────┘    │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  a11y/  (accessibility snapshot, role mapping, focus order)                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────────┐    │
│  │ A11y Tree  │  │ Role Map   │  │ Live       │  │ Focus Order        │    │
│  │ Playwright │  │ to nodes   │  │ Regions    │  │ Tab sequence       │    │
│  └────────────┘  └────────────┘  └────────────┘  └────────────────────┘    │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  frames/  (iframes + shadow DOM traversal)                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────────┐    │
│  │ Same-Origin│  │ Cross-Orig │  │ Shadow     │  │ Web Components     │    │
│  │ Full extract│ │ Meta only  │  │ Recursive  │  │ Custom elements    │    │
│  └────────────┘  └────────────┘  └────────────┘  └────────────────────┘    │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  vision/  (screenshots + LLM visual analysis)                                │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────────┐    │
│  │ Viewport   │  │ Full Page  │  │ Segment    │  │ LLM Vision         │    │
│  │ Screenshot │  │ Screenshot │  │ Screenshots│  │ Analysis           │    │
│  └────────────┘  └────────────┘  └────────────┘  └────────────────────┘    │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Output: PageKnowledge JSON (Unified)                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ meta + dom + visible + styles + network + storage + interactions +  │    │
│  │ a11y + frames + vision + coverage + constraints + limitations       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Extraction Pipeline Order

```typescript
/**
 * Extraction module execution order.
 * Order matters - some modules depend on others.
 */
const EXTRACTION_ORDER = [
  'network',       // 1. Attach listeners BEFORE navigation
  'dom',           // 2. DOM snapshot + landmarks + nodes
  'visible',       // 3. Visibility detection + above-fold
  'interactions',  // 4. Cookie dismiss + expand + scroll
  'styles',        // 5. CSS vars + computed styles
  'storage',       // 6. Cookies + localStorage
  'a11y',          // 7. Accessibility snapshot
  'frames',        // 8. iframes + shadow DOM
  'vision',        // 9. Screenshots + LLM analysis
] as const;
```

### File Structure

```
src/extraction/                        # UNIFIED EXTRACTION MODULE
├── index.ts                           # Main exports
├── types.ts                           # All interfaces
├── budgets.ts                         # ExtractionBudgets
├── pipeline.ts                        # Main orchestrator
│
├── selectors/                         # Selector strategies
│   ├── index.ts
│   ├── bundle.ts                      # SelectorBundle creation
│   └── resolver.ts                    # SelectorResolver
│
├── dom/                               # DOM extraction
│   ├── index.ts                       # DOMExtractor class
│   ├── meta.ts                        # extractMeta()
│   ├── landmarks.ts                   # extractLandmarks()
│   ├── nodes.ts                       # extractKeyNodes()
│   ├── fingerprint.ts                 # generateFingerprint()
│   └── scripts/
│       └── extract-nodes.ts           # Injectable browser script
│
├── visible/                           # Visibility extraction
│   ├── index.ts                       # VisibilityExtractor class
│   ├── detection.ts                   # 10-point visibility check
│   ├── above-fold.ts                  # Above-fold detection
│   └── occlusion.ts                   # Occlusion detection
│
├── styles/                            # Styles extraction
│   ├── index.ts                       # StylesExtractor class
│   ├── css-variables.ts               # :root CSS vars
│   ├── design-tokens.ts               # Design token detection
│   └── computed.ts                    # Key element computed styles
│
├── network/                           # Network capture
│   ├── index.ts                       # NetworkCapture class
│   ├── capture.ts                     # Request/response listeners
│   ├── api-responses.ts               # JSON response extraction
│   └── timing.ts                      # Performance timing
│
├── storage/                           # Storage extraction
│   ├── index.ts                       # StorageExtractor class
│   ├── cookies.ts                     # Cookie extraction
│   ├── web-storage.ts                 # localStorage/sessionStorage
│   └── categorize.ts                  # Cookie categorization
│
├── interactions/                      # Safe interactions
│   ├── index.ts                       # InteractionRunner class
│   ├── safety-rules.ts                # DO_NOT_CLICK patterns
│   ├── dismiss-cookie.ts              # Cookie banner dismissal
│   ├── expand-accordion.ts            # Accordion expansion
│   ├── expand-menu.ts                 # Menu expansion
│   ├── scroll.ts                      # Stepwise scrolling
│   ├── links.ts                       # Link extraction
│   ├── forms.ts                       # Form extraction
│   └── prices.ts                      # Price extraction
│
├── a11y/                              # Accessibility extraction
│   ├── index.ts                       # A11yExtractor class
│   ├── snapshot.ts                    # Playwright a11y snapshot
│   ├── role-map.ts                    # Map roles to DOM nodes
│   ├── live-regions.ts                # Live region detection
│   ├── focus-order.ts                 # Tab order extraction
│   └── violations.ts                  # Basic a11y checks
│
├── frames/                            # Frames + Shadow DOM
│   ├── index.ts                       # FrameExtractor class
│   ├── iframes.ts                     # iframe extraction
│   ├── shadow-dom.ts                  # Shadow root traversal
│   └── web-components.ts              # Custom element detection
│
├── vision/                            # Screenshots + Vision
│   ├── index.ts                       # VisionExtractor class
│   ├── capture.ts                     # Screenshot capture
│   ├── analyze.ts                     # LLM vision analysis
│   ├── prompts.ts                     # Vision analysis prompts
│   └── dom-mapping.ts                 # Map vision to DOM nodes
│
├── coverage/                          # Multi-state coverage
│   ├── index.ts                       # CoverageExtractor class
│   ├── profiles.ts                    # Coverage depth configs
│   ├── capture.ts                     # State capture
│   └── merge.ts                       # Fingerprint-based merge
│
├── context/                           # LLM context preparation
│   ├── index.ts
│   ├── prepare.ts                     # Progressive disclosure
│   ├── serialize.ts                   # Token-budgeted serialization
│   └── chunking.ts                    # Multi-chunk output
│
└── output/                            # Output formats
    ├── index.ts
    ├── json.ts                        # PageKnowledge JSON
    └── summary.ts                     # Condensed summary
```

### PageKnowledge Schema (v2.0)

```typescript
interface PageKnowledge {
  // ─── VERSION & META ────────────────────────────────────────────
  version: '2.0';
  extractedAt: number;
  extractionDuration: number;

  meta: PageMeta;

  // ─── MODULE: dom ───────────────────────────────────────────────
  dom: {
    landmarks: Landmark[];
    nodes: PageNode[];
    nodeCount: number;
    interactiveCount: number;
    croElementCount: number;
  };

  // ─── MODULE: visible ───────────────────────────────────────────
  visible: {
    textBlocks: TextBlock[];
    aboveFoldNodes: number[];
    viewportOcclusion: number;
  };

  // ─── MODULE: styles ────────────────────────────────────────────
  styles: {
    cssVariables: Record<string, string>;
    designTokens: DesignTokens;
    keyElementStyles: ElementStyleMap[];
    themeMode: 'light' | 'dark' | 'unknown';
  };

  // ─── MODULE: network ───────────────────────────────────────────
  network: {
    requests: NetworkRequest[];
    apiResponses: APIResponse[];
    resourceSummary: ResourceSummary;
    timing: PerformanceTiming;
  };

  // ─── MODULE: storage ───────────────────────────────────────────
  storage: {
    cookies: CookieInfo[];
    localStorage: Record<string, string>;
    sessionStorage: Record<string, string>;
    indexedDBNames: string[];
    serviceWorkerActive: boolean;
  };

  // ─── MODULE: interactions ──────────────────────────────────────
  interactions: {
    links: LinkInfo[];
    forms: FormData[];
    prices: PriceInfo[];
    actionsPerformed: ActionResult[];
  };

  // ─── MODULE: a11y ──────────────────────────────────────────────
  a11y: {
    snapshot: A11yNode;
    roleMap: Record<string, number[]>;
    liveRegions: LiveRegion[];
    focusOrder: FocusableElement[];
    violations: A11yViolation[];
  };

  // ─── MODULE: frames ────────────────────────────────────────────
  frames: {
    iframes: FrameInfo[];
    shadowHosts: ShadowHostInfo[];
    totalShadowElements: number;
    webComponents: WebComponentInfo[];
  };

  // ─── MODULE: vision ────────────────────────────────────────────
  vision: {
    screenshots: Screenshot[];
    analysis?: VisionAnalysis;
  };

  // ─── COVERAGE ──────────────────────────────────────────────────
  coverage: {
    depth: CoverageDepth;
    states: CapturedState[];
    coveragePercent: number;
    missingReasons: string[];
  };

  // ─── CONSTRAINTS & LIMITATIONS ─────────────────────────────────
  constraints: PageConstraints;
  limitations: string[];

  // ─── BUDGETS ───────────────────────────────────────────────────
  budgetsApplied: ExtractionBudgets;
  budgetsExceeded: string[];
}
```

### Key Interfaces

#### PageNode

```typescript
interface PageNode {
  index: number;
  tag: string;
  role?: string;
  accessibleName?: string;
  text: string;                    // Normalized, max 100 chars
  selector: SelectorBundle;
  bbox: BoundingBox;
  landmark?: LandmarkRole;
  nearestHeadingIndex?: number;

  // Visibility & State
  isVisible: boolean;
  isAboveFold: boolean;
  isDisabled: boolean;
  isOccluded: boolean;

  // Classification
  nodeType: NodeType;
  croType?: CROType;
  confidence?: number;

  // Styles (minimal subset)
  styles?: NodeStyles;

  // Identity (for deduplication)
  fingerprint: string;

  // Coverage tracking
  firstSeenIn?: string;
  visibleIn: string[];
  stateChanges?: StateChange[];
}
```

#### SelectorBundle

```typescript
interface SelectorBundle {
  preferred?: string;              // CSS: id/testid/aria-label based
  fallback: SelectorStrategy[];    // Ordered list of fallback strategies
}

type SelectorStrategy =
  | { type: 'role'; role: string; name?: string }
  | { type: 'text'; tag: string; text: string }
  | { type: 'nth'; tag: string; nth: number; withinLandmark?: string }
  | { type: 'xpath'; value: string };
```

#### PageConstraints (Extended)

```typescript
interface PageConstraints {
  // Core constraints
  hasCookieBanner: boolean;
  hasShadowDOM: boolean;
  hasCrossOriginFrames: boolean;
  hasLazyContent: boolean;
  hasStickyHeader: boolean;
  hasModal: boolean;
  occludedViewportPercent?: number;

  // Extended constraints
  hasInfiniteScroll: boolean;
  hasVirtualizedList: boolean;
  hasWebComponents: boolean;
  hasServiceWorker: boolean;
  hasDynamicPricing: boolean;
  requiresAuth: boolean;
  isABTest: boolean;
}
```

#### ExtractionBudgets

```typescript
interface ExtractionBudgets {
  maxNodesTotal: number;           // Default: 250
  maxInteractive: number;          // Default: 120
  maxHeadings: number;             // Default: 50
  maxLinks: number;                // Default: 120
  maxForms: number;                // Default: 10
  maxPrices: number;               // Default: 60
}

const DEFAULT_BUDGETS: ExtractionBudgets = {
  maxNodesTotal: 250,
  maxInteractive: 120,
  maxHeadings: 50,
  maxLinks: 120,
  maxForms: 10,
  maxPrices: 60,
};
```

### Module Specifications

#### styles/ Module

```typescript
interface StylesData {
  cssVariables: Record<string, string>;  // --primary-color: #007bff
  designTokens: DesignTokens;
  keyElementStyles: ElementStyleMap[];
  themeMode: 'light' | 'dark' | 'unknown';
}

interface DesignTokens {
  colors: { primary?: string; secondary?: string; accent?: string; text?: string; background?: string };
  typography: { fontFamily?: string; baseFontSize?: string; headingFont?: string };
  spacing: { unit?: string; containerWidth?: string };
}

// Extract CSS variables from :root
async function extractCSSVariables(page: Page): Promise<Record<string, string>>;
```

#### network/ Module

```typescript
interface NetworkData {
  requests: NetworkRequest[];
  apiResponses: APIResponse[];    // JSON responses < 50KB
  resourceSummary: ResourceSummary;
  timing: PerformanceTiming;
}

interface NetworkRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';
  resourceType: 'document' | 'script' | 'stylesheet' | 'image' | 'font' | 'xhr' | 'fetch' | 'other';
  status: number;
  timing: { startTime: number; duration: number };
  isThirdParty: boolean;
}

interface PerformanceTiming {
  navigationStart: number;
  domContentLoaded: number;
  loadComplete: number;
  firstPaint?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
}

// Attach early - before page.goto()
class NetworkCapture {
  attach(page: Page): void;
  getData(): NetworkData;
}
```

#### storage/ Module

```typescript
interface StorageData {
  cookies: CookieInfo[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  indexedDBNames: string[];
  serviceWorkerActive: boolean;
}

interface CookieInfo {
  name: string;
  value: string;           // Truncated if > 100 chars
  domain: string;
  path: string;
  expires?: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
  category?: 'necessary' | 'analytics' | 'marketing' | 'unknown';
}
```

#### a11y/ Module

```typescript
interface A11yData {
  snapshot: A11yNode;              // Full Playwright accessibility tree
  roleMap: Record<string, number[]>;  // role -> nodeIndices
  liveRegions: LiveRegion[];
  focusOrder: FocusableElement[];
  violations: A11yViolation[];
}

interface A11yViolation {
  type: 'missing-alt' | 'missing-label' | 'low-contrast' | 'empty-button' | 'empty-link';
  nodeIndex: number;
  message: string;
  severity: 'error' | 'warning';
}
```

#### frames/ Module

```typescript
interface FramesShadowData {
  iframes: FrameInfo[];
  shadowHosts: ShadowHostInfo[];
  totalShadowElements: number;
  webComponents: WebComponentInfo[];
}

interface FrameInfo {
  id: string;
  src: string;
  origin: string;
  isSameOrigin: boolean;
  isCrossOrigin: boolean;
  nodes?: PageNode[];         // Only for same-origin
  screenshot?: string;        // Only for same-origin
  dimensions: { width: number; height: number };
  isVisible: boolean;
}

interface ShadowHostInfo {
  hostNodeIndex: number;
  hostTag: string;
  mode: 'open' | 'closed';
  childCount: number;
  interactiveCount: number;
  nodes: PageNode[];
}
```

#### vision/ Module

```typescript
interface VisionData {
  screenshots: Screenshot[];
  analysis?: VisionAnalysis;
}

interface Screenshot {
  id: string;
  type: 'viewport' | 'fullpage' | 'segment' | 'element';
  base64: string;
  width: number;
  height: number;
  scrollY: number;
  capturedAt: number;
  segmentIndex?: number;
  segmentTotal?: number;
  nodeIndex?: number;
}

interface VisionAnalysis {
  layoutType: 'single-column' | 'two-column' | 'grid' | 'hero-cta' | 'form-focused' | 'unknown';
  primaryCTA: VisionCTA | null;
  visualHierarchy: VisualElement[];
  colorScheme: ColorScheme;
  trustSignals: VisualTrustSignal[];
  distractions: VisualDistraction[];
  recommendations: VisionRecommendation[];
}
```

### Pipeline Orchestrator

```typescript
interface ExtractionOptions {
  modules?: {
    dom?: boolean;          // Default: true (required)
    visible?: boolean;      // Default: true
    styles?: boolean;       // Default: true
    network?: boolean;      // Default: true
    storage?: boolean;      // Default: true
    interactions?: boolean; // Default: true
    a11y?: boolean;         // Default: true
    frames?: boolean;       // Default: true
    vision?: boolean;       // Default: false (opt-in)
  };
  budgets?: Partial<ExtractionBudgets>;
  coverageDepth?: CoverageDepth;
  visionModel?: 'gpt-4o' | 'gpt-4o-mini' | 'claude-3-5-sonnet';
  screenshotMode?: 'viewport' | 'fullpage' | 'segments' | 'all';
  segmentCount?: number;
}

class ExtractionPipeline {
  async extract(page: Page, context: BrowserContext): Promise<PageKnowledge>;
}
```

### Safety Rules

```typescript
// src/extraction/interactions/safety-rules.ts
export const DO_NOT_CLICK = [
  // Payment
  /place.?order/i, /submit.?payment/i, /pay.?now/i, /checkout/i,
  /confirm.?purchase/i, /complete.?order/i,

  // Destructive
  /delete/i, /remove/i, /cancel.?subscription/i, /unsubscribe/i,
  /logout/i, /sign.?out/i,

  // External
  /download/i, /open.?in.?app/i
];

export const SAFE_TO_CLICK = [
  // Expand
  /more.?info/i, /show.?more/i, /view.?details/i, /expand/i,
  /read.?more/i, /see.?all/i,

  // Tabs/Accordions
  /specifications/i, /description/i, /reviews/i, /faq/i,
  /shipping/i, /returns/i, /size.?guide/i,

  // Gallery
  /next/i, /prev/i, /thumbnail/i
];
```

### Coverage Profiles

```typescript
type CoverageDepth = 'quick' | 'standard' | 'thorough';

const COVERAGE_PROFILES: Record<CoverageDepth, CoverageProfile> = {
  quick: {
    name: 'quick',
    states: ['initial', 'post_cookie'],
    actions: [{ type: 'dismissCookie' }],
  },
  standard: {
    name: 'standard',
    states: ['initial', 'post_cookie', 'scroll_mid', 'scroll_bottom'],
    actions: [
      { type: 'dismissCookie' },
      { type: 'scroll', to: 0.5 },
      { type: 'scroll', to: 1.0 },
    ],
  },
  thorough: {
    name: 'thorough',
    states: ['initial', 'post_cookie', 'scroll_mid', 'scroll_bottom',
             'accordion_expanded', 'menu_expanded'],
    actions: [
      { type: 'dismissCookie' },
      { type: 'scroll', to: 0.5 },
      { type: 'scroll', to: 1.0 },
      { type: 'expandAccordions', maxClicks: 8 },
      { type: 'expandMenus', maxClicks: 5 },
    ],
  },
};
```

### Fingerprint Generation

```typescript
function generateFingerprint(node: RawNode, context: FingerprintContext): string {
  const parts = [
    node.tag,
    node.role || '',
    normalizeText(node.text).slice(0, 30),
    context.landmarkRole || '',
    context.nearestHeadingIndex?.toString() || '',
    Math.floor((node.bbox?.y || 0) / 100).toString(),  // yBucket
  ];
  return parts.join('|');
}
```

**Why fingerprint anchoring?**
- `tag + role + text` alone would collapse repeated "Add to Cart" buttons on PLP
- Adding `landmarkRole + nearestHeadingIndex + yBucket` provides spatial anchoring
- Same button under different product headings → different fingerprints
- Same button at different Y positions → different fingerprints

### Migration Strategy

1. **Phase 1 - Parallel Implementation** (no breaking changes)
   - New extraction in `src/extraction/` (separate from `src/browser/dom/`)
   - Existing CRO agent continues using old extraction
   - New extraction testable independently

2. **Phase 2 - Integration**
   - Wire new extraction into CROAgent via feature flag
   - `useNewExtraction: boolean` in options
   - Run both in parallel for comparison on real sites

3. **Phase 3 - Cutover**
   - Make new extraction default
   - Deprecate old extraction
   - Update all dependent tests

### Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Typical page node count | Uncapped | 50-200 |
| Snapshot tokens | ~8k+ | < 4k |
| Coverage tokens | ~32k | < 12k |
| Extraction timeout | 10s | 5s |
| PLP handling | Unlimited nodes | Capped + deduped |
| Constraint reporting | None | All 12 types |
| Selector resilience | XPath only | Multi-strategy |
| Fingerprint collisions | Possible | Prevented by anchoring |
| Module coverage | 5 modules | 10 modules |

### Test Summary

| Module | Unit | Integration | E2E | Total |
|--------|------|-------------|-----|-------|
| foundations/ | 36 | - | - | 36 |
| dom/ | 31 | 8 | - | 39 |
| visible/ | 12 | - | - | 12 |
| styles/ | 16 | 4 | - | 20 |
| network/ | 23 | 6 | - | 29 |
| storage/ | 20 | 5 | - | 25 |
| interactions/ | 19 | 6 | - | 25 |
| a11y/ | 21 | 4 | - | 25 |
| frames/ | 17 | 5 | - | 22 |
| vision/ | 22 | 6 | - | 28 |
| coverage/ | 16 | 6 | - | 22 |
| context/ | 6 | 4 | - | 10 |
| pipeline/ | - | 9 | - | 9 |
| E2E original | - | - | 15 | 15 |
| E2E full pipeline | - | - | 22 | 22 |
| Documentation | - | - | - | - |
| **TOTAL** | **239** | **63** | **37** | **351** |

*Note: Test counts aligned with tasks/phase-20.md*
