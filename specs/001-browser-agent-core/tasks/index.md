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

| Phases | Description | File |
|--------|-------------|------|
| 1-9 | Setup, Foundation, US1-4, Orchestrator, E2E, Polish | [phases-01-09.md](./phases-01-09.md) |
| 10-12, 12b, 12c | Bug Fixes, Wait Strategy, Cookie Consent, Enhanced Detection, Peregrine Fix | [phases-10-12.md](./phases-10-12.md) |
| 13-14 | Core Models, Agent Models, DOM Extraction | [phases-13-14.md](./phases-13-14.md) |
| 15-16 | Tool System, Agent Core | [phases-15-16.md](./phases-15-16.md) |
| 17 | Navigation, Analysis, Control Tools + Summary | [phase-17.md](./phase-17.md) |
| 18 | Models, Heuristics, Output, Agent Integration, CLI | [phase-18.md](./phase-18.md) |
| 19 | Coverage System (Models, DOM, Agent, Prompts, CLI, Testing) | [phase-19.md](./phase-19.md) |
| 20 | Unified Extraction Pipeline (10 modules) | [phase-20.md](./phase-20.md) |
| 21 | PDP Heuristics (PageType + 35 rules) | [phase-21.md](./phase-21.md) |

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
| **20A** | T147-T158 | 12 | Framework-agnostic detection | Pending | 25 unit |
| **20B** | T159-T170 | 12 | Extended CRO types | Pending | 15 unit |
| **20C** | T171-T180 | 10 | Multi-strategy selectors | Pending | 23 unit |
| **20D** | T181-T192 | 12 | LLM DOM classification | Pending | 22 unit |
| **20E** | T193-T202 | 10 | Visibility & context | Pending | 20 unit |
| **20-Int** | T203-T206 | 4 | Integration & E2E | Pending | 3 e2e |
| **21a** | T285-T292 | 8 | PageType Detection | ✅ Complete | 35+ unit |
| **21b** | T293-T306 | 14 | Heuristics Knowledge Base | ✅ Complete | 25 unit |
| **21c** | T307-T313 | 7 | CRO Vision Analyzer | ✅ Complete | 44 unit |
| **21d** | T314-T320 | 7 | Vision Integration | Pending | 23+ int |

**Total**: 298 tasks (231 complete, 67 pending)
- Phase 20: 60 tasks (hybrid extraction)
- Phase 21d: 7 tasks (vision integration)

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

**Incremental CLI Milestones**:
- Phase 14b: `npm run start -- --cro-extract <url>` → Show CRO elements ✅
- Phase 15b: `npm run start -- --cro-extract --tool <name> <url>` → Run specific tool ✅
- Phase 16-CLI: `npm run start -- --analyze <url>` → Full agent loop ✅
- Phase 18-CLI: `npm run start -- <url>` → CRO analysis as default ✅
- Phase 19: `npm run start -- --scan-mode=full_page <url>` → 100% page coverage ✅
- Phase 20: Unified extraction pipeline - 10 modules, 128 tasks, 351 tests (pending)
- Phase 21d: `npm run start -- --vision <url>` → GPT-4o Vision heuristic analysis (pending)

---
