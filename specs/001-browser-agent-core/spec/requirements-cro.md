# Requirements: CRO Agent (Phases 13-18)

**Navigation**: [Index](./index.md) | [Foundation Requirements](./requirements-foundation.md) | [Phase 19-20 Requirements](./requirements-phase19-20.md)

---

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

---

## Tool System Requirements

- **FR-031**: System MUST provide Tool interface with name, description, parameters (Zod schema), and execute method
- **FR-032**: System MUST provide ToolRegistry for registering and retrieving tools by CROActionName
- **FR-033**: System MUST provide ToolExecutor that validates params, executes tools, and handles errors
- **FR-034**: ToolExecutor MUST return ToolResult.success=false with error message for unknown tools
- **FR-035**: ToolExecutor MUST return ToolResult.success=false with Zod error for invalid params
- **FR-036**: ToolExecutor MUST inject ToolContext (page, state, logger) into tool.execute()
- **FR-037**: ToolRegistry MUST provide getToolDefinitions() returning LLM-friendly format (name + description only)
- **FR-038**: Tool execution MUST be logged with tool name, params, success status, and duration

---

## Agent Core Requirements (Phase 16)

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

---

## CRO Tools Requirements (Phase 17)

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

---

## Heuristics & Post-Processing Requirements (Phase 18)

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

---

## Success Criteria (CRO Agent)

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
