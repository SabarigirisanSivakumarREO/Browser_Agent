# Browser Agent — CRO Auditor + Goal-Directed Agent

## Quick Context

CRO (Conversion Rate Optimization) browser automation tool + goal-directed browser agent. Analyzes web pages using Playwright + GPT-4o-mini to generate insights, hypotheses, and A/B test recommendations. Also supports autonomous multi-step browser tasks via `--agent-mode`.

**Two modes**:
- **CRO Analysis** (default): Collection (DOM + screenshots + AX tree) → Analysis (parallel LLM evaluation) → Output (insights + hypotheses + reports)
- **Agent Mode** (`--agent-mode`): Perceive → Plan → Act → Verify → Repeat (goal-directed browser automation)

## Bootstrap (READ FIRST in every session)

**MANDATORY**: Before starting ANY work, read these files IN ORDER. Do NOT skip.

### Step 1: Constitution (governance)
```
.specify/memory/constitution.md
```
10 principles governing ALL code decisions. This is law. Violations require explicit justification.

### Step 2: Quickstart (project status + history)
```
specs/001-browser-agent-core/quickstart.md
```
Full project status, phase history (Phases 1-32), architecture overview, session management rules, what's done vs pending.

### Step 3: README (features + usage)
```
README.md
```
Features, CLI flags, architecture diagram, project structure, type definitions.

### Step 4: Phase-specific context (if working on a phase)
```
specs/001-browser-agent-core/spec/requirements-phase{N}.md  — requirements
specs/001-browser-agent-core/plan/phase-{N}.md              — design + architecture
specs/001-browser-agent-core/tasks/phase-{N}.md             — task list with checkboxes
```

### Step 5: Memory (cross-session context)
```
Check MEMORY.md in the auto-memory directory for user preferences, feedback, and project context from prior sessions.
```

## Speckit Workflow (ALWAYS follow this order)

The spec kit is the source of truth. **Update specs BEFORE coding**.

```
spec → plan → tasks → implement → test → commit
```

All speckit artifacts live under `specs/001-browser-agent-core/`:
- `spec/` — Requirements by phase (requirements-phase{N}.md)
- `plan/` — Implementation plans by phase (phase-{N}.md)
- `tasks/` — Task lists by phase (phase-{N}.md) — use `[x]` to mark done

**Speckit commands**:
```
/speckit.specify   — Create/update feature spec
/speckit.plan      — Generate implementation plan
/speckit.tasks     — Generate task list from plan
/speckit.implement — Execute tasks
/speckit.clarify   — Ask clarification questions about spec
/speckit.analyze   — Cross-artifact consistency check
```

**Feature detection**: Scripts use `SPECIFY_FEATURE` env var or git branch name. On `main` branch, set `SPECIFY_FEATURE=001-browser-agent-core` when running speckit scripts.

## Technologies

- TypeScript 5.x strict mode, Node.js 20+ LTS
- Playwright (browser automation, 1280x800 viewport)
- LangChain + OpenAI (gpt-4o-mini default)
- Zod (schema validation), sharp (image processing), p-limit (concurrency)
- Vitest (90+ test files, 1350+ tests)

## Project Structure

```text
src/
├── agent/                # CROAgent orchestrator, state, tools
│   ├── cro-agent.ts      # Main CRO pipeline (~2000 lines)
│   ├── state-manager.ts  # CRO phase state tracking
│   ├── prompt-builder.ts # CRO prompt construction
│   ├── message-manager.ts # LLM conversation history
│   ├── agent-loop/       # Phase 32: Goal-directed agent loop
│   │   ├── agent-loop.ts # Perceive→Plan→Act→Verify orchestrator
│   │   ├── perceiver.ts  # Page state extraction (URL, DOM hash, AX tree)
│   │   ├── planner.ts    # LLM single-action planning
│   │   ├── verifier.ts   # LLM goal verification
│   │   ├── failure-router.ts # Deterministic failure → strategy mapping
│   │   ├── budget-controller.ts # Step/time budget tracking
│   │   ├── confidence-decay.ts  # Linear confidence decay
│   │   ├── types.ts      # All agent-loop interfaces
│   │   └── json-utils.ts # LLM JSON extraction
│   └── tools/            # Tool system
│       ├── tool-registry.ts    # Name → Tool mapping
│       ├── tool-executor.ts    # Validation + execution + timing
│       ├── create-cro-registry.ts # Factory: 26 tools registered
│       └── cro/                # 26 tool implementations
│           ├── tool-utils.ts   # Shared: findElementByIndex, coerceBoolean
│           ├── analyze-ctas.ts ... find-friction-tool.ts  # 6 CRO analysis
│           ├── click-tool.ts, scroll-tool.ts, go-to-url-tool.ts  # 3 navigation
│           ├── capture-viewport-tool.ts, collection-done-tool.ts  # 2 collection
│           ├── record-insight-tool.ts, done-tool.ts  # 2 control
│           └── type-text-tool.ts ... get-ax-tree-tool.ts  # 13 interaction (Phase 31)
├── browser/        # Playwright lifecycle, DOM extraction, AX tree, cleanup
├── detection/      # Page analysis, semantic matching
├── heuristics/     # Analysis orchestrator, category analyzer, auto-crop, knowledge bases, vision
├── models/         # Zod schemas, ViewportSnapshot, CROInsight, PageType, CROActionNames (26 tools)
├── output/         # Reports, evidence, screenshots, hypothesis generation
├── types/          # Config types, evidence schema
├── utils/          # Logger, validator
└── validation/     # Cheap validator, LLM QA, quality comparison
tests/
├── unit/           # 55+ files
│   └── tools/      # Phase 31: P0-P3 interaction tool tests
│   └── agent-loop/ # Phase 32: Pure logic unit tests
├── integration/    # 23+ files
└── e2e/            # 9 files (gated behind RUN_E2E_TESTS)
specs/001-browser-agent-core/
├── spec/           # Requirements by phase (requirements-phase{N}.md)
├── plan/           # Implementation plans by phase (phase-{N}.md)
├── tasks/          # Task lists by phase (phase-{N}.md)
└── quickstart.md   # Project overview + status
.specify/
├── memory/constitution.md  # Project constitution (v2.0.0) — READ FIRST
└── templates/              # Speckit templates
```

