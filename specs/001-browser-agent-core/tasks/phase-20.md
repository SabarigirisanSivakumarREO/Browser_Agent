**Navigation**: [Index](./index.md) | [Previous](./phase-19.md)

---

## Phase 20: Unified Extraction Pipeline

**Purpose**: Build modular, reusable extraction with 10 modules, strict token budgets, multi-strategy selectors, and constraint reporting

**User Stories**: US12 (Pipeline), US13 (Constraints), US14 (Selectors)

**Acceptance Tests** (must pass before phase complete):
- PLP with 500+ elements → nodes capped at 250
- Snapshot serialization → < 4k tokens
- Standard coverage → < 12k tokens
- Fingerprint anchoring → no false deduplication on repeated buttons
- Constraints → all 12 types detected
- All 10 modules extracting data correctly

---

### Phase 20a: foundations/ - Types, Budgets, Selectors (T147-T155)

**Purpose**: Shared types, schemas, budgets, selector strategies

- [ ] T147 [P] [US12] Create src/extraction/types.ts with all interfaces
  - PageKnowledge, PageNode, PageMeta
  - SelectorBundle, SelectorStrategy union types
  - PageConstraints (12 types), ExtractionBudgets
  - Landmark, LinkInfo, FormData, PriceInfo
  - StylesData, NetworkData, StorageData, A11yData, FramesShadowData, VisionData
  - version: "2.0"

- [ ] T148 [P] [US12] Create src/extraction/budgets.ts
  - DEFAULT_BUDGETS constant with all caps
  - validateBudgets(budgets: Partial<ExtractionBudgets>): ExtractionBudgets
  - mergeBudgets(defaults, overrides): ExtractionBudgets

- [ ] T149 [US14] Create src/extraction/selectors/bundle.ts
  - createSelectorBundle(element, context): SelectorBundle
  - Generate preferred CSS from id/data-testid/aria-label
  - Generate fallback strategies: role, text, nth, xpath

- [ ] T150 [US14] Create src/extraction/selectors/resolver.ts
  - class SelectorResolver
  - resolve(page, bundle): Promise<ElementHandle | null>
  - resolveAll(page, bundle): Promise<ElementHandle[]>
  - tryStrategy(page, strategy): Promise<ElementHandle | null>
  - Never throws, returns null on failure
  - 5s timeout per strategy

- [ ] T151 [P] Create src/extraction/selectors/index.ts with exports

- [ ] T152 [P] Create tests/unit/extraction/types.test.ts (6 tests)
  - Test: PageKnowledge interface validates correctly
  - Test: SelectorBundle requires fallback array
  - Test: PageConstraints all fields present
  - Test: ExtractionBudgets defaults applied
  - Test: All module data types compile
  - Test: NodeType/CROType unions exhaustive

- [ ] T153 [P] Create tests/unit/extraction/budgets.test.ts (8 tests)
  - Test: DEFAULT_BUDGETS has all required caps
  - Test: validateBudgets enforces positive numbers
  - Test: validateBudgets rejects negative values
  - Test: mergeBudgets preserves defaults for missing keys
  - Test: mergeBudgets overrides with provided values
  - Test: maxNodesTotal default is 250
  - Test: maxInteractive default is 120
  - Test: all caps have sensible maximums

- [ ] T154 Create tests/unit/extraction/selector-bundle.test.ts (10 tests)
  - Test: generates preferred from data-testid
  - Test: generates preferred from id
  - Test: generates preferred from aria-label
  - Test: fallback includes role strategy when role present
  - Test: fallback includes text strategy when text visible
  - Test: fallback includes nth strategy
  - Test: fallback always includes xpath
  - Test: strategies ordered by reliability
  - Test: handles elements with no attributes gracefully
  - Test: escapes special characters in selectors

- [ ] T155 Create tests/unit/extraction/selector-resolver.test.ts (12 tests)
  - Test: resolves via preferred CSS first
  - Test: falls back when preferred not unique
  - Test: role strategy uses getByRole
  - Test: text strategy uses has-text locator
  - Test: nth strategy with landmark scope
  - Test: xpath strategy as last resort
  - Test: returns null when no strategy matches
  - Test: never throws on invalid selector
  - Test: handles page navigation during resolve
  - Test: respects timeout per strategy
  - Test: resolveAll returns all matches
  - Test: empty bundle returns null

**Checkpoint**: All types compile, budgets enforce caps, selectors resolve

---

### Phase 20b: dom/ - Meta & Screenshot (T156-T159)

**Purpose**: Fast extraction of page metadata and screenshot

- [ ] T156 [US12] Create src/extraction/dom/meta.ts
  - extractMeta(page): Promise<PageMeta>
  - Extract: url, title, lang, description, canonical
  - Extract: viewport width/height, pageHeight
  - Extract: ogTitle, ogDescription, ogImage
  - Measure loadTimeMs
  - Handle missing meta tags gracefully
  - 5s timeout

- [ ] T157 [US12] Create src/extraction/vision/capture.ts
  - captureScreenshot(page, type): Promise<Screenshot>
  - Types: viewport, fullpage, segment
  - Return base64 with width/height
  - Handle failures gracefully

