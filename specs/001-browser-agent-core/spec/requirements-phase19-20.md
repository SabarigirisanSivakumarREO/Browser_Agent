# Requirements: Phase 19-20 (Coverage & Pipeline)

**Navigation**: [Index](./index.md) | [CRO Requirements](./requirements-cro.md)

---

## Coverage System Requirements (Phase 19)

**Functional Requirements**:
- **FR-098**: System MUST provide ScanMode type with values: 'full_page' (default), 'above_fold', 'llm_guided'
- **FR-099**: System MUST provide CoverageTracker class that tracks page segments and element discovery
- **FR-100**: System MUST initialize segments based on page height with configurable overlap (default 100px)
- **FR-101**: System MUST track which segments have been scanned and calculate coverage percentage
- **FR-102**: System MUST record all discovered CRO elements with their first-seen segment
- **FR-103**: System MUST block 'done' action when coverage < minCoveragePercent (default 100%)
- **FR-104**: System MUST auto-scroll to next uncovered segment when 'done' is blocked
- **FR-105**: System MUST provide DOMMerger class that merges DOM snapshots from multiple segments
- **FR-106**: System MUST convert bounding box coordinates from viewport-relative to page-absolute
- **FR-107**: System MUST calculate dynamic maxSteps based on page height and viewport size
- **FR-108**: System MUST include coverage report in LLM prompts showing scanned/unscanned regions
- **FR-109**: System MUST provide getCoverageReport() for human-readable coverage status

**Configuration Requirements**:
- **CR-022**: ScanMode MUST default to 'full_page' for guaranteed coverage
- **CR-023**: minCoveragePercent MUST default to 100 (full coverage required)
- **CR-024**: segmentOverlapPx MUST default to 100 for seamless element capture
- **CR-025**: Token budget MUST be 32000 for full_page mode (vs 8000 for llm_guided)
- **CR-026**: Dynamic maxSteps MUST be calculated as: segments + analysisTools + 2

**CLI Requirements**:
- **FR-110**: CLI MUST support --scan-mode flag with values: full_page, above_fold, llm_guided
- **FR-111**: CLI MUST support --min-coverage flag (0-100, default 100)
- **FR-112**: CLI MUST default to full_page scan mode when no --scan-mode specified

### Success Criteria (Phase 19)

**Coverage Tracker**:
- **SC-060**: CoverageTracker initializes correct segment count for page dimensions
- **SC-061**: CoverageTracker marks segments scanned and updates coverage percentage
- **SC-062**: CoverageTracker returns next unscanned segment correctly
- **SC-063**: CoverageTracker generates accurate coverage report for LLM
- **SC-064**: Coverage enforcement blocks premature 'done' calls
- **SC-065**: Coverage enforcement forces scroll to uncovered segment

**DOM Handling**:
- **SC-066**: Bounding boxes use page-absolute coordinates (include scrollY)
- **SC-067**: DOMMerger correctly merges snapshots from multiple segments
- **SC-068**: DOMMerger deduplicates elements by xpath
- **SC-069**: DOMMerger recalculates element indices after merge

**Integration**:
- **SC-070**: full_page mode achieves 100% coverage on 3-viewport test page
- **SC-071**: full_page mode achieves 100% coverage on 10-viewport test page
- **SC-072**: above_fold mode only scans initial viewport
- **SC-073**: llm_guided mode preserves original behavior
- **SC-074**: Dynamic maxSteps adjusts for page height

**Test Totals**:
- **SC-075**: Phase 19 adds 26 tests (16 unit + 6 integration + 4 e2e)

---

## Unified Extraction Pipeline Requirements (Phase 20)

**Layer 0 - Shared Foundations**:

- **FR-113**: System MUST define PageSnapshot interface with snapshotVersion, meta, screenshot, landmarks, nodes, links, forms, prices, constraints, limitations
- **FR-114**: System MUST define PageCoverage interface with coverageVersion, depth, baseSnapshot, states, mergedNodes, coveragePercent, missingCoverageReasons
- **FR-115**: System MUST define ExtractionBudgets with configurable caps: maxNodesTotal (250), maxInteractive (120), maxHeadings (50), maxLinks (120), maxForms (10), maxPrices (60)
- **FR-116**: System MUST define SelectorBundle with preferred CSS selector and fallback SelectorStrategy[]
- **FR-117**: System MUST define SelectorStrategy union: role, text, nth, xpath
- **FR-118**: System MUST provide SelectorResolver that tries strategies in order until unique match

**Layer 1 - Page Snapshot**:

- **FR-119**: System MUST extract PageMeta: url, title, lang, description, canonical, viewport, pageHeight, loadTimeMs, timestamp
- **FR-120**: System MUST capture viewport screenshot (not full page) as base64 with width/height
- **FR-121**: System MUST extract Landmarks using accessibility.snapshot() with DOM fallback
- **FR-122**: System MUST ensure at least 'main' landmark present (fallback to body)
- **FR-123**: System MUST extract PageNodes with candidate selection then enrichment
- **FR-124**: System MUST enrich nodes with: bbox (absolute), isVisible, isAboveFold, isDisabled, isOccluded, role, accessibleName, text, styles subset
- **FR-125**: System MUST generate node fingerprint from: tag + role + normalizedText + landmarkRole + nearestHeadingIndex + yBucket
- **FR-126**: System MUST prioritize above-fold nodes, dedupe near-identical in same landmark, enforce budget caps
- **FR-127**: System MUST extract links with href, isExternal, isNavigation
- **FR-128**: System MUST extract forms with fields (type, name, label, required, placeholder) and submitButtonIndex
- **FR-129**: System MUST extract prices with raw text, parsed currency, parsed value (best-effort)
- **FR-130**: System MUST detect constraints (12 types): hasCookieBanner, hasShadowDOM, hasCrossOriginFrames, hasLazyContent, hasStickyHeader, hasModal, hasInfiniteScroll, hasVirtualizedList, hasWebComponents, hasServiceWorker, hasDynamicPricing, requiresAuth, isABTest, occludedViewportPercent

**Layer 2 - State Coverage**:

- **FR-131**: System MUST define CoverageDepth profiles: quick (initial + post_cookie), standard (+ scroll_mid + scroll_bottom), thorough (+ expand_accordions + expand_menus)
- **FR-132**: System MUST provide dismissCookieBanner action with known CMP patterns + text heuristic fallback
- **FR-133**: System MUST provide expandAccordions action within main landmark only, max 8 clicks
- **FR-134**: System MUST provide expandMenus action (thorough only), max 5 clicks, skip destructive actions
- **FR-135**: System MUST capture state with: name, scrollY, screenshot, nodeCount, newNodes, changedNodes
- **FR-136**: System MUST detect changes: appeared, disappeared, text_changed, position_changed
- **FR-137**: System MUST merge states by fingerprint, track firstSeenIn/visibleIn[], compute coveragePercent

**Layer 3 - CRO Analysis Context**:

- **FR-138**: System MUST provide prepareContext() that packages meta + landmarks + constraints + top 25 priority nodes
- **FR-139**: System MUST provide request_more_nodes tool for LLM to request additional nodes by landmark/type/state
- **FR-140**: System MUST limit main analysis to 1 pass + up to 2 follow-up passes (cost control)
- **FR-141**: System MUST ensure every insight/hypothesis references node indices and/or state screenshots

