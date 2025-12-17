# Feature Specification: Browser Agent Core

**Feature Branch**: `001-browser-agent-core`
**Created**: 2025-01-23
**Status**: Complete (Phase 19 - 100% Page Coverage)
**Input**: User description: "Build a browser agent that can navigate websites and extract data using LangChain for intelligent processing"

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

### Edge Cases (MVP)

- What happens when a URL requires authentication? **Out of scope** - agent logs a warning and returns partial/no data (no login handling)
- What happens when JavaScript is required to render content? Browser automation uses hybrid wait strategy: `load` event + configurable post-load wait (default 5s) for JS rendering
- What happens when the page has dynamic content loading? 60-second timeout allows most dynamic content to load
- What happens when headings contain HTML entities or special characters? Text is decoded and normalized
- What happens when LLM API is unavailable? Graceful fallback with raw extraction data and error message
- What happens when LLM API key is not set? Agent fails fast with clear error message before attempting browser operations
- What happens when cookie consent popup blocks content? Agent attempts to dismiss it before extraction (best-effort)

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

### Key Entities (CRO Agent)

- **CROAgent**: Main agent class with step loop, tool execution, and state management
- **DOMExtractor**: Injects buildCroDomTree.js, extracts and classifies CRO elements
- **ToolRegistry**: Registers tools with Zod schemas, executes by name with validation
- **MessageBuilder**: Assembles LLM context from page state and memory
- **OutputParser**: Validates LLM output against CROAgentOutput Zod schema
- **HeuristicEngine**: Rule-based checks against CRO best practices
- **HypothesisGenerator**: Transforms high-severity insights into A/B test specs
- **MarkdownReporter**: Generates structured analysis reports
- **CROMemory**: Tracks step history, findings, and analysis context
- **PageState**: Current DOM tree, URL, title, and element states
- **DOMTree**: Hierarchical tree of DOM nodes with CRO classifications
- **CROInsight**: Individual finding with type, severity, element, issue, recommendation, evidence
- **Hypothesis**: A/B test spec with control, treatment, metric, and expected impact

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Agent successfully loads 95% of valid public URLs within 60-second timeout
- **SC-002**: Heading extraction accurately captures 100% of visible h1-h6 elements on test pages
- **SC-003**: LangChain processing completes within 10 seconds for pages with up to 50 headings
- **SC-004**: Error messages clearly identify the failure stage (load, extract, process, output)
- **SC-005**: Console output is parseable and includes all extracted data plus LangChain insights
- **SC-006**: End-to-end test with 3 different URLs completes successfully with accurate results
- **SC-007**: Cookie consent popups dismissed successfully on 80%+ of sites with common CMPs

## Requirements - CRO Agent (FR-015 to FR-030)

### Functional Requirements (CRO Agent)

- **FR-015**: System MUST extract all visible interactive elements with bounding boxes
- **FR-016**: System MUST classify elements as cta|form|trust|value_prop|navigation
- **FR-017**: System MUST serialize DOM to indexed text format for LLM consumption
- **FR-018**: System MUST implement agent loop with configurable max steps limit
- **FR-019**: System MUST provide tool registry with description and Zod parameter validation
- **FR-020**: System MUST include CRO system prompt with expertise and completion criteria
- **FR-021**: System MUST parse LLM output with Zod schema validation
- **FR-022**: System MUST implement retry logic for empty/invalid LLM responses
- **FR-023**: System MUST force completion after 3 consecutive tool failures
- **FR-024**: System SHOULD wait between actions (configurable, default 500ms)
- **FR-025**: System MUST provide 6 CRO analysis tools minimum (cta, form, trust, value-prop, navigation, friction)
- **FR-026**: System MUST implement heuristic engine with 10 initial rules
- **FR-027**: System SHOULD detect business type (ecommerce, saas, banking, insurance, travel, media)
- **FR-028**: System MUST generate hypotheses from high/critical severity insights
- **FR-029**: System MUST generate markdown reports with all required sections
- **FR-030**: System MUST support CLI flags: --max-steps, --output-format, --output-file

### Configuration Requirements (CRO Agent)

- **CR-010**: Max steps MUST default to 10, configurable via CLI
- **CR-011**: Action wait time MUST default to 500ms
- **CR-012**: LLM timeout MUST be 60 seconds per call
- **CR-013**: Token budget warning MUST trigger at 60% utilization
- **CR-014**: Consecutive failure limit MUST be 3
- **CR-015**: Element text truncation MUST be 100 characters max
- **CR-016**: Tool validation MUST use Zod safeParse (not parse) for graceful error handling
- **CR-017**: Tool execution MUST track executionTimeMs for performance monitoring