## Commands

```bash
npm test              # Run all 1350+ tests
npm run test:unit     # Unit tests only
npm run lint          # ESLint
npm run typecheck     # TypeScript checks
npm run start -- --vision --headless https://example.com       # CRO analysis
npm run start -- --agent-mode "Search Wikipedia for TypeScript" # Agent mode (Phase 32)
```

## Tool System (26 tools)

### CRO Analysis Tools (6) — return CROInsight[]
`analyze_ctas`, `analyze_forms`, `detect_trust_signals`, `assess_value_prop`, `check_navigation`, `find_friction`

### Navigation Tools (3) — return insights: []
`scroll_page`, `click`, `go_to_url`

### Collection Tools (2) — CR-001-B
`capture_viewport`, `collection_done`

### Control Tools (2)
`record_insight`, `done`

### Browser Interaction Tools (13) — Phase 31
`type_text`, `press_key`, `select_option`, `extract_text`, `hover`, `go_back`, `wait_for`, `dismiss_blocker`, `switch_tab`, `upload_file`, `execute_js`, `drag_and_drop`, `get_ax_tree`

**Tool pattern**: Every tool implements `Tool` interface (name, description, parameters: ZodSchema, execute). Returns `ToolResult { success, insights[], extracted?, error? }`. Never throws. Registered in `createCRORegistry()`.

## Key Conventions

- **Constitution is law** — read `.specify/memory/constitution.md` before architectural decisions
- **Spec kit is source of truth** — update specs BEFORE coding (spec → plan → tasks → implement)
- **Barrel exports** — every `src/` module has `index.ts`
- **Features default ON** with opt-out CLI flags (e.g., `--no-ax-tree`, `--no-auto-crop`)
- **Batching/viewport filtering are opt-IN** (degrade quality in live testing)
- **No console.log in business logic** — use `createLogger()` for internal logging
- **500-line file limit** — decompose if approaching
- **Tests must pass** — fix broken tests immediately, never accumulate failures
- **Mock pattern**: `vi.hoisted()` for mock factories, `function` keyword for ChatOpenAI constructor
- **Tool pattern**: Zod params with `z.coerce` for LLM string inputs, `findElementByIndex` for DOM element lookup, `coerceBoolean` for string→boolean
- **Never throw in tools** — catch all errors, return `{ success: false, insights: [], error: message }`

## Current Status

- **Phases 1-30** ✅: Complete (CRO analysis pipeline, vision, AX tree, auto-crop)
- **Phase 31** ✅: 13 browser interaction tools (type, click, hover, select, keyboard, tabs, etc.)
- **Phase 32** ✅: Agent loop with plan-act-verify (`--agent-mode`, perceiver, planner, verifier, failure router)
- **Phase 33** ✅: AgentQ-inspired reliability (element pre-validation, 6 failure types, sub-goals, self-critique, multi-candidate)
- **Phase 22B-E** 📋: Pending (Homepage, Cart, Checkout, Generic knowledge bases)
- **Viewport**: 1280x800
- **Image pipeline**: Full-res capture → auto-crop per category → token-aware compression
- **Default model**: gpt-4o-mini
- **Tool count**: 26 (13 original + 13 Phase 31 interaction tools)
- **Test count**: 1399+ (1370 Phase 32 + 29 Phase 33)

## Excluded Folders

- `browser-use/` — Reference codebase only (545 files), NEVER analyze
- `Browser Agent scaffold/` — Separate MVP project, NOT this codebase

## Session Management

- **Task limit**: 1-5 tasks per session (optimal context usage)
- **Context window**: Monitor usage, handoff at 60%, never exceed 70%
- **Task tracking**: Mark tasks `[x]` in `tasks/phase-{N}.md` as completed
- **Commits**: Conventional commit format, atomic, explain "why"

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
