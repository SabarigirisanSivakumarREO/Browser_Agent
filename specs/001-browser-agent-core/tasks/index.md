# Tasks: Browser Agent Core

**Input**: Design documents from `/specs/001-browser-agent-core/`
**Prerequisites**: plan/ directory (required), spec/ directory (required), data-model.md (required)

**Tests**: Integration and E2E tests included as specified in SC-006.

**Organization**: Tasks grouped by user story for independent implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)

---

## Quick Navigation

| Phases | Description | File | Status |
|--------|-------------|------|--------|
| 1-9 | Setup, Foundation, US1-4, Orchestrator, E2E, Polish | [phases-01-09.md](./phases-01-09.md) | ✅ |
| 10-12, 12b, 12c | Bug Fixes, Wait Strategy, Cookie Consent, Enhanced Detection | [phases-10-12.md](./phases-10-12.md) | ✅ |
| 13-14 | Core Models, Agent Models, DOM Extraction | [phases-13-14.md](./phases-13-14.md) | ✅ |
| 15-16 | Tool System, Agent Core | [phases-15-16.md](./phases-15-16.md) | ✅ |
| 17 | Navigation, Analysis, Control Tools + Summary | [phase-17.md](./phase-17.md) | ✅ |
| 18 | Models, Heuristics, Output, Agent Integration, CLI | [phase-18.md](./phase-18.md) | ✅ |
| 19 | Coverage System (Models, DOM, Agent, Prompts, CLI, Testing) | [phase-19.md](./phase-19.md) | ✅ |
| ~~20~~ | ~~Unified Extraction Pipeline (DEFERRED)~~ | [phase-20.md](./phase-20.md) | **DEFERRED** |
| 21 | PDP Heuristics (PageType + 35 rules) | [phase-21.md](./phase-21.md) | Partial |
| **CR-001** | **Architecture Refactor (remove modes, merge agents)** | [cr-001-refactor.md](./cr-001-refactor.md) | ✅ Complete |
| **21j** | **CLI Vision Agent Fix (use CROAgent unified mode)** | [phase-21j.md](./phase-21j.md) | ⏳ 6/8 complete |
| **21l** | **Default Evidence & Mapping (flip defaults)** | [phase-21l.md](./phase-21l.md) | ⏳ 7/9 (T391-T397 done) |
| **22** | **Page Type Knowledge Bases (PLP, Homepage, Cart, Checkout, Generic)** | [phase-22.md](./phase-22.md) | ⏳ 22A ✅, 22B-E 📋 |
| **23** | **LLM Input Capture (DOM, screenshots, prompts)** | [phase-23.md](./phase-23.md) | ✅ Complete (9 tasks) |
| **24** | **Hybrid LLM Page Type Detection** | [phase-24.md](./phase-24.md) | ✅ Complete (23 tasks, 55 tests) |
| **25** | **Enhanced Extraction & Screenshot Analysis** | [phase-25.md](./phase-25.md) | ✅ Complete |
| **26** | **LLM Analysis Optimization** | [phase-26.md](./phase-26.md) | ✅ Complete (28 tasks, 56 tests) |
| **27** | **Analysis Quality & Annotation Fix** | [phase-27.md](./phase-27.md) | ✅ Complete (25 tasks, ~59 tests) |

---

## Task Summary