### Tool System Requirements

- **FR-031**: System MUST provide Tool interface with name, description, parameters (Zod schema), and execute method
- **FR-032**: System MUST provide ToolRegistry for registering and retrieving tools by CROActionName
- **FR-033**: System MUST provide ToolExecutor that validates params, executes tools, and handles errors
- **FR-034**: ToolExecutor MUST return ToolResult.success=false with error message for unknown tools
- **FR-035**: ToolExecutor MUST return ToolResult.success=false with Zod error for invalid params
- **FR-036**: ToolExecutor MUST inject ToolContext (page, state, logger) into tool.execute()
- **FR-037**: ToolRegistry MUST provide getToolDefinitions() returning LLM-friendly format (name + description only)
- **FR-038**: Tool execution MUST be logged with tool name, params, success status, and duration

### Agent Core Requirements (Phase 16)

- **FR-039**: PromptBuilder MUST construct system prompt with 6 sections (identity, expertise, input_format, output_format, available_tools, completion_criteria)
- **FR-040**: PromptBuilder MUST inject tool definitions dynamically from ToolRegistry
- **FR-041**: MessageManager MUST maintain conversation history with SystemMessage, HumanMessage, AIMessage types
- **FR-042**: MessageManager MUST provide trimToLimit() for token management
- **FR-043**: StateManager MUST track step count, consecutive failures, total failures, insights, and done status
- **FR-044**: StateManager MUST provide shouldTerminate() checking maxSteps, failureLimit, and isDone
- **FR-045**: StateManager MUST provide getTerminationReason() for analysis result
- **FR-046**: CROAgent MUST implement observe→reason→act loop pattern
- **FR-047**: CROAgent MUST re-extract DOM after scroll or navigation actions
- **FR-048**: CROAgent MUST return CROAnalysisResult with url, success, insights, stepsExecuted, totalTimeMs, terminationReason, errors

### Success Criteria (CRO Agent)

- **SC-008**: DOM extraction captures >90% visible interactive elements on test pages
- **SC-009**: Agent completes analysis of test page in <15 steps
- **SC-010**: Structured LLM output validates 100% against Zod schema
- **SC-011**: Tool execution logged with input/output for debugging
- **SC-012**: 10 heuristic rules fire correctly on test pages
- **SC-013**: Business type detected correctly on 80%+ of test sites
- **SC-014**: Hypotheses generated for all high/critical severity issues
- **SC-015**: Markdown report includes all required sections (Summary, Critical, High, Medium, Low, Tests)
- **SC-016**: Tool system passes 18+ unit tests covering registry, executor, and validation
- **SC-017**: Unknown tool execution returns error within 1ms (no timeout)
- **SC-018**: Invalid params return Zod error message with field path

### Success Criteria (Agent Core - Phase 16)

- **SC-019**: PromptBuilder passes 10 unit tests covering all 6 prompt sections
- **SC-020**: MessageManager passes 12 unit tests covering message ordering and trimming
- **SC-021**: StateManager passes 18 unit tests covering state transitions and termination
- **SC-022**: CROAgent integration tests pass with mock LLM (15 tests)
- **SC-023**: CROAgent E2E test completes on example.com within 60 seconds
- **SC-024**: Agent correctly terminates on done action, max steps, or 3 consecutive failures
- **SC-025**: CROAnalysisResult contains all required fields with accurate values
- **SC-026**: Phase 16 adds 63+ tests (40 unit + 15 integration + 8 e2e)

### CRO Tools Requirements (Phase 17)

**Navigation Tools** (return `insights: []`):
- **FR-049**: System MUST provide `scroll_page` tool with direction (up/down/top/bottom) and amount parameters
- **FR-050**: System MUST provide `click` tool that locates elements by index, returns error for invalid/hidden elements
- **FR-051**: System MUST provide `go_to_url` tool with URL validation, waitUntil options, and load time tracking

