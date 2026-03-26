<!--
================================================================================
SYNC IMPACT REPORT
================================================================================
Version change: 1.0.0 → 2.0.0 (MAJOR - Comprehensive rewrite reflecting
current architecture, production readiness requirements, and CRO domain)

Modified principles:
- I. Code Quality & Maintainability → I. Code Quality & Maintainability (revised)
- II. TypeScript First → II. TypeScript Strict Mode (refined)
- III. Playwright for Browser Automation → III. Perception Layer (expanded)
- IV. Error Handling & Logging → IV. Error Handling & Resilience (expanded)
- V. Async/Await Patterns → V. LLM Integration Discipline (replaced)
- VI. Context Efficiency → VI. Cost & Performance Optimization (replaced)
- VII. Modular Design → VII. Modular Architecture (revised)
- VIII. Documentation Standards → VIII. Testing Discipline (replaced)

Added sections:
- IX. Security & Data Handling (new principle)
- X. Production Readiness (new principle)
- Technology Standards updated with actual dependencies
- Development Workflow updated with CI/CD requirements

Removed sections:
- Context Efficiency (LLM agent session concern, not codebase principle)
- Documentation Standards (folded into Code Quality as sub-rule)

Templates requiring updates:
- .specify/templates/plan-template.md ✅ (Constitution Check compatible)
- .specify/templates/spec-template.md ✅ (Requirements section compatible)
- .specify/templates/tasks-template.md ✅ (Phase structure compatible)
- .specify/templates/checklist-template.md ✅ (No constitution references)
- .specify/templates/agent-file-template.md ✅ (No constitution references)

Follow-up TODOs: None
================================================================================
-->

# Browser Agent Constitution

## Core Principles

### I. Code Quality & Maintainability

All code MUST prioritize readability, maintainability, and long-term
sustainability. No single file MUST exceed 500 lines; files approaching
this limit MUST be decomposed into focused modules.

- Functions MUST have a single responsibility
- Public APIs MUST have JSDoc comments with parameter and return types
- Non-obvious logic MUST have inline comments explaining the "why"
- Code duplication MUST be eliminated through shared utilities
- Console output for user-facing progress MUST be isolated in dedicated
  reporter/formatter classes, not mixed with business logic
- `console.log` MUST NOT appear in business logic files; use the
  structured logger (`createLogger`) for internal logging
- Dead code (unused fields, deprecated shims, unreachable paths) MUST
  be removed, not commented out

**Rationale**: The codebase has grown to 100+ source files across 19
modules. Strict size limits and separation of concerns prevent god-class
accumulation and keep files reviewable.

### II. TypeScript Strict Mode

All implementation MUST use TypeScript with strict mode enabled.

- `strict: true` MUST be set in tsconfig.json
- All functions MUST have explicit return types
- `any` type is PROHIBITED (`@typescript-eslint/no-explicit-any: error`)
- Interfaces MUST define contracts between modules
- Zod schemas MUST validate all external input boundaries (CLI args,
  LLM responses, API payloads)
- Barrel exports (`index.ts`) MUST exist in every module directory

**Rationale**: Type safety prevents runtime errors and makes refactoring
safe across 100+ files. Zod provides runtime validation where TypeScript
compile-time checks cannot reach.

### III. Perception Layer

The perception layer (data collection) MUST capture DOM, screenshots,
accessibility tree, and structured data without LLM calls by default.

- Collection MUST be deterministic (scroll + capture loop, zero LLM
  calls) unless user explicitly opts into `--llm-guided-collection`
- Each viewport capture MUST produce a `ViewportSnapshot` containing:
  screenshot (compressed), DOM (serialized with token budget),
  element positions (coordinate-mapped), and accessibility tree
- Page type detection MUST use three-tier hybrid approach: Playwright
  DOM signals (primary) → URL/selector heuristics → LLM fallback
- Cookie consent MUST be auto-dismissed before capture begins
- UI noise (sticky headers, chat widgets) MUST be suppressed before
  screenshot capture
- Media readiness MUST be verified before capture (lazy-load, images)
- Full-page coverage MUST be tracked; `full_page` mode requires 100%
  segment coverage before analysis proceeds
- Collection quality MUST be validated via cheap validator; LLM QA
  MUST only be invoked when signals indicate issues

**Rationale**: Deterministic collection is cheaper, faster, and
reproducible. The three-tier page detection avoids expensive LLM calls
for 90% of pages. Quality validation prevents garbage-in analysis.

### IV. Error Handling & Resilience

All operations MUST implement structured error handling with graceful
degradation.

- All async operations MUST have try-catch with specific error context
- Structured logging (JSON format via `createLogger`) MUST be used
- Log levels MUST be used appropriately: error, warn, info, debug
- Sensitive data (API keys, user content) MUST NEVER appear in logs
- LLM analysis MUST use per-category error isolation: one category
  failure MUST NOT block other categories
- Browser resources MUST be cleaned up in `finally` blocks (page →
  context → browser, with null-after-close)
- CLI MUST handle SIGINT/SIGTERM with graceful shutdown (close browser,
  flush evidence files, then exit)
