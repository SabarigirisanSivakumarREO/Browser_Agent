# Implementation Plan: Browser Agent Core

**Branch**: `001-browser-agent-core` | **Date**: 2025-01-23 | **Spec**: [../spec/index.md](../spec/index.md)

> **Change Request 001 (2026-01-29)**: Architecture simplification approved.
> See: [../CHANGE-REQUEST-001.md](../CHANGE-REQUEST-001.md)

---

## Quick Navigation

| Section | Description | File |
|---------|-------------|------|
| Overview | Instructions, Summary, Technical Context, Constitution | [overview.md](./overview.md) |
| Architecture | Project Structure, Module Architecture (1-5) | [architecture.md](./architecture.md) |
| Dependencies | Dependencies, Test Strategy, Complexity Tracking | [dependencies.md](./dependencies.md) |
| Phase 13-15 | CRO Agent Architecture, Modules 6-12 | [phase-13-15.md](./phase-13-15.md) |
| Phase 16 | Agent Core Implementation | [phase-16.md](./phase-16.md) |
| Phase 17 | CRO Tools Implementation | [phase-17.md](./phase-17.md) |
| Phase 18 | Heuristics & Post-Processing | [phase-18.md](./phase-18.md) |
| Phase 19 | 100% Page Coverage System | [phase-19.md](./phase-19.md) |
| ~~Phase 20~~ | ~~Hybrid Extraction Pipeline~~ | [phase-20.md](./phase-20.md) | **DEFERRED** |
| Phase 21 | Vision + Evidence + Mapping | [phase-21.md](./phase-21.md) |
| **Phase 21j** | **CLI Vision Agent Fix** | [phase-21j.md](./phase-21j.md) |
| **Phase 22** | **Page Type Knowledge Bases** | [phase-22.md](./phase-22.md) |

---

## Phase Summary

| Phase | Focus | Key Deliverables | Status |
|-------|-------|------------------|--------|
| 1-12 | Foundation | Browser automation, heading extraction, LangChain, cookie consent | ✅ |
| 13-15 | CRO Models & DOM | Core models, DOM extraction, tool system | ✅ |
| 16 | Agent Core | PromptBuilder, MessageManager, StateManager, CROAgent | ✅ |
| 17 | CRO Tools | 11 tools (navigation, analysis, control) | ✅ |
| 18 | Heuristics | 10 rules, business type detection, hypothesis generation | ✅ |
| 19 | Coverage | 100% page coverage, DOMMerger, coverage tracking | ✅ |
| ~~20~~ | ~~Hybrid~~ | ~~Framework-agnostic detection, LLM classification~~ | **DEFERRED** |
| 21a-d | Vision Core | PageType detection, knowledge base, vision analyzer | ✅ |
| ~~21e-f~~ | ~~Multi-Viewport~~ | ~~Full-page vision, screenshot modes~~ | ✅ REMOVED (CR-001) |
| ~~21g~~ | ~~Vision Agent~~ | ~~DOM + Vision agent loop~~ | ✅ MERGED (CR-001) |
| **CR-001** | **Architecture Refactor** | **Unified CRO Agent, category-based analysis** | ✅ Complete |
| 21h | Evidence | 5 evidence fields, screenshot saving | ✅ Complete |
| 21i | Mapping | Coordinate transformation, screenshot annotation | ✅ Complete |
| **21j** | **CLI Fix** | **Fix --vision-agent to use CROAgent unified mode** | 📋 NEXT |
| **22** | **Page Types** | **PLP, Homepage, Cart, Checkout, Generic KBs** | 📋 Pending |

## Related Files

- [Spec Index](../spec/index.md) - Feature specification
- [Tasks Index](../tasks/index.md) - Implementation tasks
- [Data Model](../data-model.md) - TypeScript interfaces
- [Quickstart](../quickstart.md) - Usage guide
