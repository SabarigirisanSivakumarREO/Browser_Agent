# Feature Specification: Browser Agent Core

**Feature Branch**: `001-browser-agent-core`
**Created**: 2025-01-23
**Status**: Draft
**Input**: User description: "Build a browser agent that can navigate websites and extract data using LangChain for intelligent processing"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - URL Navigation and Page Loading (Priority: P1)

As a user, I want to provide a URL and have the browser agent open it reliably, so that I can begin extracting data from the page.

**Why this priority**: This is the foundational capability. Without reliable URL loading, no other features can function. It establishes the Playwright browser automation pipeline.

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

### Edge Cases

- What happens when a URL requires authentication? **Out of scope** - agent logs a warning and returns partial/no data (no login handling)
- What happens when JavaScript is required to render content? Playwright uses hybrid wait strategy: `load` event + configurable post-load wait (default 5s) for JS rendering
- What happens when the page has dynamic content loading? 60-second timeout allows most dynamic content to load
- What happens when headings contain HTML entities or special characters? Text is decoded and normalized
- What happens when LangChain API is unavailable? Graceful fallback with raw extraction data and error message
- What happens when OPENAI_API_KEY is not set? Agent fails fast with clear error message before attempting browser operations
- What happens when cookie consent popup blocks content? Agent attempts to dismiss it before extraction (best-effort)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept a URL string as input and validate it is well-formed
- **FR-002**: System MUST launch a Playwright browser instance in **visible mode** (non-headless) and navigate to the provided URL
- **FR-003**: System MUST wait for page load completion before attempting extraction using hybrid strategy: `load` event + configurable post-load wait for JS rendering (default: 5s) with a **60-second timeout**
- **FR-004**: System MUST extract all heading elements (h1-h6) with their text content and hierarchy level
- **FR-005**: System MUST pass extracted data to LangChain using **OpenAI GPT-4o-mini** for processing and insight generation
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
- **CR-003**: LangChain MUST be configured to use OpenAI GPT-4o-mini model via OPENAI_API_KEY environment variable
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

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Agent successfully loads 95% of valid public URLs within 60-second timeout
- **SC-002**: Heading extraction accurately captures 100% of visible h1-h6 elements on test pages
- **SC-003**: LangChain processing completes within 10 seconds for pages with up to 50 headings
- **SC-004**: Error messages clearly identify the failure stage (load, extract, process, output)
- **SC-005**: Console output is parseable and includes all extracted data plus LangChain insights
- **SC-006**: End-to-end test with 3 different URLs completes successfully with accurate results
- **SC-007**: Cookie consent popups dismissed successfully on 80%+ of sites with common CMPs
