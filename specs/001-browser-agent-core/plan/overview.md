# Plan Overview

**Navigation**: [Index](./index.md) | [Architecture](./architecture.md)

---

## Claude Code Instructions

Keep it concise. Compromise on grammar. Clear, to the point. No fluff.

## Summary

Build a browser automation agent using Node.js/TypeScript that navigates to URLs via Playwright, extracts heading elements (h1-h6), processes them through LangChain with OpenAI GPT-4o-mini for insights, and outputs structured results to the console. The architecture follows a modular design with five core modules: Browser (including cookie consent handling), Extraction, LangChain, Output, and Orchestrator.

## Technical Context

**Language/Version**: Node.js 20.x LTS with TypeScript 5.x (strict mode)
**Primary Dependencies**: Playwright (Chromium), LangChain.js, OpenAI SDK
**Storage**: N/A (stateless processing)
**Testing**: Vitest for unit tests, Playwright Test for integration/e2e
**Target Platform**: Windows/Linux/macOS (Node.js runtime)
**Project Type**: Single project (CLI tool)
**Performance Goals**: Page load within 60s, LangChain processing within 10s
**Constraints**: 40-60% context utilization, visible browser mode, graceful error handling
**Scale/Scope**: Single URL or sequential multi-URL processing
**Out of Scope**: Authentication/login handling (CR-004) - agent will not handle login flows

## Constitution Check

*GATE: Must pass before implementation. All 8 principles verified.*

| Principle | Compliance | Implementation |
|-----------|------------|----------------|
| I. Code Quality | ✅ | Single responsibility modules, clear naming |
| II. TypeScript First | ✅ | Strict mode, explicit types, interfaces for contracts |
| III. Playwright | ✅ | Primary browser automation, built-in selectors, auto-wait |
| IV. Error Handling | ✅ | Try-catch at each stage, structured JSON logging |
| V. Async/Await | ✅ | Consistent async patterns, proper await chains |
| VI. Context Efficiency | ✅ | Modular code, concise responses, 40-60% target |
| VII. Modular Design | ✅ | 4 isolated modules with dependency injection |
| VIII. Documentation | ✅ | JSDoc on public APIs, inline comments |