- [ ] T158 Create tests/unit/extraction/meta.test.ts (5 tests)
  - Test: extracts url and title
  - Test: extracts meta description
  - Test: extracts canonical link
  - Test: calculates pageHeight correctly
  - Test: handles missing meta tags

- [ ] T159 Create tests/unit/extraction/screenshot.test.ts (4 tests)
  - Test: returns base64 string
  - Test: includes width and height
  - Test: viewport screenshot not full page
  - Test: handles screenshot failure gracefully

**Checkpoint**: Meta and screenshot extraction work

---

### Phase 20c: dom/ - Landmarks (T160-T161)

**Purpose**: Extract page landmarks using accessibility API with DOM fallback

- [ ] T160 [US12] Create src/extraction/dom/landmarks.ts
  - extractLandmarks(page): Promise<Landmark[]>
  - Try page.accessibility.snapshot() first
  - Map accessibility tree roles to LandmarkRole
  - Fallback: query semantic HTML (header, nav, main, footer, aside)
  - Fallback: query ARIA roles ([role="banner"], etc.)
  - Ensure 'main' always present (use body if needed)
  - Calculate bbox and nodeCount for each landmark

- [ ] T161 Create tests/unit/extraction/landmarks.test.ts (8 tests)
  - Test: extracts landmarks from accessibility API
  - Test: falls back to DOM when accessibility unavailable
  - Test: identifies header as banner
  - Test: identifies nav as navigation
  - Test: identifies main element
  - Test: identifies footer as contentinfo
  - Test: ensures main always present
  - Test: calculates bbox for each landmark

**Checkpoint**: Landmarks extraction with accessibility API and DOM fallback

---

### Phase 20d: dom/ - Key Nodes & Fingerprint (T162-T166)

**Purpose**: Extract and enrich key page nodes with fingerprinting

- [ ] T162 [US12] Create src/extraction/dom/nodes.ts
  - extractKeyNodes(page, budgets): Promise<PageNode[]>
  - Candidate selection: headings, interactive, ARIA roles, forms, images, tables, prices
  - Enrichment: bbox (absolute), isVisible, isAboveFold, isDisabled, isOccluded
  - Enrichment: role, accessibleName, text (max 100 chars), styles subset
  - Generate SelectorBundle for each node
  - Prioritize above-fold, dedupe in same landmark
  - Enforce budget caps (maxNodesTotal, maxInteractive, etc.)
  - Return 50-200 nodes for typical pages

- [ ] T163 [US12] Create src/extraction/dom/fingerprint.ts
  - generateFingerprint(node, context): string
  - Include: tag, role, normalizedText (30 chars), landmarkRole
  - Include: nearestHeadingIndex, yBucket (Math.floor(y / 100))
  - Anchoring prevents false deduplication of repeated elements

- [ ] T164 [P] Create src/extraction/dom/scripts/extract-nodes.ts
  - Injectable browser script for DOM extraction
  - Candidate selection logic
  - Visibility detection (CSS, viewport, clip, aria-hidden)
  - Interactive detection (tag, role, onclick, cursor, tabindex)
  - Return raw node data for enrichment

- [ ] T165 Create tests/unit/extraction/nodes.test.ts (15 tests)
  - Test: extracts headings h1-h6
  - Test: extracts interactive elements
  - Test: extracts ARIA role elements
  - Test: extracts form elements
  - Test: extracts images with alt
  - Test: extracts price elements
  - Test: enriches with absolute bbox
  - Test: detects isVisible correctly
  - Test: detects isAboveFold correctly
  - Test: detects isDisabled correctly
  - Test: detects isOccluded via elementFromPoint
  - Test: enforces maxNodesTotal cap
  - Test: prioritizes above-fold nodes
  - Test: dedupes near-identical in same landmark
  - Test: generates SelectorBundle for each node

- [ ] T166 Create tests/unit/extraction/fingerprint.test.ts (8 tests)
  - Test: includes tag in fingerprint
  - Test: includes role in fingerprint
  - Test: includes truncated text
  - Test: includes landmark role
  - Test: includes nearest heading index
  - Test: includes yBucket for position
  - Test: different buttons under different headings → different fingerprints
  - Test: same button at different Y → different fingerprints (PLP test)

**Checkpoint**: Node extraction with budget enforcement and fingerprinting

---

### Phase 20e: interactions/ - Links, Forms, Prices (T167-T172)

**Purpose**: Links, forms, prices extraction from nodes

- [ ] T167 [US12] Create src/extraction/interactions/links.ts
  - extractLinks(nodes, pageUrl): LinkInfo[]
  - Filter nodes with href attribute
  - Detect isExternal (different origin)
  - Detect isNavigation (within nav landmark)
  - Enforce maxLinks budget

- [ ] T168 [US12] Create src/extraction/interactions/forms.ts
  - extractForms(page, nodes): Promise<FormData[]>
  - Group form fields by parent form
  - Resolve labels: label[for], aria-label, placeholder fallback
  - Detect submit button by type or text
  - Enforce maxForms budget

- [ ] T169 [US12] Create src/extraction/interactions/prices.ts
  - extractPrices(nodes): PriceInfo[]
  - Match price patterns (class, data-price, text patterns)
  - Parse currency symbol/code
  - Parse numeric value (handle formats: $1,234.56)
  - Best-effort: return raw even if parse fails
  - Enforce maxPrices budget