- `process.exit()` MUST NOT be called without prior resource cleanup
- Custom error types MUST be used for distinct failure modes (API rate
  limit, browser timeout, LLM parse error) to enable programmatic
  handling

**Rationale**: Browser automation is inherently fragile. Per-category
error isolation prevents a single LLM timeout from losing an entire
analysis run. Graceful shutdown prevents orphaned browser processes.

### V. LLM Integration Discipline

All LLM interactions MUST be cost-aware, rate-limited, and structured.

- Model defaults MUST be centralized in `MODEL_DEFAULTS` (single
  source of truth for model names, not hardcoded across files)
- Default model MUST be gpt-4o-mini (cost-optimized); gpt-4o available
  via `--vision-model gpt-4o` flag
- LLM prompts MUST include: identity/task definition, output JSON
  schema, few-shot examples (minimum 3), enforcement rules
- LLM responses MUST be parsed with JSON extraction + normalization
  (status strings, confidence bounds clamping)
- Element position context (`<element_positions>` block) MUST be
  included in prompts for spatial heuristics
- Structured element refs (`elementRefs[]` in JSON schema) MUST be
  requested; text-scan fallback for backward compatibility
- Rate limiting with exponential backoff MUST be implemented for all
  LLM API calls to stay within TPM limits
- Parallel analysis MUST use `p-limit` for concurrency control
  (default: 5 concurrent categories)

**Rationale**: LLM calls are the primary cost driver (~$0.005-0.01/page
with mini). Centralized config prevents model sprawl. Structured prompts
with examples dramatically improve output quality and parseability.

### VI. Cost & Performance Optimization

All features MUST be evaluated for token cost and execution time impact.
New features that increase cost MUST be opt-in by default.

- Parallel analysis MUST be the default (3-4x speedup)
- Features that degrade quality in live testing MUST be opt-in, not
  default (e.g., category batching, viewport filtering)
- Screenshot compression MUST reduce images before LLM consumption
  (384px wide, JPEG quality 50)
- DOM serialization MUST enforce token budgets (default: 2000 tokens)
- Domain pattern cache MUST be used for batch processing to avoid
  redundant page type detection
- Dynamic collection steps MUST be calculated from page dimensions
  (no over-collecting short pages, no under-collecting long pages)
- Quality validation (`--validate-quality`) MUST compare optimized
  vs baseline analysis using ≥80% effective match rate threshold

**Rationale**: The tool processes pages at ~$0.005-0.01 each. Without
cost discipline, batching or new features can easily 10x costs. Opt-in
for quality-degrading features protects users who prioritize accuracy.

### VII. Modular Architecture

Code MUST be organized into focused modules with barrel exports and
clear dependency direction.

- Each `src/` subdirectory MUST have an `index.ts` barrel export
- Modules MUST have single, well-defined responsibility
- Circular dependencies are PROHIBITED
- The CROAgent orchestrator MUST delegate to phase-specific modules
  (collection, analysis, post-processing) rather than implementing
  inline
- Knowledge bases MUST be JSON files per category with a loader
  aggregator pattern (e.g., `knowledge/pdp/`, `knowledge/plp/`)
- Heuristic ID format MUST follow `{PAGETYPE}-{ABBREV}-{NNN}`
  (e.g., `PDP-CTA-001`, `PLP-GRID-001`)
- Deprecated API options MUST be removed after one major version;
  `@deprecated` JSDoc MUST include removal timeline
- **Speckit artifact paths**: ALL specification, plan, and task files
  MUST reside under `specs/{feature-name}/` (e.g.,
  `specs/001-browser-agent-core/`). Split structure uses `spec/`,
  `plan/`, `tasks/` subdirectories within the feature folder.
  Artifacts MUST NEVER be created in `specs/main/`, `docs/`, or any
  other location outside the feature directory. Running speckit
  commands on the `main` branch requires `SPECIFY_FEATURE` env var
  to be set to the target feature name.

**Rationale**: 19 modules with 100+ files require strict boundaries.
Barrel exports create clean public APIs. Knowledge base patterns enable
adding new page types (Homepage, Cart, Checkout) without touching core
analysis code.

### VIII. Testing Discipline

All features MUST have tests. Test failures MUST be fixed immediately,
not accumulated as "known failures."

- Unit tests MUST cover all public module APIs
- Integration tests MUST verify cross-module interactions with mocked
  external services (OpenAI, Playwright)
- E2E tests MUST be gated behind `RUN_E2E_TESTS` environment variable
- Coverage thresholds MUST be enforced in vitest.config.ts (minimum:
  lines 70%, functions 70%, branches 60%)
- Mock patterns: `vi.hoisted()` for mock factories, `function` keyword
  (not arrow) for ChatOpenAI constructor compatibility
- Test helpers (mock factories like `createMockSnapshot()`,
  `createMockDOMTree()`) MUST be shared from `tests/helpers/`
- Tests importing deleted modules MUST be removed or updated
  immediately during the same PR that deletes the module
- Snapshot tests MUST be used for LLM prompt format verification

