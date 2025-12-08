# Session Handoff: CRO Agent Phase 18 Implementation

**Created**: 2025-12-05
**Updated**: 2025-12-09
**Purpose**: Bootstrap new Claude Code session for Phase 18c implementation
**Context**: Phase 18b complete, ready for 10 Heuristic Rules (H001-H010)

---

## Quick Start for New Session

### Step 1: Read Core Documents (in order)

```
1. specs/001-browser-agent-core/SESSION-HANDOFF.md  ← You are here
2. specs/001-browser-agent-core/quickstart.md       ← Project overview, CLI usage
3. specs/001-browser-agent-core/tasks.md            ← Phase 18 task details (T104-T122)
4. specs/001-browser-agent-core/plan.md             ← Module architecture, Phase 18 design
```

### Step 2: Understand the Spec Kit System

This project uses **SpecKit** - a structured documentation workflow:

| File | Purpose | When to Update |
|------|---------|----------------|
| `spec.md` | WHAT - Requirements, user stories (tech-agnostic) | New features/requirements |
| `plan.md` | HOW - Architecture, interfaces, tech stack | Design changes |
| `research.md` | WHY - Technology decisions, rationale | New tech decisions |
| `tasks.md` | DO - Actionable tasks with IDs | Implementation work |
| `quickstart.md` | STATUS - Progress, CLI usage, change history | After each phase |

**Change Workflow**: spec.md → plan.md → tasks.md → quickstart.md → implement → test

### Step 3: Implement Next Phase

```
Phase 18a (T104-T105a): Models & Types ✅ COMPLETE
├── T104: Create src/models/business-type.ts ✅
├── T105: Create src/models/hypothesis.ts ✅
└── T105a: Update src/models/index.ts with exports ✅

Phase 18b (T106-T106d): Heuristic Engine Core ✅ COMPLETE (26 tests)
├── T106: Create src/heuristics/types.ts ✅
├── T106a: Create heuristic-engine.ts (11 tests) ✅
├── T106b: Create business-type-detector.ts (8 tests) ✅
├── T106c: Create severity-scorer.ts (7 tests) ✅
└── T106d: Create src/heuristics/index.ts ✅

Phase 18c (T107a-T111c): 10 Heuristic Rules (20 tests) - NEXT
├── T107a-T107b: CTA rules (H001, H002)
├── T108a-T108b: Form rules (H003, H004)
├── T109a-T109b: Trust rules (H005, H006)
├── T110a-T110b: Value prop rules (H007, H008)
├── T111a-T111b: Navigation rules (H009, H010)
└── T111c: Create rules/index.ts + createHeuristicEngine()

Phase 18d (T112-T116a): Output Generation (20 tests)
├── T112: Create hypothesis-generator.ts (6 tests)
├── T113: Create insight-deduplicator.ts (4 tests)
├── T114: Create insight-prioritizer.ts (3 tests)
├── T115: Create markdown-reporter.ts (4 tests)
├── T116: Create json-exporter.ts (3 tests)
└── T116a: Update src/output/index.ts

Phase 18e (T117-T118): Agent Integration (12 integration tests)
├── T117: Update cro-agent.ts with post-processing pipeline
├── T117a: Update CROAnalysisResult interface
├── T117b: Create score-calculator.ts
└── T118: Create tests/integration/post-processing.test.ts

Phase 18f (T118a-T118b): Test Fixtures
├── T118a: Create tests/fixtures/test-pages/ (5 HTML files)
└── T118b: Create tests/fixtures/expected-results.json

Phase 18-CLI (T119-T122): Final CLI Integration (10 tests)
├── T119: Update src/cli.ts (default CRO mode)
├── T119a: Create file-writer.ts (2 tests)
├── T120: Update src/index.ts exports
├── T121: Create tests/e2e/cro-full-workflow.test.ts (4 tests)
└── T122: Update documentation
```

### Step 4: Verify & Update

```bash
npx tsc --noEmit           # Type check
npm run test:unit          # Unit tests
npm test                   # All tests
```

After implementation:
1. Update `quickstart.md` Recent Changes section
2. Update `SESSION-HANDOFF.md` if context > 60%

---

## Project Overview

**Project**: CRO (Conversion Rate Optimization) Browser Agent
**Stack**: TypeScript, Node.js 20.x, Playwright, LangChain, Zod
**Goal**: Autonomous agent that analyzes websites for CRO issues and generates A/B test hypotheses

**Current State**: 115/153 tasks complete (75%) - Phase 18b complete, ready for Phase 18c

---

## What's Been Built

### Infrastructure (Phase 1-12) ✅
- Playwright browser automation with Chromium
- Hybrid wait strategy (load + JS render wait)
- Cookie consent popup dismissal (8 CMPs + heuristics)
- Heading extraction + LangChain processing
- CLI with URL processing