- [ ] T170 Create tests/unit/extraction/links.test.ts (5 tests)
  - Test: extracts href from link nodes
  - Test: detects external links correctly
  - Test: detects navigation links within nav
  - Test: enforces maxLinks budget
  - Test: handles relative URLs

- [ ] T171 Create tests/unit/extraction/forms.test.ts (8 tests)
  - Test: groups fields by parent form
  - Test: resolves label via for attribute
  - Test: resolves label via aria-label
  - Test: falls back to placeholder
  - Test: detects required fields
  - Test: detects submit button by type
  - Test: detects submit button by text
  - Test: enforces maxForms budget

- [ ] T172 Create tests/unit/extraction/prices.test.ts (6 tests)
  - Test: extracts from price class elements
  - Test: extracts from data-price elements
  - Test: parses USD format ($1,234.56)
  - Test: parses EUR format (€1.234,56)
  - Test: parses GBP format (£1,234.56)
  - Test: returns raw when parse fails

**Checkpoint**: Specialized extractions with budget enforcement

---

### Phase 20f: visible/ - Constraints Detection (T173-T174)

**Purpose**: Detect page constraints for honesty reporting

- [ ] T173 [US13] Create src/extraction/visible/constraints.ts
  - detectConstraints(page): Promise<PageConstraints>
  - hasCookieBanner: detect by CMP patterns + viewport occlusion
  - hasShadowDOM: check for shadow hosts
  - hasCrossOriginFrames: check iframe src origins
  - hasLazyContent: detect scrollHeight changes or IntersectionObserver
  - hasStickyHeader: position:fixed at top with height > 40px
  - hasModal: dialog role or high z-index overlay
  - hasInfiniteScroll: detect scroll event handlers
  - hasVirtualizedList: detect virtual scroll containers
  - hasWebComponents: check customElements registry
  - hasServiceWorker: check navigator.serviceWorker
  - hasDynamicPricing: detect price change mutations
  - requiresAuth: detect login forms/redirects
  - isABTest: detect A/B test cookies/scripts
  - occludedViewportPercent: estimate based on overlays

- [ ] T174 Create tests/unit/extraction/constraints.test.ts (12 tests)
  - Test: detects OneTrust cookie banner
  - Test: detects Cookiebot cookie banner
  - Test: detects generic cookie banner by text
  - Test: detects shadow DOM presence
  - Test: detects cross-origin iframe
  - Test: detects lazy content via scrollHeight
  - Test: detects sticky header by position
  - Test: detects modal by dialog role
  - Test: detects modal by z-index overlay
  - Test: calculates occlusion percentage
  - Test: all constraints false on clean page
  - Test: handles constraint detection errors gracefully

**Checkpoint**: All 12 constraint types detected correctly

---

### Phase 20g: dom/ - DOMExtractor Assembly (T175-T176)

**Purpose**: Assemble complete DOM extraction

- [ ] T175 [US12] Create src/extraction/dom/index.ts
  - class DOMExtractor
  - extract(page, budgets?): Promise<DOMData>
  - Orchestrate: meta, landmarks, nodes
  - Add extractedAt timestamp
  - Handle partial failures (continue with available data)

- [ ] T176 Create tests/integration/extraction/dom.test.ts (8 tests)
  - Test: extracts complete DOM from real page
  - Test: nodes capped at budget
  - Test: landmarks include at least main
  - Test: handles page navigation during extraction
  - Test: handles extraction timeout gracefully
  - Test: fingerprints are unique for repeated elements
  - Test: above-fold nodes prioritized
  - Test: selector bundles generated for all nodes

**Checkpoint**: Complete DOM extraction working

---

### Phase 20h: interactions/ - Action Primitives (T177-T181)

**Purpose**: Implement action primitives for state exploration

- [ ] T177 [US12] Create src/extraction/interactions/dismiss-cookie.ts
  - dismissCookieBanner(page): Promise<ActionResult>
  - Try known CMPs: OneTrust, Cookiebot, Usercentrics, Quantcast
  - Fallback: text heuristic (accept, agree, allow, ok)
  - Max 3 attempts, 1s timeout per attempt
  - Return { success, method, id/text }

- [ ] T178 [US12] Create src/extraction/interactions/expand-accordion.ts
  - expandAccordions(page, config): Promise<ActionResult>
  - Target: summary, [aria-expanded="false"], .accordion-trigger
  - Only within main landmark
  - Max clicks configurable (default 8)
  - Skip nav/header elements
  - Wait 300ms after each click
  - Return { success, clickedCount }

- [ ] T179 [US12] Create src/extraction/interactions/expand-menu.ts
  - expandMenus(page, config): Promise<ActionResult>
  - Target: [aria-haspopup], [aria-expanded="false"][role="button"]
  - Max clicks configurable (default 5)
  - Skip destructive: logout, sign out, delete, remove
  - Return { success, clickedCount }

- [ ] T180 [US12] Create src/extraction/interactions/safety-rules.ts
  - DO_NOT_CLICK patterns (payment, destructive, external)
  - SAFE_TO_CLICK patterns (expand, tabs, gallery)
  - isSafeToClick(text): boolean
  - isDangerous(text): boolean

