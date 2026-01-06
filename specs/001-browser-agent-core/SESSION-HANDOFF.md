# Session Handoff - CRO Browser Agent

**Last Updated**: 2026-01-06

---

## Project Overview

**Browser Agent** is a TypeScript-based CRO (Conversion Rate Optimization) analysis tool that uses:
- **Playwright** for browser automation
- **GPT-4o** for intelligent website analysis via observe→reason→act loop
- **GPT-4o Vision** for screenshot-based heuristic evaluation (Phase 21)
- **Zod** for runtime validation
- **LangChain** for LLM orchestration

### Primary Purpose
Automatically analyze websites for CRO issues (CTAs, forms, trust signals, value propositions, navigation) and generate actionable insights with A/B test hypotheses.

---

## Current State

**Phase**: Phase 21 Complete ✅ | Phase 20 Planned 📋
**Status**: 267/339 tasks complete (Phases 1-19, 12b, 12c, 21 done)
**Tests**: 560+ tests passing

### COMPLETED: Phase 21 (Vision-Based CRO Heuristics)

**All tasks complete** (T285-T320, 36 tasks, 148+ tests):
- ✅ Phase 21a: PageType Detection (8 tasks)
- ✅ Phase 21b: Heuristics Knowledge Base (14 tasks, 35 PDP heuristics)
- ✅ Phase 21c: CRO Vision Analyzer (7 tasks, 44 tests)
- ✅ Phase 21d: Integration (7 tasks, 44+ tests)

**Vision analysis now available**:
```bash
# Run with vision analysis (enabled by default for PDP pages)
npm run start -- https://www.peregrineclothing.co.uk/products/lynton-polo-shirt

# Use faster/cheaper model
npm run start -- --vision-model=gpt-4o-mini https://example.com/product

# Disable vision analysis
npm run start -- --no-vision https://example.com
```

### NEXT ACTION: Phase 20 (Unified Extraction Pipeline)

**Scope**: 58 tasks, 181 tests planned
- Layer 0: Types, schemas, budgets, multi-strategy selectors
- Layer 1: PageSnapshot with constraint detection
- Layer 2: PageCoverage with fingerprint deduplication
- Layer 3: LLM context preparation

**Spec Kit References**:
- Requirements: `spec/requirements-phase19-20.md`
- Tasks: `tasks/phase-20.md`
- Plan: `plan/phase-20.md`

---