| Phase | Tasks | Count | Purpose | Status | Tests |
|-------|-------|-------|---------|--------|-------|
| 1 | T001-T008 | 8 | Project setup | ✅ Complete | - |
| 2 | T009-T011 | 3 | Utilities | ✅ Complete | - |
| 3 | T012-T016 | 5 | URL loading (US1) | ✅ Complete | Unit + Integration |
| 4 | T017-T019 | 3 | Extraction (US2) | ✅ Complete | Unit |
| 5 | T020-T022 | 3 | LangChain (US3) | ✅ Complete | Integration |
| 6 | T023-T025 | 3 | Output (US4) | ✅ Complete | Unit |
| 7 | T026-T028 | 3 | Orchestrator | ✅ Complete | - |
| 8 | T029 | 1 | E2E tests | ✅ Complete | E2E |
| 9 | T030-T035 | 6 | Polish | ✅ Complete | - |
| 10 | T036-T039 | 4 | Bug fixes | ✅ Complete | - |
| 11 | T040-T044 | 5 | Wait strategy | ✅ Complete | - |
| 12 | T045-T053 | 9 | Cookie consent (US5) | ✅ Complete | Integration |
| **12b** | T275-T281 | 7 | **Enhanced cookie detection** | ✅ Complete | 17 unit |
| **12c** | T282-T284 | 3 | **Peregrine cookie banner fix** | ✅ Complete | 12 integration |
| 13a | T054-T056, T060, T063a, T064a | 6 | Core models | ✅ Complete | 24 unit |
| 13b | T057-T059, T063b, T064b | 5 | Agent models | ✅ Complete | 33 unit |
| 14 | T065-T071 | 7 | DOM extraction | ✅ Complete | 35 unit + 14 int |
| 14b | T072a-T072c | 3 | CLI: DOM extraction | ✅ Complete | - |
| **15** | T073-T077 | 5 | **Tool system** | ✅ Complete | 20 unit |
| **15b** | T077a-T077e | 5 | **CLI: Tool execution** | ✅ Complete | 5 unit |
| **16** | T078-T087 | 12 | **Agent core** | ✅ Complete | 70 unit + 18 int + 8 e2e |
| **16-CLI** | T088-T090 | 3 | **CLI: Agent loop** | ✅ Complete | 6 unit |
| **17a** | T091-T093a | 4 | Navigation tools (3) | ✅ Complete | 21 unit |
| **17b** | T094-T098a | 6 | Analysis tools (5) | ✅ Complete | 51 unit |
| **17c** | T099-T103 | 6 | Control + Integration | ✅ Complete | 9 unit + 18 int |
| **18a** | T104-T105a | 3 | Models & Types | ✅ Complete | 8 unit |
| **18b** | T106-T106d | 5 | Heuristic Engine Core | ✅ Complete | 26 unit |
| **18c** | T107a-T111c | 11 | 10 Heuristic Rules | ✅ Complete | 22 unit |
| **18d** | T112-T116a | 6 | Output Generation | ✅ Complete | 21 unit |
| **18e** | T117-T118 | 4 | Agent Integration | ✅ Complete | 21 int |
| **18f** | T118a-T118b | 2 | Test Fixtures | ✅ Complete | - |
| **18-CLI** | T119-T122 | 6 | CLI: Final Integration | ✅ Complete | 2 unit + 4 e2e |
| **19a** | T126-T129 | 4 | Coverage Models & Tracker | ✅ Complete | 16 unit |
| **19b** | T130-T133 | 4 | DOM Changes | ✅ Complete | 7 unit |
| **19c** | T134-T138 | 5 | Agent Integration | ✅ Complete | - |
| **19d** | T139-T140 | 2 | Prompt Updates | ✅ Complete | - |
| **19e** | T141-T142 | 2 | CLI & Config | ✅ Complete | 1 unit |
| **19f** | T143-T146 | 4 | Testing & Polish | ✅ Complete | 11 int + 4 e2e |
| ~~**20A**~~ | ~~T147-T158~~ | ~~12~~ | ~~Framework-agnostic detection~~ | **DEFERRED** | - |
| ~~**20B**~~ | ~~T159-T170~~ | ~~12~~ | ~~Extended CRO types~~ | **DEFERRED** | - |
| ~~**20C**~~ | ~~T171-T180~~ | ~~10~~ | ~~Multi-strategy selectors~~ | **DEFERRED** | - |
| ~~**20D**~~ | ~~T181-T192~~ | ~~12~~ | ~~LLM DOM classification~~ | **DEFERRED** | - |
| ~~**20E**~~ | ~~T193-T202~~ | ~~10~~ | ~~Visibility & context~~ | **DEFERRED** | - |
| ~~**20-Int**~~ | ~~T203-T206~~ | ~~4~~ | ~~Integration & E2E~~ | **DEFERRED** | - |
| **21a** | T285-T292 | 8 | PageType Detection | ✅ Complete | 35+ unit |
| **21b** | T293-T306 | 14 | Heuristics Knowledge Base | ✅ Complete | 25 unit |
| **21c** | T307-T313 | 7 | CRO Vision Analyzer | ✅ Complete | 44 unit |
| **21d** | T314-T320 | 7 | Vision Integration | ✅ Complete | 23+ int |
| ~~**21e**~~ | ~~T321-T328~~ | ~~8~~ | ~~Multi-Viewport Vision~~ | ✅ REMOVED (CR-001) | - |
| ~~**21f**~~ | ~~T329-T334~~ | ~~6~~ | ~~Full-Page Screenshot~~ | ✅ REMOVED (CR-001) | - |
| ~~**21g**~~ | ~~T335-T352~~ | ~~18~~ | ~~Vision Agent Loop~~ | ✅ MERGED (CR-001) | 91 unit |
| **CR-001** | T500-T522 | 23 | Architecture Refactor | ✅ Complete | 51 unit |
| **21h** | T353-T365 | 14 | Evidence Capture | ✅ Complete | 49 unit |
| **21i** | T366-T382 | 17 | DOM-Screenshot Mapping | ✅ Complete | 88 unit |
| **21j** | T383-T390 | 8 | CLI Vision Agent Fix | ⏳ 6/8 | 20 unit |
| **21l** | T391-T399 | 9 | Default Evidence & Mapping | ⏳ 7/9 | 9 unit |
| **22A** | T578-T587 | 10 | PLP Knowledge Base | ✅ Complete | 15 unit |
| **22B-E** | T588-T615 | 28 | Homepage, Cart, Checkout, Generic KBs | 📋 Pending | ~28 unit |
| **23** | T400-T408 | 9 | LLM Input Capture | ✅ Complete | 18 (13 unit + 5 int) |
| **24** | T450-T472 | 23 | Hybrid LLM Page Type Detection | ✅ Complete | 55 (39 unit + 9 int + 7 E2E) |
| **25a** | T473-T476 | 4 | Dynamic Collection Steps | ✅ Complete | 14 unit |
| **25b** | T477-T484 | 8 | Enhanced DOM Selectors | ✅ Complete | 41 unit |
| **25c** | T485-T488 | 4 | Structured Data Extraction | ✅ Complete | 17 unit |
| **25d** | T489-T492 | 4 | Above-Fold Annotation | ✅ Complete | 22 unit |
| **25e** | T493-T498 | 6 | Tiled Screenshot Mode | ✅ Complete | 9 int |
| **25f** | T499-T502 | 4 | Deterministic Collection | ✅ Complete | 10 int + 11 E2E |
| **25g-i** | T503-T548 | 46 | Evidence + Metrics + Hybrid Collection | ✅ Complete | ~35 tests |
| **26a** | T550-T555 | 6 | Parallel Category Analysis | ✅ Complete | 6 unit |
| **26b** | T556-T563 | 8 | Category Batching | ✅ Complete | 7+8 unit, 2 int |
| **26c** | T564-T568 | 5 | Intelligent Viewport Filtering | ✅ Complete | 13 unit, 2 int |
| **26e** | T569-T574 | 6 | Quality Validation (CI-only) | ✅ Complete | 12 unit, 2 int |
| **26f** | T575-T577 | 3 | Cross-cutting E2E Tests | ✅ Complete | 4 E2E |
| **27A** | T616-T618 | 3 | Model Default & Centralization | ✅ Complete | 3 unit |
| **27B** | T619-T622 | 4 | Structured Element Refs | ✅ Complete | 10 unit |
| **27C** | T623-T624 | 2 | Prompt Strengthening | ✅ Complete | 5 unit |
| **27D** | T625-T627 | 3 | Confidence Threshold Filtering | ✅ Complete | 7 unit |
| **27E** | T628-T629 | 2 | Deduplication Fix | ✅ Complete | 4 unit |
| **27F** | T630-T632 | 3 | Annotation Pipeline Fix | ✅ Complete | 7 unit |
| **27G** | T633-T634 | 2 | DOM Cross-Validation | ✅ Complete | 5 unit |
| **27H** | T635-T640 | 6 | Annotation Overlay Rendering Fix | ✅ Complete | 8 unit |

