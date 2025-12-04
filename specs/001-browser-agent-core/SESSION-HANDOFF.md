# Session Handoff: CRO Agent Phase 15 Implementation

**Created**: 2025-12-05
**Purpose**: Bootstrap new Claude Code session for Phase 15 implementation
**Context**: Restructured for incremental CLI integration

---

## Quick Start for New Session

```
Read these files in order:
  1. specs/001-browser-agent-core/SESSION-HANDOFF.md (this file)
  2. specs/001-browser-agent-core/quickstart.md
  3. cro-agent-implementation-plan.md

Then implement Phase 15 tasks (T073-T077).
```

---

## Project Overview

**Project**: CRO (Conversion Rate Optimization) Browser Agent
**Stack**: TypeScript, Node.js 20.x, Playwright, LangChain, Zod
**Goal**: Autonomous agent that analyzes websites for CRO issues and generates A/B test hypotheses

**Current State**: 74/120 tasks complete (62%)

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

### CLI Integration (Phase 14b) ✅
- `src/output/cro-element-formatter.ts` - CROElementFormatter class
- `src/cli.ts` - Added `--cro-extract` flag
- Test: `npm run start -- --cro-extract https://www.carwale.com/`

### Tests ✅
- 111 unit tests passing
- 14 integration tests passing
- Type check: `npx tsc --noEmit` passes

---

## Immediate Task: Phase 15

**Purpose**: Tool registry and execution framework for CRO analysis

### Tasks

| Task | Description | File |
|------|-------------|------|
| T073 | BaseTool abstract class | `src/agent/tools/base-tool.ts` |
| T074 | ToolRegistry class | `src/agent/tools/tool-registry.ts` |
| T075 | ToolExecutor class | `src/agent/tools/tool-executor.ts` |
| T076 | Module exports | `src/agent/tools/index.ts` |
| T077 | Unit tests | `tests/unit/tools.test.ts` |

### T073: BaseTool Abstract Class

Create `src/agent/tools/base-tool.ts`:
- Abstract class with name, description properties
- `execute(params: unknown): Promise<ToolResult>` abstract method
- Input/output schema validation with Zod

### T074: ToolRegistry Class

Create `src/agent/tools/tool-registry.ts`:
- `register(tool: BaseTool): void`
- `get(name: string): BaseTool | undefined`
- `getAll(): BaseTool[]`
- `getToolDefinitions(): ToolDefinition[]` for LLM context

### T075: ToolExecutor Class

Create `src/agent/tools/tool-executor.ts`:
- `execute(name: string, params: unknown): Promise<ToolResult>`
- Error handling with ToolResult.success=false
- Logging of tool invocations

---

## Phase Roadmap (Incremental CLI)

| Phase | Tasks | CLI Milestone | Status |
|-------|-------|---------------|--------|
| 14b | T072a-T072c | `--cro-extract` | ✅ Complete |
| **15** | T073-T077 | Tool system | ⏳ **NEXT** |
| 15b | T077a-T077b | `--tool <name>` | ⏳ |
| 16 | T078-T087 | Agent core | ⏳ |
| 16b | T087a-T087b | `--analyze` | ⏳ |
| 17 | T088-T097 | CRO tools | ⏳ |
| 18 | T061-T108 | Heuristics | ⏳ |
| 18b | T109-T112 | CRO as default | ⏳ |

---

## Key Files Reference

### Existing Code to Use

```typescript
// DOM Extraction (use these)
import { DOMExtractor } from './browser/dom/index.js';
import { DOMSerializer } from './browser/dom/index.js';
import type { DOMTree, DOMNode } from './models/index.js';

// Existing patterns
import { BrowserManager, PageLoader } from './browser/index.js';
import { CookieConsentHandler } from './browser/cookie-handler.js';
```

### CLI Structure (src/cli.ts)

Current flow:
1. Parse args → 2. Launch browser → 3. Load page → 4. Dismiss cookies → 5. Extract headings → 6. LangChain → 7. Format output

New flow with `--cro-extract`:
1. Parse args → 2. Launch browser → 3. Load page → 4. Dismiss cookies → 5. **Extract CRO DOM** → 6. **Format CRO elements** → 7. Output

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
npm run test:unit          # Unit tests (111 tests)
npm test                   # All tests (~2min)
```

---

## Context Window Guidelines

- Optimal: 40-60% utilization
- At 60%: Update this handoff, request new session
- Never exceed 70%

---

## Reference Documents

| Document | Purpose |
|----------|---------|
| `quickstart.md` | Project overview, change history |
| `tasks.md` | Full task list with Phase 14b details |
| `plan.md` | Architecture, module design |
| `spec.md` | Requirements US1-US10 |
| `cro-agent-implementation-plan.md` | Original CRO agent blueprint |
| `browser-use-reference.md` | Python reference mapping (DO NOT copy code) |

---

*End of handoff. Implement Phase 14b to enable `npm run start -- --cro-extract https://www.carwale.com/`*