**Analysis Tools** (return `CROInsight[]`):
- **FR-052**: System MUST provide `analyze_forms` tool detecting: field overload (>5), missing labels, missing input types, no submit button (6 insight types)
- **FR-053**: System MUST provide `detect_trust_signals` tool checking: presence above fold, reviews, security badges, guarantees, certifications (5 insight types)
- **FR-054**: System MUST provide `assess_value_prop` tool checking: H1 presence/count, generic headlines, headline length, subheadlines (5 insight types)
- **FR-055**: System MUST provide `check_navigation` tool detecting: main nav, breadcrumbs, search, nav depth, home link (5 insight types)
- **FR-056**: System MUST provide `find_friction` tool for quick cross-category friction detection with category filtering (5 insight types)

**Control Tools**:
- **FR-057**: System MUST provide `record_insight` tool for LLM to manually record observations with type, severity, issue, recommendation, category
- **FR-058**: System MUST provide `done` tool that captures analysis summary, optional confidence score, and areas analyzed

**Tool System**:
- **FR-059**: Navigation tools (scroll, click, go_to_url) MUST return empty insights array
- **FR-060**: Analysis tools MUST return CROInsight[] with consistent schema (id, type, severity, element, issue, recommendation, category)
- **FR-061**: All tools MUST validate parameters using Zod schemas before execution
- **FR-062**: All tools MUST define error handling behavior (return error, not throw)
- **FR-063**: createCRORegistry() MUST register all 11 tools declared in CROActionNames

### Success Criteria (CRO Tools - Phase 17)

**Navigation Tools**:
- **SC-027**: scroll-tool passes 6 unit tests (directions, boundaries, invalid params)
- **SC-028**: click-tool passes 7 unit tests (valid/invalid index, hidden element, navigation wait)
- **SC-029**: go-to-url-tool passes 5 unit tests (URL validation, timing, waitUntil)

**Analysis Tools**:
- **SC-030**: analyze-forms passes 12 unit tests (field count, labels, types, submit, empty page)
- **SC-031**: analyze-trust passes 10 unit tests (badges, reviews, guarantees, certifications, placement)
- **SC-032**: analyze-value-prop passes 10 unit tests (H1 count, generic text, length, subheadline)
- **SC-033**: check-navigation passes 8 unit tests (nav, breadcrumbs, search, depth)
- **SC-034**: find-friction passes 6 unit tests (categories, scoring, filtering)

**Control Tools**:
- **SC-035**: record-insight passes 5 unit tests (valid params, severity, category defaults)
- **SC-036**: done-tool passes 4 unit tests (summary, confidence, areasAnalyzed)

**Integration**:
- **SC-037**: Integration tests pass 18 tests (tool chaining, executor, registry, schema validation)
- **SC-038**: createCRORegistry() returns registry with all 11 tools registered
- **SC-039**: All CROActionNames have corresponding tool implementation
- **SC-040**: Phase 17 adds 91 tests total (73 unit + 18 integration)

---

### Heuristics & Post-Processing Requirements (Phase 18)

**Models**:
- **FR-064**: System MUST define BusinessType enum (ecommerce, saas, banking, insurance, travel, media, other)
- **FR-065**: System MUST define Hypothesis interface with id, title, hypothesis statement, control, treatment, metric, expectedImpact, priority, relatedInsights
- **FR-066**: System MUST provide HypothesisSchema (Zod) for validation

**Heuristic Engine**:
- **FR-067**: System MUST provide HeuristicRule interface with id, name, description, check function, applicable business types
- **FR-068**: System MUST provide HeuristicEngine class that registers rules and executes all against PageState
- **FR-069**: System MUST implement exactly 10 heuristic rules (H001-H010) covering CTA, form, trust, value prop, navigation
- **FR-070**: System MUST provide BusinessTypeDetector that analyzes page signals (URL patterns, element presence, keywords)
- **FR-071**: System MUST provide SeverityScorer that adjusts insight severity based on business type context

**Heuristic Rules (10 Required)**:
- **FR-072**: H001 (vague_cta_text): Flag CTAs with generic text (Learn More, Click Here, Submit) - severity: medium
- **FR-073**: H002 (no_cta_above_fold): Flag pages with no CTA visible in initial viewport - severity: high
- **FR-074**: H003 (form_field_overload): Flag forms with >5 visible fields - severity: high
- **FR-075**: H004 (missing_field_label): Flag inputs without associated label or placeholder - severity: medium
- **FR-076**: H005 (no_trust_above_fold): Flag pages with no trust signals in initial viewport - severity: medium
- **FR-077**: H006 (no_security_badge): Flag checkout/payment pages without security badges - severity: high
- **FR-078**: H007 (unclear_value_prop): Flag pages with missing or generic H1 headline - severity: high
- **FR-079**: H008 (headline_too_long): Flag H1 headlines with >10 words - severity: low
- **FR-080**: H009 (no_breadcrumbs): Flag category/product pages without breadcrumb navigation - severity: low
- **FR-081**: H010 (no_search_ecommerce): Flag ecommerce sites without visible search functionality - severity: medium

