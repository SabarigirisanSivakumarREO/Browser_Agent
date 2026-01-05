# User Stories & Scenarios

**Navigation**: [Index](./index.md) | [Requirements Foundation](./requirements-foundation.md)

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - URL Navigation and Page Loading (Priority: P1)

As a user, I want to provide a URL and have the browser agent open it reliably, so that I can begin extracting data from the page.

**Why this priority**: This is the foundational capability. Without reliable URL loading, no other features can function. It establishes the browser automation pipeline.

**Independent Test**: Can be fully tested by providing a valid URL and verifying the page loads successfully. Delivers value by confirming browser automation works.

**Acceptance Scenarios**:

1. **Given** the agent is initialized, **When** a valid URL is provided, **Then** the browser opens the page and returns a success status with page title
2. **Given** the agent is initialized, **When** an invalid URL is provided, **Then** the agent returns a clear error message indicating the URL is malformed
3. **Given** the agent is initialized, **When** a URL times out, **Then** the agent returns a timeout error with the URL that failed

---

### User Story 2 - Heading Extraction (Priority: P2)

As a user, I want to extract all headings (h1-h6) from a loaded page, so that I can understand the structure and main topics of the content.

**Why this priority**: Heading extraction is the first data extraction capability. It provides immediate value by revealing page structure and is simpler than full content extraction.

**Independent Test**: Can be tested by loading a page with known headings and verifying all are extracted with correct hierarchy levels.

**Acceptance Scenarios**:

1. **Given** a page is loaded successfully, **When** heading extraction is triggered, **Then** all h1-h6 elements are returned with their text content and level
2. **Given** a page has no headings, **When** heading extraction is triggered, **Then** an empty array is returned with no errors
3. **Given** a page has nested headings in different sections, **When** extraction runs, **Then** headings are returned in document order

---

### User Story 3 - LangChain Processing (Priority: P3)

As a user, I want extracted headings processed through LangChain to get insights like counts and categorization, so that I can understand the content at a glance.

**Why this priority**: LangChain integration adds intelligence to raw extraction. It transforms data into actionable insights but depends on extraction working first.

**Independent Test**: Can be tested by providing mock heading data to LangChain and verifying it returns structured analysis.

**Acceptance Scenarios**:

1. **Given** headings have been extracted, **When** LangChain processing is triggered, **Then** a summary is returned with heading count by level (h1: X, h2: Y, etc.)
2. **Given** headings have been extracted, **When** LangChain processing is triggered, **Then** headings are categorized by likely topic/theme
3. **Given** no headings were extracted, **When** LangChain processing is triggered, **Then** a message indicates no content to analyze

---

### User Story 4 - Console Output and Results (Priority: P4)

As a user, I want clear console output showing the extraction results and LangChain insights, so that I can easily review what was found.

**Why this priority**: Output formatting is the final user-facing step. It makes the tool usable but is independent of core extraction logic.

**Independent Test**: Can be tested by providing mock results and verifying formatted console output matches expected structure.

**Acceptance Scenarios**:

1. **Given** extraction and processing complete successfully, **When** results are displayed, **Then** console shows structured output with URL, heading counts, and insights
2. **Given** an error occurred during processing, **When** results are displayed, **Then** console shows the error with context about what failed
3. **Given** multiple URLs are processed, **When** results are displayed, **Then** each URL's results are clearly separated and labeled

---

### User Story 5 - Cookie Consent Handling (Priority: P5)

As a user, I want the browser agent to automatically dismiss cookie consent popups, so that content extraction is not blocked by overlay dialogs.

**Why this priority**: Cookie consent popups overlay page content and can block heading extraction. Many EU/GDPR-compliant sites show these immediately on page load.

**Independent Test**: Load a site with known cookie popup, verify it's dismissed before extraction.

**Acceptance Scenarios**:

1. **Given** a page with a known CMP (OneTrust, Cookiebot, Usercentrics), **When** the page loads, **Then** the agent clicks the accept button using CMP-specific selectors
2. **Given** a page with a custom cookie banner, **When** the page loads, **Then** the agent uses text-based heuristic to find and click accept button
3. **Given** a page without a cookie popup, **When** the page loads, **Then** extraction proceeds normally without delay
4. **Given** a popup that cannot be dismissed, **When** extraction runs, **Then** agent logs warning and continues (best-effort)
5. **Given** a cookie popup in an iframe, **When** the page loads, **Then** the agent searches within the iframe to dismiss it

---

### User Story 6 - DOM Extraction & Classification (Priority: P1)

As a CRO analyst, I want to extract all interactive and CRO-relevant elements from a page with proper classification, so that the agent can systematically analyze conversion optimization opportunities.

**Why this priority**: DOM extraction is the foundation for CRO analysis. Without accurate element detection and classification, no CRO insights can be generated.

**Independent Test**: Load a page with known CTAs, forms, and trust signals. Verify all elements extracted with correct classifications.