## Phase 21 Architecture (Vision-Based CRO)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VISION-BASED CRO HEURISTICS SYSTEM                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. PAGE TYPE DETECTION (Phase 21a - COMPLETE ✅)                           │
│     PageState → PageTypeDetector → PageType ('pdp', 'plp', etc.)            │
│                                                                             │
│  2. KNOWLEDGE BASE (Phase 21b - COMPLETE ✅)                                │
│     src/heuristics/knowledge/pdp/*.json (35 heuristics in 10 categories)    │
│     loadHeuristics('pdp') → PageTypeHeuristics                              │
│                                                                             │
│  3. VISION ANALYZER (Phase 21c - COMPLETE ✅)                               │
│     Screenshot + PageType + Viewport                                        │
│           │                                                                 │
│           ▼                                                                 │
│     CROVisionAnalyzer.analyze()                                             │
│           │                                                                 │
│           ├── loadHeuristics() → 35 PDP heuristics                          │
│           ├── buildVisionPrompt() → Prompt with heuristics context          │
│           ├── callVisionAPI() → GPT-4o Vision                               │
│           ├── parseVisionResponse() → HeuristicEvaluation[]                 │
│           └── transformToInsights() → CROInsight[]                          │
│                                                                             │
│  4. INTEGRATION (Phase 21d - COMPLETE ✅)                                   │
│     - PageState.visionAnalysis ← CROVisionAnalysisResult                    │
│     - Screenshot capture via Playwright page.screenshot()                   │
│     - CLI flags: --vision, --no-vision, --vision-model                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start Commands

```bash
# Install dependencies
npm install

# Type check
npx tsc --noEmit

# Run all tests
npm test

# Run specific test suites
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests
npm run test:e2e           # E2E tests

# Run vision analyzer tests
npx vitest run tests/unit/vision-analyzer.test.ts

# Run CRO analysis
npm run start -- https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy
```

---

## Key Files for Phase 21d

| File | Purpose |
|------|---------|
| `src/heuristics/vision/analyzer.ts` | CROVisionAnalyzer class (DONE) |
| `src/heuristics/vision/types.ts` | Vision types (DONE) |
| `src/heuristics/vision/prompt-builder.ts` | Prompt construction (DONE) |
| `src/heuristics/vision/response-parser.ts` | Response parsing (DONE) |
| `src/heuristics/knowledge/index.ts` | loadHeuristics() (DONE) |
| `src/browser/browser-manager.ts` | Has getPage() for screenshot |
| `src/agent/cro-agent.ts` | Needs screenshot capture + vision call |
| `src/models/page-state.ts` | Needs visionAnalysis field |

---

## Vision Analyzer Usage

```typescript
import {
  createCROVisionAnalyzer,
  loadHeuristics,
  PageTypeDetector
} from './heuristics/index.js';

// 1. Detect page type
const pageTypeDetector = new PageTypeDetector();
const pageTypeResult = pageTypeDetector.detect(pageState);

// 2. If PDP, run vision analysis
if (pageTypeResult.type === 'pdp') {
  const analyzer = createCROVisionAnalyzer({ model: 'gpt-4o' });

  // Need screenshot from Playwright
  const screenshot = await page.screenshot({ type: 'png' });
  const screenshotBase64 = screenshot.toString('base64');

  const result = await analyzer.analyze(
    screenshotBase64,
    'pdp',
    viewport
  );

  // result.evaluations: HeuristicEvaluation[] (35 items)
  // result.insights: CROInsight[] (failed/partial only)
  // result.summary: { passed, failed, partial, notApplicable, bySeverity }
}
```

---

## Test Counts

| Test File | Count | Status |
|-----------|-------|--------|
| vision-analyzer.test.ts | 44 | ✅ |
| knowledge-loader.test.ts | 25 | ✅ |
| page-type-detector.test.ts | 20+ | ✅ |
| Other unit tests | 400+ | ✅ |

**Known Issues**: 3 pre-existing test failures in validator.test.ts and formatter.test.ts (URL trailing slash issue) - not blocking.

---

## Directory Structure (Phase 21 additions)

```
src/heuristics/
├── knowledge/                      # Phase 21b - COMPLETE
│   ├── index.ts                    # loadHeuristics(), getHeuristicById()
│   ├── types.ts                    # HeuristicItem, PageTypeHeuristics
│   └── pdp/                        # 35 PDP heuristics
│       ├── index.ts                # Aggregator
│       ├── layout-structure.json   # 4 heuristics
│       ├── imagery-media.json      # 4 heuristics
│       ├── pricing-transparency.json # 4 heuristics (PDP-PRICE-001 critical)
│       ├── description-value-prop.json # 3 heuristics
│       ├── specifications.json     # 3 heuristics
│       ├── reviews-social-proof.json # 4 heuristics
│       ├── selection-configuration.json # 3 heuristics
│       ├── cta-purchase-confidence.json # 4 heuristics (PDP-CTA-001 critical)
│       ├── mobile-usability.json   # 3 heuristics
│       └── utility-secondary.json  # 3 heuristics
│
├── vision/                         # Phase 21c - COMPLETE
│   ├── index.ts                    # Exports
│   ├── types.ts                    # CROVisionAnalyzerConfig, HeuristicEvaluation
│   ├── analyzer.ts                 # CROVisionAnalyzer class
│   ├── prompt-builder.ts           # buildVisionPrompt()
│   └── response-parser.ts          # parseVisionResponse()
│
├── page-type-detector.ts           # Phase 21a - COMPLETE
└── index.ts                        # Updated with vision exports
```

---

## New Session Prompt

Copy-paste this into a new session:

```
Read specs/001-browser-agent-core/quickstart.md to get the complete project context.

Phase 21 (Vision-Based CRO) is complete. All 36 tasks done.

Next up: Phase 20 - Unified Extraction Pipeline (58 tasks planned).
See tasks/phase-20.md for details.
```

---

*Generated: 2026-01-06*
