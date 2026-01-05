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
| **20a** | T147-T155 | 9 | foundations/ | Pending | 36 unit |
| **20b** | T156-T159 | 4 | dom/ meta & screenshot | Pending | 9 unit |
| **20c** | T160-T161 | 2 | dom/ landmarks | Pending | 8 unit |
| **20d** | T162-T166 | 5 | dom/ nodes & fingerprint | Pending | 23 unit |
| **20e** | T167-T172 | 6 | interactions/ links/forms/prices | Pending | 19 unit |
| **20f** | T173-T174 | 2 | visible/ constraints | Pending | 12 unit |
| **20g** | T175-T176 | 2 | dom/ assembly | Pending | 8 int |
| **20h** | T177-T181 | 5 | interactions/ actions | Pending | 15 unit |
| **20i** | T182-T186 | 5 | coverage/ capture & merge | Pending | 16 unit |
| **20j** | T187-T188 | 2 | coverage/ assembly | Pending | 6 int |
| **20k** | T189-T193 | 5 | context/ LLM prep | Pending | 6 unit + 4 int |
| **20l** | T194-T195 | 2 | Module Integration | Pending | 4 int |
| **20m** | T196-T200 | 5 | E2E Tests (original) | Pending | 15 e2e |
| **20n** | T201-T204 | 4 | Documentation | Pending | - |
| **20o** | T205-T212 | 8 | styles/ | Pending | 16 unit |
| **20p** | T213-T222 | 10 | network/ | Pending | 23 unit |
| **20q** | T223-T230 | 8 | storage/ | Pending | 20 unit |
| **20r** | T231-T240 | 10 | a11y/ | Pending | 21 unit |
| **20s** | T241-T248 | 8 | frames/ | Pending | 17 unit |
| **20t** | T249-T258 | 10 | vision/ | Pending | 22 unit |
| **20u** | T259-T264 | 6 | pipeline integration | Pending | 9 int |
| **20v** | T265-T274 | 10 | E2E full pipeline | Pending | 22 e2e |

**Total**: 312 tasks (177 complete, 135 pending)

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

---