**Acceptance Scenarios**:

1. **Given** a page is loaded, **When** DOM extraction runs, **Then** all visible interactive elements (buttons, links, inputs) are captured with bounding boxes
2. **Given** a page with CRO elements, **When** extraction runs, **Then** elements are classified as: cta|form|trust|value_prop|navigation
3. **Given** elements are extracted, **When** serialized for LLM, **Then** output uses indexed text format `[index]<tag>text</tag>` within token budget
4. **Given** visibility detection runs, **When** element is hidden via CSS or clipped, **Then** element is excluded from extraction

---

### User Story 7 - Agent Loop & Tool Execution (Priority: P1)

As a CRO analyst, I want the agent to iteratively analyze a page using tools based on LLM decisions, so that analysis is thorough and adaptive to page content.

**Why this priority**: The agent loop is the core runtime that enables intelligent, multi-step analysis rather than single-pass extraction.

**Independent Test**: Run agent on test page, verify it completes within max steps, executes multiple tools, and produces structured insights.

**Acceptance Scenarios**:

1. **Given** agent starts analysis, **When** step loop runs, **Then** each step follows observe→reason→act pattern
2. **Given** agent invokes a tool, **When** tool execution fails, **Then** failure counter increments and agent retries
3. **Given** 3 consecutive failures occur, **When** next step runs, **Then** agent forces completion (done)
4. **Given** agent completes analysis, **When** LLM returns done action, **Then** agent exits loop with collected insights
5. **Given** agent is running, **When** max steps reached, **Then** agent exits with current findings

---

### User Story 8 - CRO Analysis Tools (Priority: P2)

As a CRO analyst, I want specialized tools for analyzing CTAs, forms, trust signals, value props, and navigation, so that I get domain-specific insights.

**Why this priority**: CRO tools provide the actual analysis capabilities. They depend on DOM extraction (US6) and agent loop (US7).

**Independent Test**: Invoke each tool with mock page state, verify tool returns relevant CRO insights.

**Acceptance Scenarios**:

1. **Given** CTAs are present, **When** cta-analyzer runs, **Then** returns insights on text clarity, placement, prominence
2. **Given** forms are present, **When** form-analyzer runs, **Then** returns field count, label quality, validation issues
3. **Given** trust signals exist, **When** trust-detector runs, **Then** identifies badges, reviews, guarantees, certifications
4. **Given** hero section exists, **When** value-prop tool runs, **Then** assesses headline clarity, benefit communication
5. **Given** navigation present, **When** navigation-analyzer runs, **Then** checks menu structure, breadcrumbs, search presence
6. **Given** any page, **When** friction-finder runs, **Then** identifies general friction points across all CRO categories

---

### User Story 9 - Heuristic Analysis (Priority: P2)

As a CRO analyst, I want rule-based checks against CRO best practices, so that I catch common issues without relying solely on LLM judgment.

**Why this priority**: Heuristics provide deterministic, fast checks that complement LLM analysis. They ensure consistent detection of known issues.

**Independent Test**: Run heuristic engine on page with known violations, verify all violations detected with correct severity.

**Acceptance Scenarios**:

1. **Given** a page with CTAs, **When** heuristics run, **Then** vague CTA text is flagged as medium severity
2. **Given** a form with >5 fields, **When** heuristics run, **Then** form is flagged as high friction
3. **Given** no trust signals above fold, **When** heuristics run, **Then** missing trust is flagged
4. **Given** business type detected, **When** heuristics run, **Then** industry-specific rules apply
5. **Given** heuristic check passes, **When** results compiled, **Then** no false positive is generated

---

### User Story 10 - Hypothesis Generation & Reporting (Priority: P3)

As a CRO analyst, I want insights transformed into A/B test hypotheses and structured reports, so that I can act on findings.

**Why this priority**: Output generation is the final deliverable. It depends on all prior analysis being complete.

**Independent Test**: Provide mock insights, verify hypotheses generated and report includes all sections.

**Acceptance Scenarios**:

1. **Given** high/critical severity insights, **When** hypothesis generator runs, **Then** A/B test specs are created with control/treatment descriptions
2. **Given** analysis complete, **When** markdown reporter runs, **Then** report includes: Executive Summary, Critical Issues, High/Medium/Low Priority sections
3. **Given** hypothesis generated, **When** formatted, **Then** follows template: "If {recommendation}, then {metric} will improve because {issue}"
4. **Given** CLI --output-format markdown, **When** agent completes, **Then** report written to specified file
5. **Given** CLI --output-format json, **When** agent completes, **Then** structured JSON exported

---

### User Story 11 - Full Page Coverage (Priority: P1)

As a CRO analyst, I want the agent to guarantee 100% page content analysis regardless of page length, so that no conversion opportunities are missed on long pages.

**Why this priority**: Current LLM-dependent scrolling leads to incomplete coverage (20-60% on long pages). This is a critical reliability issue that undermines the entire analysis.