**Module: styles/** (CSS & Design Tokens):

- **FR-142**: System MUST extract CSS variables from :root element
- **FR-143**: System MUST detect design tokens (primary/secondary colors, typography, spacing)
- **FR-144**: System MUST extract computed styles for key elements (CTAs, headings, forms)
- **FR-145**: System MUST detect theme mode (light/dark/unknown)

**Module: network/** (Request/Response Capture):

- **FR-146**: System MUST capture network requests with url, method, resourceType, status, timing
- **FR-147**: System MUST capture JSON API responses (< 50KB body limit)
- **FR-148**: System MUST extract performance timing (navigationStart, FCP, LCP, loadComplete)
- **FR-149**: System MUST identify third-party domains in resource summary

**Module: storage/** (Cookies & Web Storage):

- **FR-150**: System MUST extract all cookies with name, value, domain, path, expiry, flags
- **FR-151**: System MUST categorize cookies (necessary, analytics, marketing, unknown)
- **FR-152**: System MUST extract localStorage and sessionStorage (truncate values > 200 chars)
- **FR-153**: System MUST detect IndexedDB database names and service worker presence

**Module: a11y/** (Accessibility):

- **FR-154**: System MUST extract accessibility snapshot using page.accessibility.snapshot()
- **FR-155**: System MUST build role map linking a11y roles to DOM node indices
- **FR-156**: System MUST extract focus order (tab sequence) mapped to node indices
- **FR-157**: System MUST detect basic a11y violations (missing-alt, missing-label, empty-button, empty-link)
- **FR-158**: System MUST extract live regions with role categorization

**Module: frames/** (iframes & Shadow DOM):

- **FR-159**: System MUST extract same-origin iframe content (nodes + screenshot)
- **FR-160**: System MUST extract cross-origin iframe metadata only (src, dimensions, visibility)
- **FR-161**: System MUST traverse shadow DOM recursively (max depth 5)
- **FR-162**: System MUST detect web components from customElements registry

**Module: vision/** (Screenshots & LLM Analysis):

- **FR-163**: System MUST capture viewport, fullpage, and segment screenshots
- **FR-164**: System MUST capture element-level screenshots by node index
- **FR-165**: System MUST provide optional LLM vision analysis (opt-in, uses GPT-4o)
- **FR-166**: System MUST map vision analysis results back to DOM node indices

**Pipeline Integration**:

- **FR-167**: System MUST orchestrate modules in correct order (network before navigation)
- **FR-168**: System MUST handle module failures gracefully (continue with available data)
- **FR-169**: System MUST compile limitations[] array documenting extraction gaps
- **FR-170**: System MUST serialize PageKnowledge to JSON and condensed LLM summary

### Configuration Requirements (Phase 20)

- **CR-027**: ExtractionBudgets MUST be configurable with sensible defaults
- **CR-028**: Snapshot token output MUST target < 4k tokens
- **CR-029**: Standard coverage token output MUST target < 12k tokens
- **CR-030**: SelectorResolver MUST timeout after 5s per strategy attempt
- **CR-031**: CoverageDepth MUST default to 'standard' for CRO analysis
- **CR-032**: expandAccordions MUST wait 300ms after each click
- **CR-033**: expandMenus MUST skip buttons containing: logout, sign out, delete, remove

### Success Criteria (Phase 20)

**Layer 0 - Foundations**:
- **SC-076**: All new types compile and export correctly
- **SC-077**: ExtractionBudgets enforced correctly on high-element pages
- **SC-078**: SelectorBundle generated with preferred + fallback strategies
- **SC-079**: SelectorResolver tries strategies in order, returns null on failure

**Layer 1 - Snapshot**:
- **SC-080**: PageMeta extracted correctly including loadTimeMs
- **SC-081**: Screenshot captured as viewport (not full page) with dimensions
- **SC-082**: Landmarks extracted via accessibility API with DOM fallback
- **SC-083**: At least 'main' landmark present on all pages
- **SC-084**: Nodes capped at budget limits (typical: 50-200)
- **SC-085**: Above-fold nodes prioritized in output
- **SC-086**: Fingerprints prevent false deduplication of repeated elements
- **SC-087**: Links extracted with isExternal/isNavigation flags
- **SC-088**: Forms extracted with field labels resolved
- **SC-089**: Prices parsed with currency/value (best-effort)
- **SC-090**: All 6 constraint types detected correctly

**Layer 2 - Coverage**:
- **SC-091**: CoverageDepth profiles execute correct state sequence
- **SC-092**: dismissCookieBanner works on known CMPs
- **SC-093**: expandAccordions stays within main landmark, respects max clicks
- **SC-094**: expandMenus skips destructive actions
- **SC-095**: State changes detected correctly (appeared/disappeared/changed)
- **SC-096**: Merge by fingerprint prevents collisions on PLPs

**Layer 3 - Analysis Context**:
- **SC-097**: prepareContext outputs < 4k tokens for snapshot
- **SC-098**: request_more_nodes returns filtered nodes within budget
- **SC-099**: Analysis completes in 1-2 passes (cost control)
- **SC-100**: All insights reference node indices

**Robustness**:
- **SC-101**: No hang on SPA hydration delay
- **SC-102**: No hang on infinite network chatter (analytics)
- **SC-103**: Cross-origin iframe flagged, no crash
- **SC-104**: Shadow DOM flagged, visible content extracted

**Module: styles/**:
- **SC-106**: CSS variables extracted from :root
- **SC-107**: Design tokens detected (colors, typography)
- **SC-108**: Theme mode detected correctly
- **SC-109**: Computed styles extracted for key elements

**Module: network/**:
- **SC-110**: Network requests captured with timing
- **SC-111**: JSON API responses captured (< 50KB)
- **SC-112**: Performance timing extracted (FCP, LCP)
- **SC-113**: Third-party domains identified

**Module: storage/**:
- **SC-114**: Cookies extracted with all properties
- **SC-115**: Cookie categorization accurate
- **SC-116**: Web storage extracted and truncated
- **SC-117**: IndexedDB and service worker detected

**Module: a11y/**:
- **SC-118**: Accessibility snapshot extracted
- **SC-119**: Role map links to DOM indices
- **SC-120**: Focus order extracted correctly
- **SC-121**: Basic violations detected

**Module: frames/**:
- **SC-122**: Same-origin iframe content extracted
- **SC-123**: Cross-origin iframe metadata only
- **SC-124**: Shadow DOM traversed recursively
- **SC-125**: Web components detected

**Module: vision/**:
- **SC-126**: Screenshots captured (viewport, fullpage, segment)
- **SC-127**: Element screenshots by node index
- **SC-128**: Vision analysis maps to DOM nodes
- **SC-129**: Vision module opt-in works correctly

**Pipeline Integration**:
- **SC-130**: Modules execute in correct order
- **SC-131**: Module failures handled gracefully
- **SC-132**: Limitations array populated correctly
- **SC-133**: PageKnowledge serialization valid

**Test Totals**:
- **SC-105**: Phase 20 adds 351 tests (259 unit + 70 integration + 22 e2e)
