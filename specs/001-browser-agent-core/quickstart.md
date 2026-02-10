# Quickstart: Browser Agent Core

**Feature**: `001-browser-agent-core`
**Last Updated**: 2026-02-05 (Phase 25i complete)

---

## New Session Prompt (Copy-Paste This)

```
Read specs/001-browser-agent-core/quickstart.md to get the complete project context.
```

---

## Session Bootstrap (READ THIS FIRST)

**Status**: CR-001 ✅ | Phase 21h ✅ | Phase 21i ✅ | Phase 21j ✅ | Phase 21l ✅ | Phase 23 ✅ | Phase 24 ✅ | Phase 25 ✅ | Phase 26 📋
- Completed: 487 tasks (Phases 1-19, 12b, 12c, 21a-21l, CR-001, Phases 23-25f)
- **CR-001 COMPLETE** (2026-01-30):
  - ✅ Merged Vision Agent into CRO Agent (single agent loop)
  - ✅ Removed redundant vision modes (--full-page-vision, --full-page-screenshot)
  - ✅ Only `--vision` remains as the ONE vision mode (simplified API)
  - ✅ Analysis happens AFTER data collection (category-based LLM calls)
  - ✅ CR-001-D: Consolidated to single `vision: true` API flag
  - Phase 20 (60 tasks) deferred to backlog
- **Phase 23 COMPLETE** (2026-02-03):
  - ✅ T400-T408: LLM Input Capture for debugging/auditing
  - ✅ Saves DOM, screenshots, prompts to `./llm-inputs/{timestamp}/`
  - ✅ 18 new tests (13 unit + 5 integration)
- **Phase 21j COMPLETE** (2026-02-03): CLI Vision Agent Fix
  - ✅ T383-T388: Core implementation complete
  - ✅ T389-T390: Integration tests (17 tests in cli-vision-agent.test.ts)
- **Phase 21l COMPLETE** (2026-02-03): Default Evidence & Mapping
  - ✅ T391-T397: Defaults changed, opt-out flags added
  - ✅ T398-T399: Tests (27 tests - 15 unit + 12 integration)

**Current Focus**:
- Phase 24: Hybrid LLM Page Type Detection (23 tasks) ✅ **COMPLETE** - All 55 tests passing (39 unit + 9 integration + 7 E2E)
- **Phase 25: Enhanced Extraction (76 tasks) ✅ COMPLETE** - Dynamic steps, selectors, structured data, fold annotation, tiled screenshots, deterministic collection, evidence mapping, hybrid collection
- **Phase 26: LLM Analysis Optimization (28 tasks) 📋 PLANNED** - Parallel analysis, category batching, viewport filtering, CI-only quality validation
- Phase 22: New Page Type Knowledge Bases (~38 tasks) 📋 Planned - PLP, Homepage, Cart, Checkout

**Phase 25 Progress** (2026-02-04) ✅ **COMPLETE**:
- ✅ **25a** T473-T476: Dynamic collection steps (based on page height) - 14 unit tests
- ✅ **25b** T477-T484: Enhanced DOM selectors (price, variant, stock, shipping, gallery) - 41 unit tests
- ✅ **25c** T485-T488: Structured data extraction (JSON-LD Product schema) - 17 unit tests
- ✅ **25d** T489-T492: Above-fold annotation (fold line on screenshots) - 22 unit tests
- ✅ **25e** T493-T498: Tiled screenshot mode (alternative to viewport capture) - 9 integration tests
- ✅ **25f** T499-T502: Deterministic collection (no LLM during collection) - 10 int + 11 E2E tests
- ✅ **25g** T503-T520: Evidence mapping + packaging (47 tests)
- ✅ **25h** T521-T534: Determinism + noise suppression + lazy-load + metrics (40 tests)
- ✅ **25i** T535-T548: Hybrid collection (cheap validator + LLM QA) - 34 unit tests
- See: `spec/requirements-phase25.md`, `plan/phase-25.md`, `tasks/phase-25.md`

**Phase 26 Progress** (2026-02-10) 📋 **PLANNED (Revised)**:
- 📋 **26a** T550-T555: Parallel category analysis (p-limit, rate limiting, error isolation) - 6 unit tests
- 📋 **26b** T556-T563: Batch multiple categories per call (56% token savings) - 4+4 unit + 1 int tests
- 📋 **26c** T564-T568: Intelligent viewport filtering (15-30% additional savings) - 6 unit + 1 int tests
- 📋 **26e** T569-T574: Quality validation CI-only (comparator, classifier, validator) - 1 int test
- 📋 **26f** T575-T577: Cross-cutting E2E tests - 4 E2E tests
- ~~26d: Response token optimization~~ - DROPPED (only 1.5% savings)
- ~~Runtime auto-rollback~~ - DROPPED (over-engineered; CI-only validation instead)
- **Target**: 10x faster (336s → 35s), 56% cheaper ($0.20 → $0.09 per page)
- **Quality Guarantee**: ≥95% match rate vs baseline (CI validation)
- **Backward Compatible**: All optimizations opt-out via CLI flags
- See: `spec/requirements-phase26.md`, `plan/phase-26.md`, `tasks/phase-26.md`

**Phase 21l COMPLETE** (user experience):
- ✅ T391-T397: Defaults changed, opt-out flags added, help text updated
- ✅ T398-T399: Unit + integration tests (27 tests)
- See: `tasks/phase-21l.md`