**Independent Test**: Run analysis on a 10+ viewport page, verify all segments scanned and all CRO elements discovered.

**Acceptance Scenarios**:

1. **Given** a page that is 3 viewports tall, **When** full_page scan mode runs, **Then** all 3 segments are scanned with 100% coverage
2. **Given** agent tries to call 'done' at 50% coverage, **When** coverage enforcer checks, **Then** 'done' is blocked and agent scrolls to next uncovered segment
3. **Given** full_page scan completes, **When** DOM is serialized, **Then** all CRO elements from all segments are included
4. **Given** scanMode is 'llm_guided', **When** analysis runs, **Then** original LLM-dependent scrolling behavior is preserved
5. **Given** scanMode is 'above_fold', **When** analysis runs, **Then** only initial viewport is analyzed (quick mode)

---

### User Story 12 - Unified Extraction Pipeline (Priority: P1)

As a developer, I want a layered, reusable extraction pipeline with strict token budgets and multi-strategy selectors, so that extraction is reliable, token-efficient, and can be used outside CRO context.

**Why this priority**: Current extraction lacks hard caps (can explode on PLPs), uses fragile XPath-only selectors, and doesn't report limitations honestly. This undermines reliability and reusability.

**Independent Test**: Extract from PLP with 500+ products, verify nodes capped at budget, fingerprints prevent false deduplication, and constraints reported.

**Acceptance Scenarios**:

1. **Given** a page with 500 interactive elements, **When** extraction runs, **Then** output is capped at maxNodesTotal (250) with above-fold prioritization
2. **Given** extraction completes, **When** output is checked, **Then** each node has SelectorBundle with preferred CSS + fallback strategies
3. **Given** a page with cookie banner occluding content, **When** constraints detected, **Then** hasCookieBanner=true and occludedViewportPercent reported
4. **Given** repeated "Add to Cart" buttons on PLP, **When** coverage merges states, **Then** fingerprint anchoring prevents false deduplication
5. **Given** standard coverage depth, **When** states captured, **Then** initial + post_cookie + scroll_mid + scroll_bottom states included
6. **Given** snapshot extracted, **When** serialized for LLM, **Then** output is < 4k tokens
7. **Given** landmarks extracted, **When** output checked, **Then** at least 'main' landmark present with bbox and nodeCount

---

### User Story 13 - Constraint Detection & Honesty (Priority: P2)

As a CRO analyst, I want the extraction to report what it couldn't extract and why, so that I know the limitations of the analysis.

**Why this priority**: Current extraction fails silently on shadow DOM, cross-origin iframes, and lazy content. This leads to false confidence in incomplete data.

**Acceptance Scenarios**:

1. **Given** a page with shadow DOM components, **When** constraints checked, **Then** hasShadowDOM=true and limitation noted
2. **Given** a page with cross-origin iframe (reviews widget), **When** constraints checked, **Then** hasCrossOriginFrames=true
3. **Given** a page with lazy-loaded content, **When** scroll triggers new content, **Then** hasLazyContent=true
4. **Given** a page with sticky header, **When** constraints checked, **Then** hasStickyHeader=true with height
5. **Given** a modal dialog open, **When** constraints checked, **Then** hasModal=true
6. **Given** any extraction, **When** output returned, **Then** limitations[] array documents what was missed

---

### User Story 14 - Selector Resilience (Priority: P2)

As a test automation engineer, I want element selectors that survive DOM changes, so that recorded actions remain stable across deployments.

**Why this priority**: XPath-only selectors break when DOM structure changes. Multi-strategy fallbacks provide resilience.

**Acceptance Scenarios**:

1. **Given** an element with data-testid, **When** selector generated, **Then** preferred uses CSS with data-testid
2. **Given** an element with aria-label, **When** selector generated, **Then** fallback includes role+name strategy
3. **Given** an element with visible text, **When** selector generated, **Then** fallback includes text strategy
4. **Given** a selector bundle, **When** resolver tries to find element, **Then** strategies are tried in order until unique match
5. **Given** no strategy finds unique match, **When** resolver completes, **Then** null returned (never throws)

---

## Edge Cases (MVP)

- What happens when a URL requires authentication? **Out of scope** - agent logs a warning and returns partial/no data (no login handling)
- What happens when JavaScript is required to render content? Browser automation uses hybrid wait strategy: `load` event + configurable post-load wait (default 5s) for JS rendering
- What happens when the page has dynamic content loading? 60-second timeout allows most dynamic content to load
- What happens when headings contain HTML entities or special characters? Text is decoded and normalized
- What happens when LLM API is unavailable? Graceful fallback with raw extraction data and error message
- What happens when LLM API key is not set? Agent fails fast with clear error message before attempting browser operations
- What happens when cookie consent popup blocks content? Agent attempts to dismiss it before extraction (best-effort)
