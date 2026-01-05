# Implementation Plan: Browser Agent Core

> **This file has been split into multiple files for better organization.**
>
> Please see the [plan/index.md](./plan/index.md) for the full plan.

---

## Quick Links

| Section | File |
|---------|------|
| **Index & Overview** | [plan/index.md](./plan/index.md) |
| **Overview** | [plan/overview.md](./plan/overview.md) |
| **Architecture** | [plan/architecture.md](./plan/architecture.md) |
| **Dependencies** | [plan/dependencies.md](./plan/dependencies.md) |
| **Phase 13-15: CRO Agent** | [plan/phase-13-15.md](./plan/phase-13-15.md) |
| **Phase 16: Agent Core** | [plan/phase-16.md](./plan/phase-16.md) |
| **Phase 17: CRO Tools** | [plan/phase-17.md](./plan/phase-17.md) |
| **Phase 18: Heuristics** | [plan/phase-18.md](./plan/phase-18.md) |
| **Phase 19: Coverage** | [plan/phase-19.md](./plan/phase-19.md) |
| **Phase 20: Pipeline** | [plan/phase-20.md](./plan/phase-20.md) |

---

## Summary

- **Branch**: `001-browser-agent-core`
- **Language**: Node.js 20.x LTS with TypeScript 5.x (strict mode)
- **Primary Dependencies**: Playwright, LangChain.js, OpenAI SDK
- **Testing**: Vitest (unit), Playwright Test (integration/e2e)
- **Phases**: 20 total (Foundation through Unified Pipeline)