**Phase 23 Priority** (debugging/auditing):
- Save all LLM inputs: DOM snapshots, screenshots, prompts
- Output: `./llm-inputs/{timestamp}/` directory structure
- See: `tasks/phase-23.md`

**Deferred**:
- Phase 20: Hybrid Extraction Pipeline (60 tasks) - moved to backlog

**Progress**:
- Phase 1-12: MVP infrastructure ✅
- **Phase 12b: Enhanced Cookie Detection** ✅ (Shopify/Alpine.js banners)
- **Phase 12c: Peregrine Cookie Banner Fix** ✅ (two-step dismiss: Accept + Close)
- Phase 13a-13b: Data models ✅
- Phase 14: DOM extraction ✅
- Phase 14b: CLI `--cro-extract` flag ✅
- Phase 15: Tool system ✅
- Phase 15b: CLI `--tool <name>` flag ✅
- Phase 16: Agent core ✅
- Phase 16-CLI: `--analyze` flag ✅
- Phase 17a: Navigation tools (scroll, click, go_to_url) ✅
- Phase 17b: Analysis tools (forms, trust, value_prop, navigation, friction) ✅
- Phase 17c: Control tools (record_insight, done) + Integration ✅
- Phase 18a: Models & Types (BusinessType, Hypothesis) ✅
- Phase 18b: Heuristic Engine Core (26 tests) ✅
- Phase 18c: 10 Heuristic Rules (H001-H010, 22 tests) ✅
- Phase 18d: Output Generation (21 tests) ✅
- Phase 18e: Agent Integration (21 tests) ✅
- Phase 18f: Test Fixtures (5 HTML + expected-results.json) ✅
- Phase 18-CLI: Final CLI Integration ✅ (default CRO mode, report output)
- Phase 19a: Coverage Tracking ✅ (CoverageTracker class, 16 tests)
- Phase 19b: DOM Changes ✅ (DOMMerger, absolute coords, dynamic tokens, 7 tests)
- Phase 19c: Agent Integration ✅ (full-page scan loop, coverage enforcement)
- Phase 19d: Prompt Updates ✅ (coverage awareness in system prompt)
- Phase 19e: CLI & Config ✅ (--scan-mode, --min-coverage flags)
- Phase 19f: Testing & Polish ✅ (11 integration + 4 E2E tests)
- **Phase 20: Hybrid Extraction Pipeline** 📋 (60 tasks, 108 tests planned)
- **Phase 21a: PageType Detection Foundation** ✅ (8 tasks, 20+ tests)
- **Phase 21b-d: PDP Heuristic Rules** 📋 (42 tasks, 70+ tests planned)

**Architecture**:

*Module Definition*: A module is a distinct `src/` subdirectory with an `index.ts` barrel export.

| Module | Path | Files | Purpose |
|--------|------|-------|---------|
| agent | `src/agent/` | 8+ | CRO Agent core (state, messages, prompts) |
| ~~agent/vision~~ | ~~`src/agent/vision/`~~ | ~~12~~ | ~~Vision Agent~~ (DELETED in CR-001-D) |
| agent/tools | `src/agent/tools/` | 10+ | Agent tool implementations |
| browser | `src/browser/` | 5+ | Playwright browser lifecycle |
| browser/dom | `src/browser/dom/` | 4+ | DOM extraction and serialization |
| detection | `src/detection/` | 2+ | Framework detection utilities |
| heuristics | `src/heuristics/` | 6+ | Heuristic category definitions |
| heuristics/knowledge | `src/heuristics/knowledge/` | 12+ | PDP knowledge base JSONs |
| ~~heuristics/rules~~ | ~~`src/heuristics/rules/`~~ | ~~11+~~ | ~~H001-H010 rules~~ (DELETED in CR-002) |
| heuristics/vision | `src/heuristics/vision/` | 6+ | Vision analyzer components |
| models | `src/models/` | 10+ | Zod schemas and types |
| output | `src/output/` | 6+ | Report generation, JSON export |
| prompts | `src/prompts/` | 3+ | Prompt templates (markdown) |
| types | `src/types/` | 2+ | Shared TypeScript types |
| utils | `src/utils/` | 2+ | Shared utilities |

**Total**: 14 modules with index.ts exports (17 including submodules)

**Key insight**: The unified CRO Agent (CR-001) uses a three-phase approach: (1) Data Collection captures DOM + screenshots across the full page, (2) Analysis runs category-based LLM calls against heuristics knowledge base, (3) Output generates insights, hypotheses, and A/B test ideas. Vision analysis provides UX-level insights. Phase 21i's DOM-Screenshot mapping will enable verification of LLM observations against actual element positions.

**Current milestone**: CR-001 ✅ Complete | Phase 21h 📋 Next - Evidence Capture | Phase 21i 📋 Planned - DOM-Screenshot Mapping

**Instructions**: Keep it concise. Compromise on grammar. Clear, to the point. No fluff.

**Context Window Management** (CRITICAL):
- **Task limit**: 1-5 tasks per session (optimal context usage)
- Monitor context usage throughout session
- Optimal range: 40%-60% utilization
- At 60%: Update SESSION-HANDOFF.md with current progress and request new session
- Never exceed 70%: LLM performance degrades significantly
- Always include handoff details before ending session