**Total after Phase 22A**: 525 complete + ~28 pending (excluding deferred Phase 20)
- Phase 20: 60 tasks **DEFERRED** (moved to backlog)
- CR-001: 23 tasks ✅ **COMPLETE** (remove modes, merge agents, refactor)
- Phase 21h: 14 tasks ✅ **COMPLETE** (evidence capture)
- Phase 21i: 17 tasks ✅ **COMPLETE** (DOM-screenshot mapping)
- Phase 21j: 8 tasks ✅ **COMPLETE** (CLI vision agent fix)
- Phase 21l: 9 tasks ✅ **COMPLETE** (default evidence & mapping)
- Phase 22A: 10 tasks ✅ **COMPLETE** (PLP Knowledge Base — 25 heuristics, 15 tests)
- Phase 22B-E: 28 tasks 📋 **NEXT** (Homepage, Cart, Checkout, Generic KBs)
- Phase 23: 9 tasks ✅ **COMPLETE** (LLM input capture)
- Phase 24: 23 tasks ✅ **COMPLETE** (Hybrid LLM page type detection)
- Phase 25: 76 tasks ✅ **COMPLETE** (Enhanced extraction & screenshot analysis)
- Phase 26: 28 tasks ✅ **COMPLETE** (LLM Analysis Optimization - parallel, batching, viewport filtering, CI-only quality validation)
- Phase 27: 25 tasks ✅ **COMPLETE** (Analysis Quality & Annotation Fix — model defaults, structured refs, prompts, confidence, dedup, annotation pipeline, cross-validation, overlay rendering)