- [ ] T181 Create tests/unit/extraction/actions.test.ts (15 tests)
  - Test: dismissCookieBanner detects OneTrust
  - Test: dismissCookieBanner detects Cookiebot
  - Test: dismissCookieBanner uses text heuristic
  - Test: dismissCookieBanner respects max attempts
  - Test: expandAccordions targets summary elements
  - Test: expandAccordions stays in main landmark
  - Test: expandAccordions respects max clicks
  - Test: expandAccordions skips nav elements
  - Test: expandAccordions waits between clicks
  - Test: expandMenus targets aria-haspopup
  - Test: expandMenus respects max clicks
  - Test: expandMenus skips logout buttons
  - Test: expandMenus skips delete buttons
  - Test: all actions return ActionResult
  - Test: all actions handle errors gracefully

**Checkpoint**: Action primitives with guardrails

---

### Phase 20i: coverage/ - Capture & Merge (T182-T186)

**Purpose**: Capture states and merge with deduplication

- [ ] T182 [US12] Create src/extraction/coverage/profiles.ts
  - COVERAGE_PROFILES constant for quick/standard/thorough
  - getCoverageProfile(depth): CoverageProfile
  - validateCoverageDepth(depth): boolean

- [ ] T183 [US12] Create src/extraction/coverage/capture.ts
  - captureState(page, snapshot, name): Promise<CapturedState>
  - Record: name, scrollY, screenshot, nodeCount
  - Compare nodes to previous: compute newNodes, changedNodes
  - Detect changes: appeared, disappeared, text_changed, position_changed

- [ ] T184 [US12] Create src/extraction/coverage/merge.ts
  - mergeStates(base, captures): MergedCoverage
  - Dedupe nodes by fingerprint
  - Track firstSeenIn for new nodes
  - Track visibleIn[] for each node
  - Record stateChanges[] on nodes
  - Compute coveragePercent
  - Compile missingCoverageReasons[]

- [ ] T185 Create tests/unit/extraction/capture.test.ts (6 tests)
  - Test: captures state with correct name
  - Test: captures scrollY position
  - Test: computes newNodes count
  - Test: computes changedNodes count
  - Test: detects text_changed
  - Test: detects position_changed

- [ ] T186 Create tests/unit/extraction/merge.test.ts (10 tests)
  - Test: merges base with single capture
  - Test: merges multiple captures
  - Test: dedupes by fingerprint
  - Test: tracks firstSeenIn correctly
  - Test: tracks visibleIn[] correctly
  - Test: records stateChanges on nodes
  - Test: computes coveragePercent
  - Test: handles empty captures
  - Test: prevents collision on repeated elements (PLP)
  - Test: compiles missingCoverageReasons

**Checkpoint**: State capture and merge with deduplication

---

### Phase 20j: coverage/ - CoverageExtractor Assembly (T187-T188)

**Purpose**: Assemble complete coverage extraction

- [ ] T187 [US12] Create src/extraction/coverage/index.ts
  - class CoverageExtractor
  - extract(page, domData, depth?): Promise<CoverageData>
  - Execute coverage profile actions in sequence
  - Capture state after each action
  - Merge all states
  - Handle action failures (continue with available states)

- [ ] T188 Create tests/integration/extraction/coverage.test.ts (6 tests)
  - Test: quick depth captures initial + post_cookie
  - Test: standard depth captures 4 states
  - Test: thorough depth captures 6 states
  - Test: coverage < 12k tokens when serialized
  - Test: handles action failures gracefully
  - Test: merge prevents fingerprint collisions

**Checkpoint**: Complete coverage extraction working

---

### Phase 20k: context/ - LLM Context Preparation (T189-T193)

**Purpose**: Prepare progressive context for LLM analysis

- [ ] T189 [US12] Create src/extraction/context/serialize.ts
  - serializeNodes(nodes, tokenBudget): SerializationResult
  - Format: [index]<tag>text</tag> [flags]
  - Sort by priority (above-fold first)
  - Enforce token budget (estimateTokens: chars/4)
  - Return { output, nodeCount, estimatedTokens, truncated }

- [ ] T190 [US12] Create src/extraction/context/prepare.ts
  - prepareContext(coverage): LLMContext
  - Always include: meta, landmarks, constraints
  - Include top 25 priority nodes
  - Priority: above-fold interactives, h1/h2, prices, CTAs
  - Add instructions for request_more_nodes tool
  - Target ~2-4k tokens

- [ ] T191 [P] Create src/extraction/context/index.ts with exports

- [ ] T192 Create tests/unit/extraction/serialize.test.ts (6 tests)
  - Test: formats node correctly
  - Test: sorts above-fold first
  - Test: respects token budget
  - Test: returns truncated flag when cut
  - Test: estimates tokens correctly
  - Test: handles empty node list

- [ ] T193 Create tests/integration/extraction/context.test.ts (4 tests)
  - Test: prepareContext < 4k tokens
  - Test: includes meta, landmarks, constraints
  - Test: includes priority nodes
  - Test: includes expansion instructions

**Checkpoint**: LLM context preparation within token budget

---

### Phase 20l: Module Integration (T194-T195)

**Purpose**: Wire up module exports and integration tests

- [ ] T194 [P] Create src/extraction/index.ts with all exports
  - Export DOMExtractor
  - Export CoverageExtractor
  - Export SelectorResolver
  - Export all types
  - Export DEFAULT_BUDGETS