**Session Chunking** (see SESSION-HANDOFF.md for full breakdown):
- Phase 26 Sessions (6 recommended):
  - Session 1: T550-T555 (26a: Parallel analysis - config, p-limit, implementation, CLI, tests)
  - Session 2: T556-T559 (26b part 1: Batcher + prompt builder + parser + orchestrator)
  - Session 3: T560-T563 (26b part 2: CLI flag + exports + all batching tests)
  - Session 4: T564-T568 (26c: Viewport filtering - selector, integration, CLI, tests)
  - Session 5: T569-T574 (26e: Quality validation CI-only - comparator, classifier, validator, tests)
  - Session 6: T575-T577 (26f: E2E tests for full optimization stack)

**Excluded folders** (DO NOT analyze unless explicitly requested):
- `browser-use/` - Reference codebase only (545 files), not part of this project

### Spec Kit Structure

```
specs/001-browser-agent-core/
├── spec/                    # Requirements (split from spec.md)
│   ├── index.md             # Overview + navigation
│   ├── user-stories.md      # US1-US14
│   ├── requirements-foundation.md
│   ├── requirements-cro.md
│   ├── requirements-phase19-20.md
│   └── requirements-phase21.md
├── plan/                    # Implementation plan (split from plan.md)
│   ├── index.md             # Overview + navigation
│   ├── overview.md, architecture.md, dependencies.md
│   └── phase-13-15.md ... phase-21.md
├── tasks/                   # Tasks (split from tasks.md)
│   ├── index.md             # Overview + summary
│   └── phases-01-09.md ... phase-21.md
├── quickstart.md            # THIS FILE - start here
├── data-model.md            # TypeScript interfaces
├── SESSION-HANDOFF.md       # Technical deep-dive for handoffs
└── code-walkthrough.md      # Code structure explanation
```

### What to Read (Priority Order)

| Priority | File | Purpose |
|----------|------|---------|
| 1 | `quickstart.md` | Project overview, status, usage (this file) |
| 2 | `tasks/index.md` | Task summary, what's done/pending |
| 3 | `plan/index.md` | Architecture overview |
| 4 | `spec/index.md` | Requirements overview |
| 5 | Phase-specific files | Only when working on specific phase |

### What to Read by Task

| Need | Read |
|------|------|
| Add new feature | spec/index.md → plan/index.md → tasks/index.md (follow Change Workflow) |
| Fix a bug | tasks/index.md (add to current phase, follow Change Workflow) |
| Understand architecture | plan/architecture.md (Module Architecture section) |
| Check requirements | spec/user-stories.md, spec/requirements-*.md |
| See implementation details | tasks/phase-*.md (full task history with checkpoints) |
| Technical deep-dive | SESSION-HANDOFF.md (types, components, architecture) |

### Change Workflow (MUST FOLLOW)

For any feature/bug fix request:

```
1. Update spec/         → Add/modify requirements in appropriate file
2. Update plan/         → Update architecture & design if needed
3. Update tasks/        → Add new tasks in appropriate phase file
4. Update quickstart.md → Sync recent changes section
5. Get user approval    → Present changes, wait for confirmation
6. Implement            → Write code only after approval
7. Run tests            → Verify all tests pass (unit, integration, e2e)
8. Update design/       → Update ALL design diagrams to reflect changes
```

**Important Rules**:
1. **Spec kit is source of truth** - Update BEFORE coding
2. **Never implement without approval** - Present plan first
3. **Use split files** - Don't look for monolithic spec.md/plan.md/tasks.md
4. **Read phase-specific files** - When working on specific phase, read that phase's plan and tasks file
5. **Check tasks/index.md** - For task summary and current status
6. **quickstart.md must always reflect latest spec kit state**
- **CRITICAL**: After implementation, update ALL files in `design/` folder:
  - `APPLICATION_FLOW.md` - ASCII flow diagrams
  - `architecture-overview.svg` - High-level architecture
  - `component-details.svg` - Component classes and methods
  - `configuration-types.svg` - Types, interfaces, config options
  - `data-flow-pipeline.svg` - Data processing stages
  - `sequence-diagram.svg` - Actor interactions and message flow
- Design folder provides complete visual context of the project

### What this app does (Target State)
- Browser automation via Playwright (Chromium)
- Extracts CRO elements: CTAs, forms, trust signals, value props, navigation
- Iterative agent loop: observe → reason → act → repeat
- Generates CRO insights with severity ratings
- Outputs A/B test hypotheses and structured reports

### Key files
| File | Purpose |
|------|---------|
| `src/cli.ts` | CLI entry point |
| `src/index.ts` | Main exports |
| `src/agent/cro-agent.ts` | CRO Agent orchestrator |
| `src/browser/browser-manager.ts` | Playwright lifecycle |
| `src/browser/page-loader.ts` | URL navigation, hybrid wait strategy |
| `src/browser/dom/extractor.ts` | CRO DOM extraction |
| `src/browser/dom/serializer.ts` | DOM to LLM format with token budget |
| `src/models/` | Zod schemas for agent state, insights, output |
| `src/output/agent-progress-formatter.ts` | Console output formatting |
| `src/browser/cookie-handler.ts` | Cookie consent popup dismissal |