### CRO Models (Phase 13) ✅
- `src/models/dom-tree.ts` - DOMNode, DOMTree, CROType, BoundingBox
- `src/models/cro-insight.ts` - CROInsight with severity, evidence
- `src/models/page-state.ts` - PageState, ViewportInfo, ScrollPosition
- `src/models/tool-definition.ts` - ToolDefinition, ToolResult
- `src/models/cro-memory.ts` - CROMemory, StepRecord
- `src/models/agent-state.ts` - AgentState, CROAgentOptions
- `src/models/agent-output.ts` - CROAgentOutputSchema (Zod)

### DOM Extraction (Phase 14) ✅
- `src/browser/dom/cro-selectors.ts` - CRO element patterns (CTAs, forms, trust, etc.)
- `src/browser/dom/build-dom-tree.ts` - Injectable DOM traversal script
- `src/browser/dom/extractor.ts` - DOMExtractor class
- `src/browser/dom/serializer.ts` - DOMSerializer with token budget

### Tool System (Phase 15) ✅
- `src/agent/tools/types.ts` - Tool, ToolContext, ExecutionContext interfaces
- `src/agent/tools/tool-registry.ts` - ToolRegistry class
- `src/agent/tools/tool-executor.ts` - ToolExecutor with validation/timing

### Agent Core (Phase 16) ✅
- `src/agent/prompt-builder.ts` - PromptBuilder class (system + user prompts)
- `src/agent/message-manager.ts` - MessageManager class (LangChain messages)
- `src/agent/state-manager.ts` - StateManager class (step/failure tracking)
- `src/agent/cro-agent.ts` - CROAgent class (observe→reason→act loop)
- `src/prompts/system-cro.md` - System prompt template

### CRO Tools (Phase 17) ✅ - All 11 Tools Complete
```
Analysis:   analyze_ctas ✅, analyze_forms ✅, detect_trust_signals ✅,
            assess_value_prop ✅, check_navigation ✅, find_friction ✅
Navigation: scroll_page ✅, click ✅, go_to_url ✅
Control:    record_insight ✅, done ✅
```

### Heuristics Module (Phase 18a-18b) ✅
- `src/models/business-type.ts` - BusinessType, BusinessTypeResult, BUSINESS_TYPE_SIGNALS
- `src/models/hypothesis.ts` - Hypothesis interface, HypothesisSchema (Zod)
- `src/heuristics/types.ts` - HeuristicRule, HeuristicResult interfaces
- `src/heuristics/heuristic-engine.ts` - HeuristicEngine class
- `src/heuristics/business-type-detector.ts` - BusinessTypeDetector class
- `src/heuristics/severity-scorer.ts` - SeverityScorer class

### Tests ✅
- 322 unit tests passing
- Type check: `npx tsc --noEmit` passes

---

## Immediate Task: Phase 18c - 10 Heuristic Rules

**Purpose**: Implement H001-H010 heuristic rules for automated CRO analysis

**Requirements Coverage**:
- FR-072 to FR-081 (10 rules)
- SC-044 (rule accuracy)
- 20 tests planned (2 per rule: positive + negative case)

### Phase 18 Structure

| Sub-Phase | Tasks | Tests | Purpose | Status |
|-----------|-------|-------|---------|--------|
| **18a** | T104-T105a | 8 | Models & Types (BusinessType, Hypothesis) | ✅ |
| **18b** | T106-T106d | 26 | Heuristic Engine Core | ✅ |
| **18c** | T107a-T111c | 20 | 10 Heuristic Rules (H001-H010) | ⏳ NEXT |
| **18d** | T112-T116a | 20 | Output Generation | ⏳ |
| **18e** | T117-T118 | 12 int | Agent Integration | ⏳ |
| **18f** | T118a-T118b | - | Test Fixtures | ⏳ |
| **18-CLI** | T119-T122 | 10 | Final CLI Integration | ⏳ |

**Remaining**: 38 tasks, ~62 tests

### 10 Heuristic Rules to Implement (Phase 18c) - NEXT

| Rule | Name | Category | Severity |
|------|------|----------|----------|
| H001 | vague_cta_text | cta | medium |
| H002 | no_cta_above_fold | cta | high |
| H003 | form_field_overload | form | high |
| H004 | missing_field_label | form | medium |
| H005 | no_trust_above_fold | trust | medium |
| H006 | no_security_badge | trust | high |
| H007 | unclear_value_prop | value_prop | high |
| H008 | headline_too_long | value_prop | low |
| H009 | no_breadcrumbs | navigation | low |
| H010 | no_search_ecommerce | navigation | medium |

### Post-Processing Pipeline (Phase 18e)