**Rationale**: The project has 81 test files and 1250 tests. Broken
tests erode confidence and mask real regressions. Shared test helpers
eliminate 50+ duplicated factory functions across test files.

### IX. Security & Data Handling

All secrets, user data, and evidence output MUST be handled securely.

- API keys MUST NEVER be committed to version control; `.env` MUST
  be in `.gitignore` and a `.env.example` template MUST exist
- If a key is accidentally committed, it MUST be rotated immediately
  and scrubbed from git history
- Evidence output directories (screenshots, DOM snapshots, LLM inputs)
  MUST be created with restrictive permissions (0o700 on Unix)
- URL validation MUST whitelist protocols (http/https only)
- User-provided file paths (`--evidence-dir`, `--output-file`) MUST
  be sanitized against path traversal
- No `eval()`, `Function()`, or dynamic code execution from external
  input

**Rationale**: The tool captures sensitive page content (screenshots,
DOM with form fields, product data). Evidence directories contain
data that could be valuable to attackers.

### X. Production Readiness

The tool MUST be deployable and maintainable as a production CLI tool.

- CLI argument parsing MUST use a framework (commander, yargs) with
  auto-generated `--help`, type coercion, and validation
- CI/CD pipeline MUST run on every PR: lint → typecheck → test:unit →
  test:integration
- Graceful shutdown handlers (SIGINT, SIGTERM) MUST be registered at
  CLI entry point
- All magic values (model names, timeouts, viewport dimensions, sleep
  durations) MUST be centralized in config constants
- `npm run build` MUST produce zero errors
- `npm run lint` MUST produce zero warnings
- `npm run typecheck` MUST produce zero errors

**Rationale**: A CLI tool used for production CRO analysis must be
reliable, self-documenting (--help), and safe to interrupt. CI prevents
regressions from reaching users.

## Technology Standards

**Runtime**: Node.js 20+ (LTS)
**Language**: TypeScript 5.x with strict mode
**Browser Automation**: Playwright (Chromium, 1280x720 viewport)
**AI Orchestration**: LangChain + OpenAI (gpt-4o-mini default)
**Schema Validation**: Zod (runtime), TypeScript (compile-time)
**Image Processing**: sharp (screenshot compression, annotation)
**Concurrency**: p-limit (parallel LLM category analysis)
**Testing**: Vitest (unit, integration, E2E)
**Linting**: ESLint with TypeScript plugin
**Formatting**: Prettier

### Required Dependencies

- `playwright` - Browser automation and page interaction
- `@langchain/openai` - LLM orchestration via ChatOpenAI
- `langchain` - AI framework utilities
- `zod` - Runtime schema validation
- `sharp` - Image processing (resize, annotate, compress)
- `p-limit` - Concurrency control for parallel analysis
- `dotenv` - Environment variable loading
- `typescript` - Type safety (dev)
- `vitest` - Testing framework (dev)

### Architecture Patterns

- Three-phase pipeline: Collection → Analysis → Output
- Category-based LLM analysis with per-category error isolation
- Knowledge base pattern: JSON heuristics per page type per category
- Barrel export pattern: `index.ts` in every module
- Deterministic collection with optional LLM-guided fallback

## Development Workflow

### Code Review Requirements

- All changes MUST be reviewed before merging
- Reviews MUST verify constitution compliance
- Type safety violations MUST block merge
- Test coverage MUST be maintained or improved
- Tests importing deleted/renamed modules MUST be fixed in same PR

### Testing Gates

- Unit tests MUST pass before merge
- Integration tests MUST pass before merge
- Type checking MUST pass with zero errors
- Linting MUST pass with zero warnings
- Coverage thresholds MUST be met (lines 70%, functions 70%)

### CI/CD Pipeline

- GitHub Actions MUST run on every PR:
  1. `npm run lint`
  2. `npm run typecheck`
  3. `npm run test:unit`
  4. `npm run test:integration`
- E2E tests run only when `RUN_E2E_TESTS=true` (requires API key)
- Merge MUST be blocked on any CI failure

### Commit Standards

- Commits MUST follow conventional commit format
- Commits MUST be atomic and focused
- Commit messages MUST explain the "why"
- Secrets MUST NEVER be committed (pre-commit hook recommended)

## Governance

This constitution establishes the foundational principles and standards
for the Browser Agent CRO auditor. All development MUST comply with
these principles.

### Amendment Procedure

1. Proposed amendments MUST be documented with rationale
2. Amendments MUST be reviewed by project stakeholders
3. Approved amendments MUST include a migration plan for existing code
4. Version MUST be incremented according to semantic versioning:
   - MAJOR: Principle removals or incompatible governance changes
   - MINOR: New principles or materially expanded guidance
   - PATCH: Clarifications, wording, and refinements

### Compliance Review

- All PRs MUST verify compliance with constitution principles
- Violations MUST be documented in the Complexity Tracking section
  of implementation plans
- Justified exceptions MUST be explicitly approved and documented

**Version**: 2.0.0 | **Ratified**: 2025-01-23 | **Last Amended**: 2026-03-23
