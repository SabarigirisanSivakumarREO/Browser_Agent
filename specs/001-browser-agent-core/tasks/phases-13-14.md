**Navigation**: [Index](./index.md) | [Previous](./phases-10-12.md) | [Next](./phases-15-16.md)

---

## Phase 13a: Core Models (US6, US7)

**Purpose**: Define foundational TypeScript interfaces for CRO Agent

- [x] T054 [US6] Create src/models/dom-tree.ts
  - Export: BoundingBox, CROType, CROClassification, DOMNode, DOMTree
- [x] T055 [US6] Create src/models/page-state.ts
  - Export: ViewportInfo, ScrollPosition, PageState
- [x] T056 [US7] Create src/models/cro-insight.ts
  - Export: Severity, Evidence, InsightCategory, CROInsight, CROInsightSchema (Zod)
- [x] T060 [US6] Create src/models/tool-definition.ts
  - Export: ToolResult, ToolDefinition, CROActionNames, CROActionName
- [x] T063a [US6] Create src/models/index.ts with all Phase 13a exports
- [x] T064a [P] [US6] Create tests/unit/models.test.ts (24 tests)

**Checkpoint**: All models compile, Zod schemas validate correctly

---

## Phase 13b: Agent Models (US6, US7)

**Purpose**: Agent state, memory, and output parsing

- [x] T057 [US6] Create src/models/agent-output.ts
  - Export: CROAgentOutputSchema, CROAgentOutput, ParseResult, parseAgentOutput()
- [x] T058 [US6] Create src/models/agent-state.ts
  - Export: CROAgentOptions, DEFAULT_CRO_OPTIONS, AgentState, createInitialState()
- [x] T059 [US6] Create src/models/cro-memory.ts
  - Export: StepRecord, CROMemory, createInitialMemory()
- [x] T063b [US6] Update src/models/index.ts with Phase 13b exports
- [x] T064b [P] [US6] Create tests/unit/agent-models.test.ts (33 tests)

**Checkpoint**: Agent models compile, parser handles valid/invalid JSON

---

## Phase 14: DOM Extraction Pipeline (US6)

**Purpose**: Build DOM extraction with CRO classification

- [x] T065 [US6] Create src/browser/dom/cro-selectors.ts
  - Export: CRO_SELECTORS, INTERACTIVE_TAGS, INTERACTIVE_ROLES, SKIP_TAGS, MAX_TEXT_LENGTH
- [x] T066 [US6] Create src/browser/dom/build-dom-tree.ts
  - Export: RawDOMNode, RawDOMTree, generateDOMTreeScript, DOM_TREE_SCRIPT
  - Injectable script with XPath, visibility, interactivity, CRO classification
- [x] T067 [US6] Create src/browser/dom/extractor.ts
  - Export: DOMExtractor, DOMExtractorOptions
  - extract(page): Promise<DOMTree>
- [x] T068 [US6] Create src/browser/dom/serializer.ts
  - Export: DOMSerializer, DOMSerializerOptions, SerializationResult
  - Token budget tracking with 60% warning (CR-013)
- [x] T069 [US6] Create src/browser/dom/index.ts with all Phase 14 exports
- [x] T070 [P] [US6] Create tests/unit/dom-extraction.test.ts (35 tests)
- [x] T071 [US6] Create tests/integration/dom-extraction.test.ts (14 tests)

**Checkpoint**: DOM extraction captures >90% visible interactive elements (SC-008)

---

## Phase 14b: CLI Integration - DOM Extraction (US6) **[COMPLETE]**

**Purpose**: Wire DOM extraction into CLI for immediate testing

- [x] T072a [US6] Create src/output/cro-element-formatter.ts
  - formatCROElements(domTree: DOMTree): string
  - Group by CRO type (CTAs, forms, trust, value_prop, navigation)
  - Show element count, text preview, xpath
- [x] T072b [US6] Update src/cli.ts with --cro-extract flag
  - When flag present: run DOMExtractor instead of HeadingExtractor
  - Output CRO elements via new formatter
- [x] T072c [US6] Test DOM extraction on real sites via CLI

**Checkpoint**: `npm run start -- --cro-extract https://carwale.com` shows CRO elements ✅

**Test command**: `npm run start -- --cro-extract https://www.carwale.com/`

---
