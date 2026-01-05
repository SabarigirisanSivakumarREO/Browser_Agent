# Requirements: Foundation (Phases 1-12)

**Navigation**: [Index](./index.md) | [User Stories](./user-stories.md) | [CRO Requirements](./requirements-cro.md)

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept a URL string as input and validate it is well-formed
- **FR-002**: System MUST launch a browser instance in **visible mode** (non-headless) and navigate to the provided URL
- **FR-003**: System MUST wait for page load completion before attempting extraction using hybrid strategy: `load` event + configurable post-load wait for JS rendering (default: 5s) with a **60-second timeout**
- **FR-004**: System MUST extract all heading elements (h1-h6) with their text content and hierarchy level
- **FR-005**: System MUST pass extracted data to an LLM for processing and insight generation
- **FR-006**: System MUST output results to console in a structured, readable format
- **FR-007**: System MUST handle errors gracefully with descriptive messages at each stage
- **FR-008**: System MUST log operations with appropriate levels (info, error, debug) per constitution
- **FR-009**: System MUST close browser resources properly after extraction completes or fails
- **FR-010**: System MUST support processing multiple URLs sequentially for end-to-end testing
- **FR-011**: System SHOULD detect common cookie consent popups (OneTrust, Cookiebot, Usercentrics) and attempt dismissal using CMP-specific selectors
- **FR-012**: System SHOULD fallback to text-based heuristic for custom cookie banners (buttons containing "accept", "allow", "agree", "ok")
- **FR-013**: System MUST NOT fail if cookie popup dismissal fails (best-effort approach)
- **FR-014**: System SHOULD support cookie popups rendered in iframes

### Configuration Requirements

- **CR-001**: Browser mode MUST default to visible (headless: false) for debugging and demonstration purposes
- **CR-002**: Page load timeout MUST be set to 60 seconds to handle complex SPAs and slow networks
- **CR-003**: LLM processing MUST be configured via API key environment variable
- **CR-004**: Authentication-required pages are OUT OF SCOPE - agent will not handle login flows in initial version
- **CR-005**: Wait strategy MUST default to `load` with 5-second post-load wait for JS rendering
- **CR-006**: Wait strategy MUST be configurable via CLI (`--wait-until`, `--post-load-wait`)
- **CR-007**: Cookie consent dismissal MUST be enabled by default
- **CR-008**: Cookie consent dismissal MUST be configurable via CLI (`--no-cookie-dismiss`)
- **CR-009**: Cookie consent timeout MUST be 2-3 seconds max (no aggressive retry loops)

### Key Entities

- **BrowserAgent**: Core orchestrator that manages browser lifecycle and coordinates extraction
- **PageLoader**: Handles URL navigation, page load detection, and timeout management
- **HeadingExtractor**: Extracts h1-h6 elements from loaded pages, returns structured data
- **LangChainProcessor**: Sends extracted data to LangChain, parses and returns insights
- **ResultFormatter**: Transforms raw results into formatted console output
- **Heading**: Represents a single heading with level (1-6), text content, and optional metadata
- **CookieConsentHandler**: Detects and dismisses cookie consent popups using CMP patterns and heuristics

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Agent successfully loads 95% of valid public URLs within 60-second timeout
- **SC-002**: Heading extraction accurately captures 100% of visible h1-h6 elements on test pages
- **SC-003**: LangChain processing completes within 10 seconds for pages with up to 50 headings
- **SC-004**: Error messages clearly identify the failure stage (load, extract, process, output)
- **SC-005**: Console output is parseable and includes all extracted data plus LangChain insights
- **SC-006**: End-to-end test with 3 different URLs completes successfully with accurate results
- **SC-007**: Cookie consent popups dismissed successfully on 80%+ of sites with common CMPs

---

## Phase 12b: Enhanced Cookie Consent Detection

**Purpose**: Improve cookie consent detection for Shopify themes, Alpine.js banners, and aria-labeled regions.

**Background**: The current cookie handler (Phase 12) supports 8 CMP patterns and basic text heuristics. Testing revealed that custom Shopify theme banners using Alpine.js and aria-label attributes are not detected, despite having visible "Accept" buttons.

### Functional Requirements (Phase 12b)

- **FR-171**: System MUST detect cookie banners using `aria-label` attribute containing "cookie" (case-insensitive)
- **FR-172**: System MUST detect cookie banners using `role="region"` with cookie-related aria-label
- **FR-173**: System MUST detect Alpine.js cookie banners via `x-data` attributes containing "consent" or "cookie"
- **FR-174**: System MUST detect fixed-position banners with cookie-related classes (`.fixed[class*="cookie"]`)
- **FR-175**: System MUST expand heuristic search to include `<a>`, `<div role="button">`, and `<span role="button">` elements (not just `<button>`)
- **FR-176**: System MUST search for accept buttons within detected cookie containers (context-aware matching)
- **FR-177**: System MUST wait up to 2000ms for dynamically-loaded banners (Alpine.js, etc.)
- **FR-178**: System SHOULD support "Save" button text in addition to "Accept" (for preference dialogs)

### Configuration Requirements (Phase 12b)

- **CR-034**: Cookie banner detection timeout MUST be configurable (default: 2000ms)
- **CR-035**: Heuristic element types MUST be configurable for extensibility

### Success Criteria (Phase 12b)

- **SC-134**: Alpine.js + Tailwind cookie banners detected via `[aria-label*="cookie"]` selector
- **SC-135**: Shopify theme cookie banners dismissed successfully (Peregrine Clothing test case)
- **SC-136**: Heuristic correctly finds accept buttons in `<a>`, `<div>`, `<span>` elements
- **SC-137**: Context-aware matching prioritizes buttons within cookie containers
- **SC-138**: Dynamic banners detected within 2s timeout window
- **SC-139**: No regression on existing CMP pattern detection (OneTrust, Cookiebot, etc.)

### Test Cases (Phase 12b)

| Test | Input | Expected |
|------|-------|----------|
| TC-12b-01 | `[aria-label="cookie banner"]` container | Banner detected, Accept clicked |
| TC-12b-02 | `[role="region"][aria-label*="cookie"]` | Banner detected via aria |
| TC-12b-03 | `[x-data="consent(false)"]` Alpine banner | Banner detected via x-data |
| TC-12b-04 | Accept button as `<a class="btn">` | Heuristic finds and clicks |
| TC-12b-05 | Accept button as `<div role="button">` | Heuristic finds and clicks |
| TC-12b-06 | Delayed banner (1.5s load) | Detected within 2s window |
| TC-12b-07 | Existing OneTrust banner | No regression, still works |
| TC-12b-08 | Peregrine Clothing URL | Banner dismissed successfully |