```typescript
// After agent loop completes:
1. detectBusinessType(pageState) → BusinessTypeResult
2. runHeuristics(pageState, businessType) → CROInsight[]
3. deduplicateInsights([toolInsights, heuristicInsights])
4. prioritizeInsights(insights, businessType)
5. generateHypotheses(highSeverityInsights) → Hypothesis[]
6. calculateScores(insights) → CROScores
7. generateReport(result, format) → markdown | json
```

---

## Phase Roadmap (CLI Milestones)

| Phase | Tasks | CLI Milestone | Status |
|-------|-------|---------------|--------|
| 14b | T072a-T072c | `--cro-extract` | ✅ Complete |
| 15b | T077a-T077e | `--tool <name>` | ✅ Complete |
| 16-CLI | T088-T090 | `--analyze` | ✅ Complete |
| **18-CLI** | T119-T122 | **`<url>` (CRO default)** | ⏳ **TARGET** |

**Final CLI Usage**:
```bash
npm run start -- https://carwale.com                          # CRO analysis (default)
npm run start -- https://carwale.com --output-format markdown # Markdown report
npm run start -- https://carwale.com --output-file report.md  # Write to file
npm run start -- https://carwale.com --legacy                 # Old heading extraction
```

---

## Key Files Reference

### Existing Code to Use

```typescript
// DOM Extraction (use these)
import { DOMExtractor } from './browser/dom/index.js';
import type { DOMTree, DOMNode, PageState } from './models/index.js';

// Tool System
import { ToolRegistry, ToolExecutor } from './agent/tools/index.js';
import { createCRORegistry } from './agent/tools/create-cro-registry.js';

// Agent Core
import { CROAgent } from './agent/cro-agent.js';
import { StateManager } from './agent/state-manager.js';

// Models
import type { CROInsight, Severity, InsightCategory } from './models/index.js';
```

### New Files to Create (Phase 18)

```
src/models/business-type.ts           ← T104
src/models/hypothesis.ts              ← T105
src/heuristics/types.ts               ← T106
src/heuristics/heuristic-engine.ts    ← T106a
src/heuristics/business-type-detector.ts ← T106b
src/heuristics/severity-scorer.ts     ← T106c
src/heuristics/rules/cta-rules.ts     ← T107a-T107b
src/heuristics/rules/form-rules.ts    ← T108a-T108b
src/heuristics/rules/trust-rules.ts   ← T109a-T109b
src/heuristics/rules/value-prop-rules.ts ← T110a-T110b
src/heuristics/rules/navigation-rules.ts ← T111a-T111b
src/heuristics/rules/index.ts         ← T111c
src/output/hypothesis-generator.ts    ← T112
src/output/insight-deduplicator.ts    ← T113
src/output/insight-prioritizer.ts     ← T114
src/output/markdown-reporter.ts       ← T115
src/output/json-exporter.ts           ← T116
src/output/file-writer.ts             ← T119a
src/agent/score-calculator.ts         ← T117b
```

---

## Tech Stack Reminders

- **Zod v4**: Use `z.object()`, `safeParse()` - NOT Pydantic
- **TypeScript**: Use interfaces, not Python dataclass
- **ESM**: Use `.js` extension in imports
- **Playwright**: Already configured, use existing BrowserManager

---

## Verification Commands

```bash
npx tsc --noEmit           # Type check
npm run test:unit          # Unit tests (284+ tests)
npm test                   # All tests (~2min)
```

---

## Context Window Guidelines

- Optimal: 40-60% utilization
- At 60%: Update this handoff, request new session
- Never exceed 70%

---

## Session Instructions

### Code Style Requirements

1. **TypeScript Strict Mode**: All code must pass `tsc --noEmit`
2. **ESM Imports**: Use `.js` extension in imports (e.g., `import { X } from './file.js'`)
3. **Zod v4**: Use `z.object()`, `safeParse()`, `z.toJSONSchema()` - NOT external packages
4. **Async/Await**: No raw Promises or callbacks
5. **Single Responsibility**: One class/function per concern
6. **JSDoc**: Document public APIs

### Task Completion Protocol (MANDATORY)

**tasks.md is the SINGLE SOURCE OF TRUTH** - not internal todo lists.

After completing **each task** (T0XX):
1. Immediately update `tasks.md`:
   - Change `- [ ]` to `- [x]`
   - Add ✅ at end of the task line
2. Do NOT batch updates - update after EACH task

After completing **all tasks in a sub-phase**:
1. Add `**[COMPLETE]**` to the phase header
2. Mark checkpoint with ✅
3. Update test counts if different from planned

### Do NOT

- ❌ Read `browser-use/` folder (reference only, 545 files)
- ❌ Copy Python code patterns directly
- ❌ Use `any` type
- ❌ Skip the Change Workflow
- ❌ Implement without updating spec kit first
- ❌ Use internal TodoWrite as substitute for tasks.md updates
- ❌ Batch task completions - update tasks.md after EACH task

---

*End of handoff. Start with Phase 18a (T104) to create BusinessType model.*