### Design documentation
| File | Purpose |
|------|---------|
| `design/APPLICATION_FLOW.md` | ASCII diagrams of application flow |
| `design/architecture-overview.svg` | High-level architecture diagram |
| `design/component-details.svg` | Detailed component breakdown |
| `design/configuration-types.svg` | TypeScript types and config layers |
| `design/data-flow-pipeline.svg` | 6-stage data processing pipeline |
| `design/sequence-diagram.svg` | UML sequence diagram for URL processing |

### Recent Changes (keep last 3)

**0. Phase 26: LLM Analysis Optimization** - 📋 PLANNED (Revised 2026-02-10)
- **Purpose**: Reduce analysis time from 336s to ~35s (10x faster), token usage from 266K to ~113K (56% cheaper)
- **Sub-phases**:
  1. **26a**: Parallel category analysis (p-limit, rate limiting, timeout, error isolation)
  2. **26b**: Batch multiple categories per call (5 calls instead of 10, 56% token savings)
  3. **26c**: Intelligent viewport filtering (send only relevant viewports per category)
  4. **26e**: Quality validation CI-only (comparator, classifier, validator)
  5. **26f**: Cross-cutting E2E tests
- **Dropped**: ~~26d: Response token optimization~~ (1.5% savings), ~~runtime auto-rollback~~ (over-engineered)
- **Quality Guarantee**: CI-only validation compares optimized vs baseline, requires ≥95% match rate
- **Backward Compatible**: All optimizations enabled by default with opt-out flags
- **CLI Flags**: `--sequential-analysis`, `--no-category-batching`, `--no-viewport-filtering`, `--validate-quality`
- **Tasks**: T550-T577 (28 tasks)
- **Tests**: 28 (20 unit + 4 integration + 4 E2E)
- **See**: `spec/requirements-phase26.md`, `plan/phase-26.md`, `tasks/phase-26.md`

**1. Phase 25 Bug Fixes & Enhancements** - ✅ COMPLETE (2026-02-05)
- **Screenshot Size**: Fixed from 384x216 → 1280x720 (added `fullResolutionBase64` field) ✅
- **Scroll Position**: Fixed - now starts at 0px with verification retry logic ✅
- **Fold Line**: Now correctly at 720px on first viewport ✅
- **Element References**: New `[v0-0]`, `[v1-0]` format for viewport-prefixed refs ✅
- **Screenshot Labels**: Evidence screenshots now use `[v0-0]` format matching LLM prompts ✅
- **Reasoning Field**: Added to types, parsing, AND CLI display (T549 ✅)
- **Parsing Utils**: `parseElementRef()`, `extractElementRefs()`, `toNumericIndex()` ✅
- **Files**: `agent-state.ts`, `cro-agent.ts`, `cli.ts`, `coordinate-mapper.ts`, `category-analyzer.ts`, `screenshot-annotator.ts`, `types.ts`, `prompt-builder.ts`, `agent-progress-formatter.ts`

**1. Phase 25: Enhanced Extraction & Screenshot Analysis** - ⏳ IN PROGRESS (2026-02-04)
- **Purpose**: Fix Burberry price false positive, improve extraction accuracy, enable full evidence chain
- **Root Cause**: Price not in DOM, LLM confused about "above the fold", no evidence linking
- **Sub-phases**:
  1. **25a**: Dynamic collection steps (page height based)
  2. **25b**: Enhanced DOM selectors (price, variant, stock, shipping, gallery)
  3. **25c**: Structured data extraction (JSON-LD Product schema)
  4. **25d**: Above-fold annotation (fold line on screenshots)
  5. **25e**: Tiled screenshot mode (alternative capture)
  6. **25f**: Deterministic collection (skip LLM for scrolling)
  7. **25g**: Evidence mapping + confidence + packaging (nodeId, boxes, EvidencePackage)
  8. **25h**: Determinism + noise suppression + lazy-load + metrics
  9. **25i**: Hybrid collection (cheap validator + conditional LLM QA)
- **Pipeline**: DOM Freeze → Noise Suppression → DOM Extract → CRO Match → Structured Data → Deterministic Collection → Cheap Validator → (LLM QA if needed) → Recheck → Reconciliation → Evidence Package
- **Default ON**: All features enabled by default (opt-out flags available)
- **CLI Flags**: `--screenshot-mode`, `--no-evidence-json`, `--skip-collection-qa`, `--llm-guided-collection`
- **Tasks**: T473-T548 (76 tasks)
- **Tests**: 75 (40 unit + 20 integration + 15 E2E)
- **Sessions**: 10 recommended
- **See**: `spec/requirements-phase25.md`, `plan/phase-25.md`, `tasks/phase-25.md`

**1. Phase 24: Hybrid Page Type Detection** - ✅ COMPLETE (2026-02-03)
- **Purpose**: Improve page type detection for edge cases (Burberry, luxury brands, non-standard URLs)
- **Approach**: Three-tier hybrid detection:
  1. **Tier 1 (PRIMARY)**: Playwright-based detection with rich DOM analysis
     - JSON-LD Product schema parsing
     - CTA detection ("Add to Cart", "Buy Now") with visibility checks
     - Variant detection (size/color selectors)
     - Anti-signals (PLP grid, cart, checkout patterns)
  2. **Tier 2**: URL/selector heuristics (existing PageTypeDetector)
  3. **Tier 3 (FALLBACK)**: LLM vision - only ~10% of cases