- [ ] T195 Create tests/integration/extraction/budget-enforcement.test.ts (4 tests)
  - Test: PLP with 500+ elements → nodes capped at 250
  - Test: tokens stay within budget
  - Test: above-fold prioritized in cap
  - Test: repeated elements not collapsed

**Checkpoint**: Full extraction module integrated

---

### Phase 20m: E2E Tests - Original (T196-T200)

**Purpose**: End-to-end validation on real pages

- [ ] T196 [P] Create tests/e2e/extraction/homepage.test.ts (3 tests)
  - Test: extracts hero CTA from marketing page
  - Test: extracts navigation
  - Test: extracts footer

- [ ] T197 [P] Create tests/e2e/extraction/plp.test.ts (3 tests)
  - Test: handles many repeated CTAs
  - Test: extracts filters
  - Test: fingerprints prevent collapse

- [ ] T198 [P] Create tests/e2e/extraction/pdp.test.ts (3 tests)
  - Test: extracts price
  - Test: extracts add-to-cart CTA
  - Test: handles accordions

- [ ] T199 [P] Create tests/e2e/extraction/form.test.ts (2 tests)
  - Test: extracts form fields with labels
  - Test: detects submit button

- [ ] T200 Create tests/e2e/extraction/robustness.test.ts (4 tests)
  - Test: no hang on SPA hydration
  - Test: no hang on analytics chatter
  - Test: cross-origin iframe flagged
  - Test: shadow DOM flagged

**Checkpoint**: E2E tests pass on real pages

---

### Phase 20n: Documentation (T201-T204)

**Purpose**: Update docs and prepare for integration

- [ ] T201 Update SESSION-HANDOFF.md with Phase 20 progress
- [ ] T202 Update quickstart.md with new extraction usage
- [ ] T203 Document migration path from old extraction
- [ ] T204 Add feature flag for integration (useNewExtraction)

**Checkpoint**: Documentation complete, migration path clear

---

### Phase 20o: styles/ Module (T205-T212)

**Purpose**: CSS variables, design tokens, computed styles extraction

- [ ] T205 Create src/extraction/styles/css-variables.ts
  - extractCSSVariables(page): Promise<Record<string, string>>
  - Extract :root custom properties
  - Filter relevant variables (colors, spacing, typography)

- [ ] T206 Create src/extraction/styles/design-tokens.ts
  - extractDesignTokens(cssVars): DesignTokens
  - Detect primary/secondary/accent colors
  - Detect typography tokens (font-family, base size)
  - Detect spacing tokens

- [ ] T207 Create src/extraction/styles/computed.ts
  - extractKeyElementStyles(page, nodeIndices): Promise<ElementStyleMap[]>
  - Extract computed styles for key elements (CTAs, forms, headings)
  - Limited subset: color, background, font, padding, border
  - Max 20 elements

- [ ] T208 Create src/extraction/styles/index.ts
  - class StylesExtractor
  - extract(page, nodes): Promise<StylesData>
  - Detect themeMode (light/dark)

- [ ] T209 Create tests/unit/extraction/css-variables.test.ts (4 tests)
  - Test: extracts :root variables
  - Test: filters irrelevant variables
  - Test: handles pages with no CSS vars
  - Test: handles errors gracefully

- [ ] T210 Create tests/unit/extraction/design-tokens.test.ts (4 tests)
  - Test: detects primary color
  - Test: detects font family
  - Test: detects spacing unit
  - Test: handles missing tokens

- [ ] T211 Create tests/unit/extraction/computed-styles.test.ts (4 tests)
  - Test: extracts color property
  - Test: extracts font-size
  - Test: limits to max elements
  - Test: handles hidden elements

- [ ] T212 Create tests/integration/extraction/styles.test.ts (4 tests)
  - Test: full styles extraction
  - Test: theme mode detection
  - Test: handles dark mode sites
  - Test: handles CSS-in-JS

**Checkpoint**: styles/ module complete with 16 tests

---

### Phase 20p: network/ Module (T213-T222)

**Purpose**: Request/response capture, API JSON, timing extraction

- [ ] T213 Create src/extraction/network/capture.ts
  - class NetworkCapture
  - attach(page): void - attach listeners before navigation
  - private onRequest(req): void
  - private onResponse(res): void
  - private onRequestFailed(req): void

- [ ] T214 Create src/extraction/network/api-responses.ts
  - captureAPIResponse(response): Promise<APIResponse | null>
  - Only capture JSON responses
  - Size limit: 50KB
  - Parse and store body

- [ ] T215 Create src/extraction/network/timing.ts
  - extractTiming(page): Promise<PerformanceTiming>
  - Extract: navigationStart, domContentLoaded, loadComplete
  - Extract: firstPaint, firstContentfulPaint, largestContentfulPaint
  - Use Performance API

- [ ] T216 Create src/extraction/network/resources.ts
  - buildResourceSummary(requests): ResourceSummary
  - Count by resource type
  - Identify third-party domains
  - Calculate total size

- [ ] T217 Create src/extraction/network/index.ts
  - getData(): NetworkData
  - Compile requests, apiResponses, resourceSummary, timing

