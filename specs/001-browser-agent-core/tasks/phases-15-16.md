**Navigation**: [Index](./index.md) | [Previous](./phases-13-14.md) | [Next](./phase-17.md)

---

## Phase 15: Tool System (US6) ✅

**Purpose**: Tool registry and execution framework for CRO analysis

**Design**: Interface-based tools. ToolExecutor owns validation, timing, error handling. See plan.md Section 8.

**Requirements**: FR-031 to FR-038, CR-016, CR-017, SC-016 to SC-018

- [x] T073 [US6] Create src/agent/tools/types.ts
  - ToolContext, Tool, ToolDefinitionForLLM interfaces
  - Re-export ToolResult from models
- [x] T074 [US6] Create src/agent/tools/tool-registry.ts
  - ToolRegistry class with register, get, has, getAll, getToolDefinitions, clear
  - Uses native Zod v4 `z.toJSONSchema()` for LLM definitions
- [x] T075 [US6] Create src/agent/tools/tool-executor.ts
  - ToolExecutor class with execute method
  - Validates params, tracks timing, handles errors
- [x] T076 [US6] Create src/agent/tools/index.ts - Module exports
- [x] T077 [US6] Create tests/unit/tool-system.test.ts (20 tests)

**Checkpoint**: ✅ COMPLETE (2025-12-05)
- 131 unit tests passing (20 new tool system tests)
- Uses native Zod v4 `z.toJSONSchema()` (no external package needed)

---

## Phase 15b: CLI Integration - Tool Execution (US6) ✅

**Purpose**: Allow manual tool execution via CLI for testing

- [x] T077a [US6] Update src/cli.ts with --tool flag
  - `--tool analyze_ctas` executes specific tool on page
  - Outputs tool result (insights, extracted data)
- [x] T077b [US6] Create src/output/tool-result-formatter.ts
  - formatToolResult(result: ToolResult): string
- [x] T077c [US6] Create src/agent/tools/cro/analyze-ctas.ts (sample tool)
- [x] T077d [US6] Create src/agent/tools/create-cro-registry.ts (factory)
- [x] T077e [US6] Add 5 unit tests for ToolResultFormatter

**Checkpoint**: ✅ COMPLETE (2025-12-05)
- `npm run start -- --cro-extract --tool analyze_ctas https://carwale.com` works
- 136 unit tests passing (5 new formatter tests)

---

## Phase 16: Agent Core (US6) **[COMPLETE]**

**Purpose**: Main CRO agent orchestration with observe→reason→act loop

**Prerequisites**: Phase 15 ✅, Phase 14 ✅, Phase 13b ✅

**Implementation Reference**: See plan.md "Phase 16: Agent Core Implementation Details" for code

**Requirements**: FR-018 to FR-024, FR-039 to FR-048, CR-010 to CR-014, SC-019 to SC-026

---

### Phase 16a: System Prompt

- [x] T078 [US6] Create src/agent/prompt-builder.ts with PromptBuilder class ✅
  - Methods: buildSystemPrompt(), buildUserMessage(state, memory), formatToolsSection()
  - Injects tool definitions from ToolRegistry.getToolDefinitions()
  - Ref: FR-039, FR-040

- [x] T078a [P] [US6] Create src/prompts/system-cro.md template file ✅
  - Sections: identity, expertise, input_format, output_format, available_tools, completion_criteria
  - Ref: FR-020

---

### Phase 16b: State & Memory Management

- [x] T079 [US6] Create src/agent/message-manager.ts with MessageManager class ✅
  - Uses @langchain/core/messages (HumanMessage, AIMessage, SystemMessage)
  - Methods: addUserMessage(), addAssistantMessage(), getMessages(), clear(), trimToLimit()
  - Ref: FR-041, FR-042

- [x] T080 [US6] Create src/agent/state-manager.ts with StateManager class ✅
  - State: step, consecutiveFailures, totalFailures, insights, isDone, memory
  - Methods: incrementStep(), setDone(), recordFailure(), resetFailures(), shouldTerminate()
  - Termination: step >= maxSteps OR consecutiveFailures >= 3 OR isDone
  - Ref: FR-043, FR-044, FR-045, CR-010, CR-014

---

### Phase 16c: Main Agent

- [x] T081 [US6] Create src/agent/cro-agent.ts with CROAgent class ✅
  - Constructor: options merged with DEFAULT_CRO_OPTIONS
  - Method: analyze(url) returns CROAnalysisResult
  - Loop: observe→reason→act pattern with LLM (gpt-4o)
  - Error handling: LLM timeout, invalid JSON, tool errors, page errors
  - Re-extracts DOM after scroll/click actions
  - Ref: FR-046, FR-047, FR-048, CR-011, CR-012

- [x] T082 [US6] Update src/agent/index.ts with Phase 16 exports ✅
  - Export: PromptBuilder, MessageManager, StateManager, CROAgent, CROAnalysisResult

---

### Phase 16d: Unit Tests

- [x] T083 [P] [US6] Create tests/unit/prompt-builder.test.ts (20 tests) ✅
  - System prompt contains all 6 sections
  - User message includes URL, title, CRO elements, memory
  - Ref: SC-019

- [x] T084 [P] [US6] Create tests/unit/message-manager.test.ts (22 tests) ✅
  - Message ordering, types, count, clear, trimToLimit
  - Ref: SC-020

- [x] T085 [P] [US6] Create tests/unit/state-manager.test.ts (28 tests) ✅
  - Initial state, step management, failure tracking, termination conditions, insights
  - Ref: SC-021

---

### Phase 16e: Integration & E2E Tests

- [x] T086 [US6] Create tests/integration/cro-agent.test.ts (18 tests) ✅
  - Mock LLM with pre-canned responses
  - Test: loop completion, maxSteps, failure handling, state accumulation
  - Ref: SC-022, SC-024

- [x] T087 [US6] Create tests/e2e/cro-agent-workflow.test.ts (8 tests) ✅
  - Real browser + mock LLM responses
  - Verify: DOM extraction, tool execution, workflow completion, proper cleanup
  - Ref: SC-023, SC-025

---

**Checkpoint**: Agent completes loop with mock LLM, terminates on done/max-steps/failures ✅

**Total Tests**: 96 (70 unit + 18 integration + 8 e2e)

---

## Phase 16-CLI: CLI Integration - Agent Loop (US6) **[COMPLETE]**

**Purpose**: Run CRO agent analysis via CLI

**Prerequisites**: Phase 16 (Agent Core) complete

- [x] T088 [US6] Update src/cli.ts with --analyze flag ✅
  - New flags: --analyze, --max-steps N, --verbose
  - Runs CROAgent.analyze() and formats output

- [x] T089 [US6] Create src/output/agent-progress-formatter.ts ✅
  - Methods: formatAnalysisStart(), formatStepComplete(), formatAnalysisResult()
  - Shows step number, action, insights, timing

- [x] T090 [P] [US6] Create tests/unit/agent-progress-formatter.test.ts (6 tests) ✅
  - Tests for step formatting and result formatting

**Checkpoint**: `npm run start -- --analyze --max-steps 5 https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy` ✅

**Total Tests**: 6 tests (212 unit tests total)

---
