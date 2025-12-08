# Research: Browser Agent Core

**Feature**: `001-browser-agent-core`
**Date**: 2025-01-23
**Status**: Complete

## Purpose

This document captures technology decisions and their rationale made during the planning phase. Each decision includes alternatives considered and why the chosen approach was selected.

---

## Technology Decisions

### 1. Browser Automation Library

**Decision**: Playwright

**Rationale**:
- Modern async/await API designed for Node.js
- Built-in auto-waiting eliminates flaky tests
- Cross-browser support (Chromium, Firefox, WebKit)
- Excellent TypeScript support with full type definitions
- Active development and strong community

**Alternatives Considered**:

| Alternative | Why Rejected |
|-------------|--------------|
| Puppeteer | Chromium-only, less mature TypeScript support |
| Selenium | Older API, requires WebDriver setup, slower |
| Cypress | Primarily for testing, not general automation |

---

### 2. LLM Orchestration Framework

**Decision**: LangChain.js with OpenAI GPT-4o-mini

**Rationale**:
- Abstracts LLM provider details for easy model swapping
- Built-in retry logic and error handling
- Structured output parsing with Zod integration
- Active ecosystem with frequent updates
- GPT-4o-mini provides good balance of cost/performance

**Alternatives Considered**:

| Alternative | Why Rejected |
|-------------|--------------|
| Direct OpenAI SDK | No abstraction, harder to swap providers |
| Vercel AI SDK | Less mature, fewer features |
| Anthropic Claude direct | Single provider lock-in |

---

### 3. Schema Validation

**Decision**: Zod

**Rationale**:
- TypeScript-first with automatic type inference
- Runtime validation matches compile-time types
- Clean integration with LangChain for structured output
- `safeParse` for graceful error handling
- Native JSON Schema export in v4

**Alternatives Considered**:

| Alternative | Why Rejected |
|-------------|--------------|
| Joi | Less TypeScript integration |
| Yup | Weaker type inference |
| io-ts | More complex API |

---

### 4. Testing Framework

**Decision**: Vitest (unit/integration) + Playwright Test (e2e)

**Rationale**:
- Vitest: Fast, ESM-native, Jest-compatible API
- Playwright Test: Purpose-built for browser automation testing
- Both integrate well with TypeScript
- Parallel test execution support

**Alternatives Considered**:

| Alternative | Why Rejected |
|-------------|--------------|
| Jest | Slower, ESM support is complex |
| Mocha | Requires more configuration |
| AVA | Smaller community |

---

### 5. Runtime

**Decision**: Node.js 20.x LTS with TypeScript 5.x (strict mode)

**Rationale**:
- LTS version ensures long-term support
- Native ESM support
- TypeScript strict mode catches more errors at compile time
- Excellent async/await performance

**Alternatives Considered**:

| Alternative | Why Rejected |
|-------------|--------------|
| Deno | Smaller ecosystem, less library support |
| Bun | Still maturing, compatibility concerns |

---

### 6. Cookie Consent Handling Approach

**Decision**: CMP-specific selectors + text-based heuristics (best-effort)

**Rationale**:
- Known CMPs (OneTrust, Cookiebot, Usercentrics) cover 80%+ of sites
- Text heuristics ("accept", "allow", "agree") catch custom banners
- Best-effort approach prevents blocking on edge cases
- 2-3 second timeout prevents slowing down extraction

**Alternatives Considered**:

| Alternative | Why Rejected |
|-------------|--------------|
| Third-party service (e.g., I Don't Care About Cookies) | External dependency, privacy concerns |
| ML-based detection | Overkill for this use case, adds complexity |
| Manual configuration per site | Doesn't scale |

---

### 7. Wait Strategy

**Decision**: Hybrid (`load` event + configurable post-load wait)

**Rationale**:
- `networkidle` causes timeouts on many modern sites (infinite polling)
- `load` event is reliable but misses JS-rendered content
- Post-load wait (default 5s) allows JS frameworks to render
- Configurable via CLI for different site types

**Alternatives Considered**:

| Alternative | Why Rejected |
|-------------|--------------|
| `networkidle` only | Too many timeouts on SPAs |
| `domcontentloaded` only | Misses async content |
| Fixed wait only | Wasteful for simple sites |

---

## Open Questions (Resolved)

All questions from planning have been resolved:

1. **Q: Which browser type to use?**
   - A: Chromium (most compatible, best DevTools)

2. **Q: Headless or visible mode default?**
   - A: Visible (aids debugging, per CR-001)

3. **Q: How to handle authentication?**
   - A: Out of scope for v1 (CR-004)

---

## References

- [Playwright Documentation](https://playwright.dev/)
- [LangChain.js Documentation](https://js.langchain.com/)
- [Zod Documentation](https://zod.dev/)
- [Vitest Documentation](https://vitest.dev/)