- **Key Files Created** (Session 1):
  - `src/heuristics/playwright-page-detector.ts` - detectPdp() with JSON-LD, CTA, variants, anti-signals
  - `src/heuristics/domain-pattern-cache.ts` - In-memory cache by domain
  - `src/heuristics/llm-page-type-detector.ts` - LLM fallback (gpt-4o-mini)
  - `src/heuristics/hybrid-page-type-detector.ts` - 3-tier orchestrator
- **CLI flags**: `--no-llm-page-detection`, `--force-llm-detection`, `--llm-detection-threshold <n>` ✅
- **Tasks**: T450-T468, T470-T471 done ✅ | T469 (7 int tests), T472 (4 E2E tests) 📋 TODO
- **Tests**: 39 unit tests done, 11 integration/E2E remaining
- **See**: `spec/requirements-phase24.md`, `plan/phase-24.md`, `tasks/phase-24.md`

**1. Phase 23: LLM Input Capture** - ✅ COMPLETE (2026-02-03)
- **Purpose**: Save all LLM inputs for debugging/auditing
- **Changes**:
  - ✅ Created `LLMInputWriter` class in `src/output/llm-input-writer.ts`
  - ✅ Added `CapturedCategoryInputs` type for capturing inputs per category
  - ✅ `CategoryAnalyzer` captures systemPrompt, userPrompt, screenshots, DOM
  - ✅ `AnalysisOrchestrator` aggregates inputs from all categories
  - ✅ `CROAgent.analyze()` returns `llmInputs` in result
  - ✅ CLI saves to `./llm-inputs/{timestamp}/` when evidence enabled
- **Output Structure**:
  - `DOM-snapshots/viewport-N.json` - Serialized DOM + metadata
  - `Screenshots/viewport-N.png` - Raw screenshots
  - `Prompts/system-prompt.txt` - System prompt (once)
  - `Prompts/viewport-N-prompt.txt` - User prompts
- **Tests**: 18 new tests (13 unit + 5 integration)

**1. Phase 21l: Default Evidence & Mapping** - ⏳ 7/9 (2026-02-03)
- **Purpose**: Make evidence saving + screenshot annotation default behavior
- **Changes**:
  - 📋 `saveEvidence` defaults to `true` (was `false`)
  - 📋 `annotateScreenshots` defaults to `true` (was `false`)
  - 📋 New opt-out flags: `--no-save-evidence`, `--no-annotate-screenshots`
  - 📋 Default evidence directory: `./evidence/{timestamp}/`
- **Backward Compatibility**: Old flags (`--save-evidence`, `--annotate-screenshots`) still accepted
- **CLI after implementation**: `npm run start -- --vision https://example.com` saves evidence by default

**1. CR-002: Heuristic Rules Removal** - ✅ COMPLETE (2026-02-03)
- **Purpose**: Remove rule-based heuristic analysis (H001-H010) - vision analysis supersedes
- **Changes**:
  - ✅ Deleted `src/heuristics/rules/` directory (6 files)
  - ✅ Deleted `src/heuristics/heuristic-engine.ts`
  - ✅ Deleted `tests/unit/heuristic-rules.test.ts`, `tests/unit/heuristic-engine.test.ts`
  - ✅ Removed `createHeuristicEngine` import and Phase 18b-c block from `cro-agent.ts`
  - ✅ Removed `HeuristicRule` interface from types, kept `HeuristicCategory`
  - ✅ Updated integration/E2E tests to not use heuristic engine
- **Backward Compatibility**: `heuristicInsights` field kept as empty array in `CROAnalysisResult`
- **Migration**: Use `--vision` flag for vision-based CRO analysis

**1. CR-001-D: Vision Mode Consolidation** - ✅ COMPLETE (2026-02-03)
- **Purpose**: Simplify vision API to single `--vision` flag and `vision: true` option
- **Changes**:
  - ✅ `--vision` is now the primary CLI flag (replaces `--vision-agent`)
  - ✅ `vision: true` is the new API option (replaces `visionAgentMode`, `enableUnifiedMode`)
  - ✅ Deleted 12 deprecated files in `src/agent/vision/` module
  - ✅ Added `normalizeVisionOptions()` helper for backward compatibility
- **Deprecated Aliases** (still work):
  - `--vision-agent` → `--vision`
  - `--vision-agent-max-steps` → `--vision-max-steps`
  - `visionAgentMode: true` → `vision: true`
  - `enableUnifiedMode: true` → `vision: true`

**1. Phase 21h: Evidence Capture** - ✅ COMPLETE (2026-01-30)
- **Purpose**: Capture and store evidence for each heuristic evaluation
- **5 Evidence Fields**: viewportIndex, screenshotRef, domElementRefs, boundingBox, timestamp
- **CLI Flags**: `--save-evidence`, `--evidence-dir <path>`
- **Key Files Modified**:
  - `src/output/agent-progress-formatter.ts` - Display evidence fields
  - `src/agent/vision/vision-prompt-builder.ts` - elementIndices instruction
  - `src/agent/vision/tools/capture-viewport-tool.ts` - Bounding box extraction
  - `src/agent/vision/vision-state-manager.ts` - Evidence attachment
- **Tasks**: 14 tasks, ~49 tests

