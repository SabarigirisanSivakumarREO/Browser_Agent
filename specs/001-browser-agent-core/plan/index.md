# Implementation Plan: Browser Agent Core

**Branch**: `001-browser-agent-core` | **Date**: 2025-01-23 | **Spec**: [../spec/index.md](../spec/index.md)

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
| Phase 20 | Hybrid Extraction Pipeline | [phase-20.md](./phase-20.md) |
| Phase 21 | PDP Heuristics (35 rules) | [phase-21.md](./phase-21.md) |

---

## Phase Summary

| Phase | Focus | Key Deliverables |
|-------|-------|------------------|
| 1-12 | Foundation | Browser automation, heading extraction, LangChain, cookie consent |
| 13-15 | CRO Models & DOM | Core models, DOM extraction, tool system |
| 16 | Agent Core | PromptBuilder, MessageManager, StateManager, CROAgent |
| 17 | CRO Tools | 11 tools (navigation, analysis, control) |
| 18 | Heuristics | 10 rules, business type detection, hypothesis generation |
| 19 | Coverage | 100% page coverage, DOMMerger, coverage tracking |
| 20 | Hybrid | Framework-agnostic detection, LLM classification, multi-strategy selectors |
| 21 | PDP Heuristics | PageType detection, 35 PDP-specific rules |

## Related Files

- [Spec Index](../spec/index.md) - Feature specification
- [Tasks Index](../tasks/index.md) - Implementation tasks
- [Data Model](../data-model.md) - TypeScript interfaces
- [Quickstart](../quickstart.md) - Usage guide