---

## Test Count Verification

**Last Verified**: 2026-01-30

| Category | Planned | Actual | Status |
|----------|---------|--------|--------|
| Unit Tests | 600+ | 650+ | ✓ |
| Integration Tests | 100+ | 110+ | ✓ |
| E2E Tests | 20+ | 22 | ✓ |
| **Total** | **720+** | **782** | ✓ |

**Test Files**: 41 (36 passing, 5 with failures)
**Test Cases**: 782 (773 passing, 9 failing)

*Note: 9 failing tests are URL normalization issues (trailing slash expectations) unrelated to core functionality.*

---

## Phase 18 Structure

- 18a: Models & Types (T104-T105a) - 3 tasks, 8 tests
- 18b: Heuristic Engine Core (T106-T106d) - 5 tasks, 22 tests
- 18c: Heuristic Rules (T107a-T111c) - 11 tasks, 20 tests
- 18d: Output Generation (T112-T116a) - 6 tasks, 20 tests
- 18e: Agent Integration (T117-T118) - 4 tasks, 12 integration tests
- 18f: Test Fixtures (T118a-T118b) - 2 tasks, 0 tests (fixtures)
- 18-CLI: Final Integration (T119-T122) - 6 tasks, 10 tests

**Phase 18 Test Totals**: 88 tests (76 unit + 12 integration)

---

## Implementation Notes

**Implementation details in plan.md** - tasks.md is task definitions only

**Current Priority**:
1. Phase 27: Analysis Quality & Annotation Fix (19 tasks) ⏳ **IN PROGRESS**
2. Phase 22B-E: Page type knowledge bases (28 tasks remaining) 📋 **NEXT**

**Completed Quality Fixes** (not phase-tracked):
- Element Mapping in LLM Prompts (2026-02-12): `<element_positions>` block + `populateElementRefs()` — 19 tests

**Deferred**:
- Phase 20: Unified extraction pipeline (60 tasks) - moved to backlog

**CLI Milestones**:
- Phases 1-19: All complete ✅
- After CR-001: `npm run start -- --vision <url>` → Unified CRO + Vision analysis
- After Phase 21h: `npm run start -- --vision --save-evidence <url>` → With evidence
- After Phase 21i: `npm run start -- --vision --annotate-screenshots <url>` → With annotations
- After Phase 21l: `npm run start -- --vision <url>` → Evidence + annotations **by default**
- After Phase 23: `npm run start -- --vision <url>` → Also saves LLM inputs to `./llm-inputs/`

---