- [ ] T218 Create tests/unit/extraction/network-capture.test.ts (5 tests)
  - Test: captures GET requests
  - Test: captures POST requests
  - Test: captures response status
  - Test: identifies resource type
  - Test: handles request failures

- [ ] T219 Create tests/unit/extraction/api-responses.test.ts (4 tests)
  - Test: captures JSON response body
  - Test: respects size limit
  - Test: skips non-JSON responses
  - Test: handles parse errors

- [ ] T220 Create tests/unit/extraction/timing.test.ts (4 tests)
  - Test: extracts navigation timing
  - Test: extracts paint timing
  - Test: handles missing metrics
  - Test: returns defaults on error

- [ ] T221 Create tests/unit/extraction/resources.test.ts (4 tests)
  - Test: counts by resource type
  - Test: identifies third-party domains
  - Test: calculates total size
  - Test: handles empty requests

- [ ] T222 Create tests/integration/extraction/network.test.ts (6 tests)
  - Test: full network capture on real page
  - Test: captures XHR requests
  - Test: captures fetch requests
  - Test: third-party detection accurate
  - Test: timing metrics reasonable
  - Test: handles sites with many requests

**Checkpoint**: network/ module complete with 23 tests

---

### Phase 20q: storage/ Module (T223-T230)

**Purpose**: Cookies, localStorage, sessionStorage extraction

- [ ] T223 Create src/extraction/storage/cookies.ts
  - extractCookies(context): Promise<CookieInfo[]>
  - Extract all cookies from browser context
  - Truncate values > 100 chars

- [ ] T224 Create src/extraction/storage/categorize.ts
  - categorizeCookie(cookie): CookieCategory
  - Heuristic categorization: necessary, analytics, marketing, unknown
  - Pattern matching on cookie names

- [ ] T225 Create src/extraction/storage/web-storage.ts
  - extractWebStorage(page): Promise<WebStorageData>
  - Extract localStorage
  - Extract sessionStorage
  - Truncate values > 200 chars
  - Get IndexedDB database names
  - Detect service worker

- [ ] T226 Create src/extraction/storage/index.ts
  - class StorageExtractor
  - extract(page, context): Promise<StorageData>

- [ ] T227 Create tests/unit/extraction/cookies.test.ts (5 tests)
  - Test: extracts all cookies
  - Test: truncates long values
  - Test: includes all cookie properties
  - Test: handles empty cookies
  - Test: handles secure cookies

- [ ] T228 Create tests/unit/extraction/categorize.test.ts (5 tests)
  - Test: categorizes _ga as analytics
  - Test: categorizes _fbp as marketing
  - Test: categorizes session as necessary
  - Test: categorizes unknown cookies
  - Test: handles edge cases

- [ ] T229 Create tests/unit/extraction/web-storage.test.ts (5 tests)
  - Test: extracts localStorage
  - Test: extracts sessionStorage
  - Test: truncates long values
  - Test: gets IndexedDB names
  - Test: detects service worker

- [ ] T230 Create tests/integration/extraction/storage.test.ts (5 tests)
  - Test: full storage extraction
  - Test: handles sites with many cookies
  - Test: handles sites with large localStorage
  - Test: cookie categorization accurate
  - Test: handles permission errors

**Checkpoint**: storage/ module complete with 20 tests

---

### Phase 20r: a11y/ Module (T231-T240)

**Purpose**: Accessibility snapshot, role mapping, focus order

- [ ] T231 Create src/extraction/a11y/snapshot.ts
  - extractA11ySnapshot(page): Promise<A11yNode>
  - Use page.accessibility.snapshot()
  - Include full tree with interestingOnly: false

- [ ] T232 Create src/extraction/a11y/role-map.ts
  - buildRoleMap(a11yTree, domNodes): Record<string, number[]>
  - Map A11y roles to DOM node indices
  - Match by accessible name + role

- [ ] T233 Create src/extraction/a11y/live-regions.ts
  - extractLiveRegions(page): Promise<LiveRegion[]>
  - Detect aria-live regions
  - Categorize by role (alert, status, log, etc.)

- [ ] T234 Create src/extraction/a11y/focus-order.ts
  - extractFocusOrder(page, domNodes): Promise<FocusableElement[]>
  - Get tab order sequence
  - Map to node indices

- [ ] T235 Create src/extraction/a11y/violations.ts
  - checkBasicViolations(domNodes): A11yViolation[]
  - Check: missing-alt, missing-label, empty-button, empty-link
  - Return severity and message

- [ ] T236 Create src/extraction/a11y/index.ts
  - class A11yExtractor
  - extract(page, domNodes): Promise<A11yData>

- [ ] T237 Create tests/unit/extraction/a11y-snapshot.test.ts (4 tests)
  - Test: extracts full a11y tree
  - Test: includes all roles
  - Test: includes accessible names
  - Test: handles empty tree

- [ ] T238 Create tests/unit/extraction/role-map.test.ts (4 tests)
  - Test: maps button role to indices
  - Test: maps link role to indices
  - Test: handles unmatched roles
  - Test: handles duplicate names

- [ ] T239 Create tests/unit/extraction/violations.test.ts (5 tests)
  - Test: detects missing alt
  - Test: detects missing label
  - Test: detects empty button
  - Test: detects empty link
  - Test: returns correct severity