**2. Phase 21i: DOM-Screenshot Mapping** - ✅ COMPLETE (2026-02-02)
- **Purpose**: Coordinate mapping between DOM elements and screenshot positions
- **Key Features**: Coordinate transformation, element visibility, screenshot annotation
- **CLI Flags**: `--annotate-screenshots`
- **Key Files Created**:
  - `src/output/screenshot-annotator.ts` - SVG overlay annotation with sharp
  - `src/browser/dom/coordinate-mapper.ts` - Page to screenshot coordinate transform
  - `tests/unit/screenshot-annotator.test.ts` - 27 unit tests
  - `tests/integration/dom-screenshot-mapping.test.ts` - 19 integration tests
- **Tasks**: 17 tasks, ~158 tests

---

### Change History (trimmed entries - cross-reference)

| Change | Phase | Tasks | CLI Milestone | Status |
|--------|-------|-------|---------------|--------|
| **LLM Analysis Optimization** | 26 | 28 | `--sequential-analysis`, `--no-category-batching`, `--no-viewport-filtering`, `--validate-quality` | 📋 PLANNED |
| **Enhanced Extraction & Screenshots** | 25 | 76 | `--screenshot-mode`, `--no-evidence-json`, `--skip-collection-qa` | ✅ COMPLETE |
| **Hybrid LLM Page Detection** | 24 | 23 | `--no-llm-page-detection`, `--force-llm-detection`, `--llm-detection-threshold` | ✅ COMPLETE |
| **LLM Input Capture** | 23 | 9 | Save DOM, screenshots, prompts | ✅ COMPLETE |
| **Default Evidence & Mapping** | 21l | 9 | Evidence + annotation by default | ⏳ 7/9 |
| **Architecture Simplification** | CR-001 | 23 | Merge agents, remove modes | ✅ COMPLETE |
| **Page Type Knowledge Bases** | 22 | ~38 | PLP, Homepage, Cart, Checkout, Generic | 📋 PLANNED |
| **DOM-Screenshot Mapping** | 21i | 17 | `--annotate-screenshots` | ✅ COMPLETE |
| **Evidence Capture** | 21h | 14 | `--save-evidence` | ✅ COMPLETE |
| ~~Vision Agent Loop (standalone)~~ | ~~21g~~ | ~~18~~ | - | ✅ MERGED (CR-001) |
| ~~Full-Page Screenshot Mode~~ | ~~21f~~ | ~~6~~ | ~~`--full-page-screenshot`~~ | ✅ REMOVED (CR-001) |
| ~~Multi-Viewport Full-Page Vision~~ | ~~21e~~ | ~~8~~ | ~~`--full-page-vision`~~ | ✅ REMOVED (CR-001) |
| ~~Single Viewport Vision~~ | ~~21d~~ | ~~7~~ | ~~`--vision`~~ | ✅ REMOVED (CR-001) |
| **Hybrid Extraction Pipeline** | 20 | 60 | - | 📋 DEFERRED |
| **PageType Detection** | 21a | T285-T292 | - | ✅ |
| **Heuristics Knowledge Base** | 21b | T293-T306 | - | ✅ |
| **CRO Vision Analyzer** | 21c | T307-T313 | - | ✅ |
| **Vision Integration** | 21d | T314-T320 | `--vision-model` | ✅ |
| **Peregrine Cookie Banner Fix** | 12c | T282-T284 | - | ✅ |
| **Enhanced Cookie Detection** | 12b | T275-T281 | - | ✅ |
| **Hybrid Extraction Pipeline** | 20 | T147-T206 | `--no-llm-classification` | 📋 Planned |
| **Testing & Polish** | 19f | T143-T146 | - | ✅ |
| **CLI & Config** | 19e | T141-T142 | `--scan-mode=full_page|above_fold|llm_guided` | ✅ |
| **Prompt Updates** | 19d | T139-T140 | - | ✅ |
| **Agent Integration** | 19c | T134-T138 | - | ✅ |
| **DOM Changes** | 19b | T130-T133 | - | ✅ |
| **Coverage Tracking** | 19a | T126-T129 | - | ✅ |
| **CLI: Final integration** | 18-CLI | T119-T122 | `npm run start -- <url>` (CRO default) | ✅ |
| Test Fixtures | 18f | T118a-T118b | - | ✅ |
| Agent Integration | 18e | T117-T118 | - | ✅ |
| Output Generation | 18d | T112-T116a | - | ✅ |
| 10 Heuristic Rules | 18c | T107a-T111c | - | ✅ |
| Heuristic Engine Core | 18b | T106-T106d | - | ✅ |
| Models & Types | 18a | T104-T105a | - | ✅ |
| Control + Integration | 17c | T099-T103 | - | ✅ |
| Analysis Tools (5) | 17b | T094-T098a | - | ✅ |
| Navigation Tools (3) | 17a | T091-T093a | - | ✅ |
| **CLI: Agent loop** | 16-CLI | T088-T090 | `--analyze --max-steps N` | ✅ |
| Agent Core | 16 | T078-T087 | - | ✅ |
| **CLI: Tool execution** | 15b | T077a-T077e | `--tool <name>` | ✅ |
| **Tool System** | 15 | T073-T077 | - | ✅ |
| CLI: DOM extraction | 14b | T072a-T072c | `--cro-extract` | ✅ |
| DOM Extraction | 14 | T065-T071 | - | ✅ |
| Cookie consent | 12 | T045-T053 | `--no-cookie-dismiss` | ✅ |
| Phases 1-13b | - | T001-T064 | - | ✅ |