**Output Generation**:
- **FR-082**: System MUST provide HypothesisGenerator that creates A/B test specs from high/critical insights
- **FR-083**: Hypothesis format MUST follow: "If {recommendation}, then {metric} will improve because {issue}"
- **FR-084**: System MUST provide InsightDeduplicator that removes duplicate insights (same type + element)
- **FR-085**: System MUST provide InsightPrioritizer that sorts insights by severity and business relevance
- **FR-086**: System MUST provide MarkdownReporter generating reports with sections: Executive Summary, Critical Issues, High Priority, Medium Priority, Low Priority, Recommended Tests
- **FR-087**: System MUST provide JSONExporter outputting structured CROAnalysisResult with all fields

**Agent Integration**:
- **FR-088**: CROAgent MUST run HeuristicEngine after agent loop completes (post-processing)
- **FR-089**: CROAgent MUST detect business type before applying business-specific heuristics
- **FR-090**: CROAgent MUST generate hypotheses from combined tool + heuristic insights
- **FR-091**: CROAnalysisResult MUST include: businessType, hypotheses[], heuristicInsights[], scores object
- **FR-092**: Scores object MUST include: overall (0-100), byCategory, criticalCount, highCount, mediumCount, lowCount

**CLI Integration**:
- **FR-093**: CLI MUST make --analyze the default mode (no flag required for CRO analysis)
- **FR-094**: CLI MUST support --output-format with values: console (default), markdown, json
- **FR-095**: CLI MUST support --output-file <path> for writing reports to disk
- **FR-096**: CLI MUST support --legacy flag to use original heading extraction mode
- **FR-097**: FileWriter MUST handle missing directories, existing files, and write errors gracefully

### Configuration Requirements (Phase 18)

- **CR-018**: Heuristic rules MUST be individually toggleable via configuration
- **CR-019**: Business type detection confidence threshold MUST default to 0.6
- **CR-020**: Hypothesis generation MUST require minimum severity of 'high' by default
- **CR-021**: Report sections MUST be configurable (include/exclude specific sections)

### Success Criteria (Phase 18)

**Models & Types**:
- **SC-041**: BusinessType and Hypothesis models compile and export correctly
- **SC-042**: HypothesisSchema validates correct structures and rejects invalid ones

**Heuristic Engine**:
- **SC-043**: HeuristicEngine registers and executes all 10 rules
- **SC-044**: Each heuristic rule has 2 unit tests (positive case, negative case) - 20 tests total
- **SC-045**: BusinessTypeDetector correctly identifies business type on 80%+ of test URLs (FR-027, SC-013)
- **SC-046**: SeverityScorer adjusts severity correctly based on business type context

**Output Generation**:
- **SC-047**: HypothesisGenerator creates valid hypotheses for all high/critical insights (SC-014)
- **SC-048**: InsightDeduplicator removes exact duplicates, keeps unique insights
- **SC-049**: MarkdownReporter generates reports with all 6 required sections (SC-015)
- **SC-050**: JSONExporter outputs valid JSON matching CROAnalysisResult schema

**Integration**:
- **SC-051**: Post-processing pipeline (heuristics → detect type → score → hypotheses → report) executes in sequence
- **SC-052**: CROAnalysisResult includes all Phase 18 fields (businessType, hypotheses, scores)
- **SC-053**: Integration tests verify full pipeline with mock page state (12 tests)

**CLI**:
- **SC-054**: `npm run start -- <url>` runs full CRO analysis (default mode)
- **SC-055**: `--output-format markdown --output-file report.md` writes valid markdown file
- **SC-056**: `--output-format json` outputs parseable JSON to stdout or file
- **SC-057**: `--legacy` flag runs original heading extraction workflow

**Test Totals**:
- **SC-058**: Phase 18 adds 88 tests (70 unit + 18 integration)
- **SC-059**: E2E test completes full workflow on real URL with report generation

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

### Coverage System Requirements (Phase 19)

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