- [ ] T240 Create tests/integration/extraction/a11y.test.ts (4 tests)
  - Test: full a11y extraction
  - Test: role map accurate
  - Test: focus order correct
  - Test: violations detected

**Checkpoint**: a11y/ module complete with 21 tests

---

### Phase 20s: frames/ Module (T241-T249)

**Purpose**: iframes + shadow DOM traversal

- [ ] T241 Create src/extraction/frames/iframes.ts
  - extractFrames(page): Promise<FrameInfo[]>
  - Iterate page.frames()
  - Same-origin: extract nodes + screenshot
  - Cross-origin: metadata only
  - Calculate dimensions, visibility

- [ ] T242 Create src/extraction/frames/shadow-dom.ts
  - extractShadowDOM(page): Promise<ShadowHostInfo[]>
  - Find all shadow hosts
  - Recursive traversal (max depth 5)
  - Extract shadow nodes

- [ ] T243 Create src/extraction/frames/web-components.ts
  - detectWebComponents(page): Promise<WebComponentInfo[]>
  - Check customElements registry
  - Count instances of each tag
  - Detect if has shadow DOM

- [ ] T244 Create src/extraction/frames/index.ts
  - class FrameExtractor
  - extract(page): Promise<FramesShadowData>

- [ ] T245 Create tests/unit/extraction/iframes.test.ts (4 tests)
  - Test: extracts same-origin iframe
  - Test: handles cross-origin iframe
  - Test: calculates dimensions
  - Test: detects visibility

- [ ] T246 Create tests/unit/extraction/shadow-dom.test.ts (5 tests)
  - Test: finds shadow hosts
  - Test: extracts shadow nodes
  - Test: respects max depth
  - Test: handles closed shadows
  - Test: counts elements correctly

- [ ] T247 Create tests/unit/extraction/web-components.test.ts (3 tests)
  - Test: detects custom elements
  - Test: counts instances
  - Test: detects shadow presence

- [ ] T248 Create tests/integration/extraction/frames.test.ts (5 tests)
  - Test: full frames extraction
  - Test: shadow DOM on real site
  - Test: handles nested shadows
  - Test: handles multiple iframes
  - Test: cross-origin flagged

**Checkpoint**: frames/ module complete with 17 tests

---

### Phase 20t: vision/ Module (T249-T261)

**Purpose**: Screenshots + LLM visual analysis

- [ ] T249 Create src/extraction/vision/capture.ts (enhanced)
  - captureSegments(page, count): Promise<Screenshot[]>
  - captureElement(page, nodeIndex, selector): Promise<Screenshot | null>
  - Scroll and capture each segment
  - Wait for lazy content

- [ ] T250 Create src/extraction/vision/prompts.ts
  - buildVisionPrompt(context): string
  - CRO-focused analysis prompt
  - Structured output schema for VisionAnalysis

- [ ] T251 Create src/extraction/vision/analyze.ts
  - class VisionAnalyzer
  - analyze(screenshots, context): Promise<VisionAnalysis>
  - GPT-4o vision API integration
  - Parse structured response

- [ ] T252 Create src/extraction/vision/dom-mapping.ts
  - mapVisionToDOM(analysis, domNodes): VisionDOMMapping[]
  - Match vision elements to DOM nodes
  - BBox overlap matching
  - Return confidence scores

- [ ] T253 Create src/extraction/vision/index.ts
  - class VisionExtractor
  - extract(page, context, options): Promise<VisionData>
  - Optional LLM analysis (opt-in)

- [ ] T254 Create tests/unit/extraction/vision-capture.test.ts (5 tests)
  - Test: captures viewport screenshot
  - Test: captures fullpage screenshot
  - Test: captures segments
  - Test: captures element screenshot
  - Test: handles capture failures

- [ ] T255 Create tests/unit/extraction/vision-prompts.test.ts (3 tests)
  - Test: builds valid prompt
  - Test: includes context
  - Test: specifies output format

- [ ] T256 Create tests/unit/extraction/vision-analyze.test.ts (4 tests)
  - Test: parses valid response
  - Test: handles API errors
  - Test: handles invalid response
  - Test: extracts all analysis fields

- [ ] T257 Create tests/unit/extraction/dom-mapping.test.ts (4 tests)
  - Test: matches by bbox overlap
  - Test: calculates confidence
  - Test: handles no matches
  - Test: handles multiple matches

- [ ] T258 Create tests/integration/extraction/vision.test.ts (6 tests)
  - Test: screenshots without analysis
  - Test: full vision with analysis (mocked)
  - Test: segment capture accurate
  - Test: DOM mapping reasonable
  - Test: handles large pages
  - Test: handles pages with modals

**Checkpoint**: vision/ module complete with 22 tests

---

### Phase 20u: Pipeline Integration (T259-T268)

**Purpose**: Assemble complete extraction pipeline

- [ ] T259 Create src/extraction/pipeline.ts
  - class ExtractionPipeline
  - constructor(options: ExtractionOptions)
  - extract(page, context): Promise<PageKnowledge>
  - Orchestrate all modules in correct order
  - Handle module failures gracefully
  - Compile limitations based on constraints

- [ ] T260 Update src/extraction/types.ts
  - Add ExtractionOptions interface
  - Add module toggle options
  - Add PageKnowledge v2.0 complete interface