**Incremental CLI Milestones**:
```
Phase 14b: npm run start -- --cro-extract https://carwale.com           ✅
Phase 15b: npm run start -- --cro-extract --tool analyze_ctas https://carwale.com  ✅
Phase 16-CLI: npm run start -- --analyze --max-steps 5 https://carwale.com  ✅
Phase 18-CLI: npm run start -- https://carwale.com  (CRO analysis as default)  ✅
Phase 19-CLI: npm run start -- --scan-mode=full_page https://carwale.com  ✅ (100% coverage)

# SIMPLIFIED VISION CLI (after CR-001-D consolidation):
Phase 21g-CLI: npm run start -- --vision https://example.com/product  ✅ (THE ONE MODE)
            npm run start -- --vision --vision-model gpt-4o https://example.com  ✅
            npm run start -- --vision --vision-max-steps 25 https://example.com  ✅
Phase 21h-CLI: npm run start -- --vision --save-evidence https://example.com  ✅
            npm run start -- --vision --evidence-dir ./reports https://example.com  ✅
Phase 21i-CLI: npm run start -- --vision --save-evidence --annotate-screenshots https://example.com  ✅
Phase 21l-CLI: npm run start -- --vision https://example.com  ✅ (evidence + annotation by default)
            npm run start -- --vision --no-save-evidence https://example.com  ✅ (opt-out)
            npm run start -- --vision --no-annotate-screenshots https://example.com  ✅ (opt-out)
Phase 23-CLI: npm run start -- --vision https://example.com  ✅ (also saves LLM inputs to ./llm-inputs/)
Phase 24-CLI: npm run start -- --vision https://in.burberry.com/product-p12345  ✅ (Playwright detects PDP)
            npm run start -- --vision --no-llm-page-detection https://example.com  ✅ (disable LLM fallback)
            npm run start -- --vision --force-llm-detection https://example.com  ✅ (force LLM tier)
            npm run start -- --vision --llm-detection-threshold 0.7 https://example.com  ✅ (custom threshold)

# Phase 25 CLI (COMPLETE - all features DEFAULT ON):
Phase 25-CLI: npm run start -- --vision https://example.com  ✅ (full quality pipeline with evidence)
            npm run start -- --vision --no-evidence-json https://example.com  ✅ (disable evidence.json)
            npm run start -- --vision --no-noise-suppression https://example.com  ✅ (show cookie banners)
            npm run start -- --vision --no-media-readiness https://example.com  ✅ (skip lazy-load waits)
            npm run start -- --vision --skip-collection-qa https://example.com  ✅ (skip LLM QA validation)
            npm run start -- --vision --llm-guided-collection https://example.com  ✅ (old LLM-guided mode)
            npm run start -- --vision --screenshot-mode=tiled https://example.com  ✅ (tiled screenshots)

# Phase 26 CLI (PLANNED - optimization flags):
Phase 26-CLI: npm run start -- --vision https://example.com  📋 (10x faster with parallel + batching)
            npm run start -- --vision --sequential-analysis https://example.com  📋 (disable parallel)
            npm run start -- --vision --no-category-batching https://example.com  📋 (one call per category)
            npm run start -- --vision --no-viewport-filtering https://example.com  📋 (send all viewports)
            npm run start -- --vision --max-concurrent-categories 3 https://example.com  📋 (rate limit)

# Phase 26 CLI (PLANNED - quality validation, CI-only):
Phase 26-QA:  npm run start -- --vision --validate-quality https://example.com  📋 (compare vs baseline, CI use)

# DEPRECATED ALIASES (still work, mapped to new flags):
# --vision-agent → --vision
# --vision-agent-max-steps → --vision-max-steps

# REMOVED FLAGS (after CR-001):
# --vision-only, --full-page-vision, --full-page-screenshot
# --vision-max-viewports, --no-parallel-vision
```

---

## Prerequisites

- Node.js 20.x LTS or later
- OpenAI API key with access to GPT-4o-mini

## Installation

```bash
# Clone and install dependencies (Playwright browsers install automatically)
cd browser-agent
npm install
```

**Note**: `npm install` automatically installs the Chromium browser via the `@playwright/browser-chromium` package. No separate `npx playwright install` command is needed.

## Environment Setup

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=sk-your-api-key-here
```

Or export directly:

```bash
export OPENAI_API_KEY=sk-your-api-key-here
```

## Basic Usage

### Single URL Processing

```bash
# Run the agent on a single URL
npm run start -- https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy
```

**Expected Output**:

```
================================================================================
BROWSER AGENT RESULTS
================================================================================
URL: https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy
Status: SUCCESS
Load Time: 1.2s

HEADINGS FOUND: 1
├─ h1: 1
└─ h2-h6: 0

EXTRACTED HEADINGS:
  [h1] Example Domain

LANGCHAIN INSIGHTS:
Summary: Simple landing page with a single main heading.
Categories: [Landing Page, Minimal Content]
Insights:
  - Page has minimal structure with only one heading
  - Content appears to be placeholder/example content
================================================================================
```

### Multiple URLs

```bash
# Process multiple URLs sequentially
npm run start -- https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy https://developer.mozilla.org
```

### Programmatic Usage

```typescript
import { CROAgent } from './src/agent';