- [ ] T261 Create src/extraction/output/json.ts
  - serializePageKnowledge(pk): string
  - JSON serialization with formatting

- [ ] T262 Create src/extraction/output/summary.ts
  - summarizeForLLM(pk, tokenBudget): string
  - Condensed summary for LLM context

- [ ] T263 Create tests/integration/extraction/pipeline.test.ts (6 tests)
  - Test: pipeline with all modules enabled
  - Test: pipeline with selective modules
  - Test: pipeline handles module failures
  - Test: pipeline respects budgets
  - Test: pipeline compiles limitations
  - Test: pipeline timing reasonable

- [ ] T264 Create tests/integration/extraction/output.test.ts (3 tests)
  - Test: JSON serialization valid
  - Test: summary within budget
  - Test: summary includes key info

**Checkpoint**: Pipeline integration complete

---

### Phase 20v: E2E Full Pipeline (T265-T278)

**Purpose**: End-to-end validation of complete pipeline

- [ ] T265 Create tests/e2e/extraction/full-ecommerce.test.ts (3 tests)
  - Test: e-commerce PDP with all modules
  - Test: extracts price, CTA, forms
  - Test: vision analysis reasonable

- [ ] T266 Create tests/e2e/extraction/full-saas.test.ts (3 tests)
  - Test: SaaS landing page
  - Test: network capture accurate
  - Test: storage extraction works

- [ ] T267 Create tests/e2e/extraction/full-shadow.test.ts (2 tests)
  - Test: page with web components
  - Test: shadow nodes extracted

- [ ] T268 Create tests/e2e/extraction/full-iframes.test.ts (2 tests)
  - Test: page with iframes
  - Test: cross-origin flagged correctly

- [ ] T269 Create tests/e2e/extraction/vision-accuracy.test.ts (2 tests)
  - Test: vision CTA matches DOM CTA
  - Test: vision layout detection accurate

- [ ] T270 Create tests/e2e/extraction/budget-enforcement.test.ts (2 tests)
  - Test: large PLP stays within budget
  - Test: tokens within limits

- [ ] T271 Create tests/e2e/extraction/timeout-handling.test.ts (2 tests)
  - Test: slow page doesn't hang
  - Test: partial results returned

- [ ] T272 Create tests/e2e/extraction/graceful-degradation.test.ts (2 tests)
  - Test: continues when module fails
  - Test: limitations populated correctly

- [ ] T273 Create tests/e2e/extraction/large-plp.test.ts (2 tests)
  - Test: PLP with 500+ products
  - Test: fingerprints prevent collapse

- [ ] T274 Create tests/e2e/extraction/spa-lazy.test.ts (2 tests)
  - Test: SPA with lazy loading
  - Test: content captured after scroll

**Checkpoint**: All E2E tests pass

---

## Phase 20 Summary

| Sub-Phase | Module | Tasks | Tests | Status |
|-----------|--------|-------|-------|--------|
| 20a | foundations/ | T147-T155 (9) | 36 | Pending |
| 20b | dom/ meta | T156-T159 (4) | 9 | Pending |
| 20c | dom/ landmarks | T160-T161 (2) | 8 | Pending |
| 20d | dom/ nodes | T162-T166 (5) | 23 | Pending |
| 20e | interactions/ links/forms/prices | T167-T172 (6) | 19 | Pending |
| 20f | visible/ constraints | T173-T174 (2) | 12 | Pending |
| 20g | dom/ assembly | T175-T176 (2) | 8 | Pending |
| 20h | interactions/ actions | T177-T181 (5) | 15 | Pending |
| 20i | coverage/ capture | T182-T186 (5) | 16 | Pending |
| 20j | coverage/ assembly | T187-T188 (2) | 6 | Pending |
| 20k | context/ | T189-T193 (5) | 10 | Pending |
| 20l | integration | T194-T195 (2) | 4 | Pending |
| 20m | E2E original | T196-T200 (5) | 15 | Pending |
| 20n | documentation | T201-T204 (4) | - | Pending |
| **20o** | **styles/** | T205-T212 (8) | 16 | Pending |
| **20p** | **network/** | T213-T222 (10) | 23 | Pending |
| **20q** | **storage/** | T223-T230 (8) | 20 | Pending |
| **20r** | **a11y/** | T231-T240 (10) | 21 | Pending |
| **20s** | **frames/** | T241-T248 (8) | 17 | Pending |
| **20t** | **vision/** | T249-T258 (10) | 22 | Pending |
| **20u** | **pipeline** | T259-T264 (6) | 9 | Pending |
| **20v** | **E2E full** | T265-T274 (10) | 22 | Pending |
| **TOTAL** | | **128 tasks** | **351 tests** | Pending |

---

## Success Criteria

- [ ] All 128 tasks completed
- [ ] All 351 tests passing
- [ ] PLP with 500+ elements → nodes capped at 250
- [ ] Snapshot serialization → < 4k tokens
- [ ] Standard coverage → < 12k tokens
- [ ] Fingerprint anchoring → no false deduplication
- [ ] All 12 constraint types detected
- [ ] All 10 modules extracting data correctly
- [ ] Vision analysis accuracy > 80% for primary CTA
- [ ] Extraction timeout < 10s for typical pages