async function main(): Promise<void> {
  const agent = new CROAgent({
    maxSteps: 10,
    actionWaitMs: 500,
    llmTimeoutMs: 60000,
    failureLimit: 3,
  });

  const result = await agent.analyze('https://www.example.com/product', {
    browserConfig: {
      headless: false,      // Visible browser
      timeout: 60000,       // 60 second timeout
      browserType: 'chromium',
      waitUntil: 'load',    // Wait strategy: 'load' | 'domcontentloaded' | 'networkidle'
      postLoadWait: 5000,   // Wait up to 5s for JS to render after load
      dismissCookieConsent: true  // Auto-dismiss cookie popups (default: true)
    },
    verbose: true
  });

  if (result.success) {
    console.log('Insights:', result.insights);
    console.log('Hypotheses:', result.hypotheses);
    console.log('Scores:', result.scores);
  } else {
    console.error('Failed:', result.errors);
  }
}

main();
```

## Module Usage Examples

### Browser Module Only

```typescript
import { BrowserManager, PageLoader } from './src/browser';

async function loadPage(): Promise<void> {
  const browser = new BrowserManager({ headless: false, timeout: 60000 });
  await browser.launch();

  const loader = new PageLoader(browser.getPage(), { timeout: 60000 });
  const result = await loader.load('https://www.example.com');

  console.log('Title:', result.title);
  console.log('Success:', result.success);

  await browser.close();
}
```

## CLI Options

```bash
npm run start -- [options] <urls...>

Options:
  --headless            Run browser in headless mode (default: false)
  --timeout <ms>        Page load timeout in ms (default: 60000)
  --wait-until <str>    Page load wait strategy (default: load)
                        - load: Wait for load event (balanced, recommended)
                        - domcontentloaded: Wait for DOM ready (fastest)
                        - networkidle: Wait for no network activity (may timeout)
  --post-load-wait <ms> Wait time for JS rendering after load (default: 5000)
                        Set to 0 to disable hybrid waiting
  --no-cookie-dismiss   Disable automatic cookie consent dismissal (default: enabled)
  --scan-mode <mode>    Page coverage scan mode (default: full_page)
                        - full_page: Scroll through entire page for 100% coverage
                        - above_fold: Only analyze initial viewport (faster)
                        - llm_guided: Let LLM decide scrolling (original behavior)
  --min-coverage <N>    Minimum coverage percentage required (default: 100)
                        Only applies to full_page mode
  --verbose, -v         Enable verbose logging
  --help, -h            Show help
```

### Wait Strategy Examples

```bash
# Default - balanced for most sites (load + 5s JS wait)
npm run start -- https://www.mrandmrssmith.com/

# Fast mode for static sites (no JS wait)
npm run start -- --post-load-wait 0 https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy

# Heavy JS sites - increase JS wait time
npm run start -- --post-load-wait 10000 https://heavy-spa-site.com

# Full networkidle (may timeout on some sites)
npm run start -- --wait-until networkidle https://simple-site.com
```

### Cookie Consent Examples

```bash
# Default - auto-dismiss cookie popups (enabled)
npm run start -- https://www.example-with-cookies.com

# Disable cookie consent dismissal
npm run start -- --no-cookie-dismiss https://www.example.com
```

### Scan Mode Examples (Phase 19)

```bash
# Default - full_page mode for 100% page coverage
npm run start -- https://www.example.com
# Scrolls through entire page, extracts DOM at each segment
# Merges all DOM snapshots into complete tree
# Blocks 'done' until 100% coverage achieved

# Above fold mode - faster, only initial viewport
npm run start -- --scan-mode=above_fold https://www.example.com
# Best for quick analysis of hero section and above-fold CTAs
# No scrolling, single DOM extraction

# LLM-guided mode - original behavior, LLM decides scrolling
npm run start -- --scan-mode=llm_guided https://www.example.com
# LLM can choose to scroll or not based on analysis
# No coverage enforcement

# Custom coverage threshold (full_page mode)
npm run start -- --scan-mode=full_page --min-coverage=80 https://www.example.com
# Allows completion at 80% coverage instead of 100%

# Combine with other options
npm run start -- --scan-mode=full_page --headless --verbose https://www.example.com
```

## Error Handling

The agent provides clear error messages for each failure stage:

```typescript
const result = await agent.processUrl('https://invalid-url');

if (!result.success) {
  switch (result.errorStage) {
    case 'load':
      console.error('Page failed to load:', result.error);
      break;
    case 'extract':
      console.error('Extraction failed:', result.error);
      break;
    case 'process':
      console.error('LangChain processing failed:', result.error);
      break;
  }
}
```

## Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests (requires browser)
npm run test:e2e         # End-to-end workflow test

# Run with coverage
npm run test:coverage
```

## Troubleshooting

### Missing API Key

```
Error: OPENAI_API_KEY environment variable is not set.
Please set your OpenAI API key before running the agent.
```

**Solution**: Set the `OPENAI_API_KEY` environment variable.

### Page Load Timeout

```
Error: Page load timed out after 60000ms
URL: https://slow-site.example.com
```

**Solution**: The page may be slow or blocked. Try a different URL or increase timeout.

### No Headings Found

```
Warning: No headings found on page
URL: https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy/empty-page
```

**Solution**: This is expected for pages without h1-h6 elements. The agent will return empty results.

### Browser Launch Failed

```
Error: Failed to launch browser
Details: Executable doesn't exist at /path/to/chromium
```

**Solution**: Run `npx playwright install chromium` to install the browser.
