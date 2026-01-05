# Session Handoff - CRO Browser Agent

**Last Updated**: 2026-01-05

---

## Project Overview

**Browser Agent** is a TypeScript-based CRO (Conversion Rate Optimization) analysis tool that uses:
- **Playwright** for browser automation
- **GPT-4o** for intelligent website analysis via observe→reason→act loop
- **Zod** for runtime validation
- **LangChain** for LLM orchestration

### Primary Purpose
Automatically analyze websites for CRO issues (CTAs, forms, trust signals, value propositions, navigation) and generate actionable insights with A/B test hypotheses.

---

## Current State

**Phase**: Phase 19 Complete ✅ | Phase 12b & 20 Planned 📋
**Status**: 177/312 tasks complete (Phases 1-19 done)
**Tests**: 476 tests passing (389 unit, 83 integration, 4 E2E)

### NEXT ACTION: Implement Phase 12b (Enhanced Cookie Detection)

**Priority**: Phase 12b should be implemented BEFORE Phase 20

**Problem**: Cookie banner on Peregrine Clothing (Shopify + Alpine.js) not detected despite visible "Accept" button.

**Root Cause**: Banner uses `aria-label="cookie banner"` and `x-data="consent(false)"` which current patterns don't match.

**Tasks** (T275-T281, 7 tasks, 18 tests):
- T275: Add 3 new CMP patterns to cookie-patterns.ts
- T276: Create `tryAriaLabeledBanner()` method
- T277: Create `tryContainerHeuristic()` method
- T278: Extend heuristic element types
- T279: Refactor `tryHeuristic()` priority chain
- T280: Update integration tests
- T281: Add Peregrine Clothing e2e test

**Files to modify**:
- `src/browser/cookie-patterns.ts` - Add 3 new patterns
- `src/browser/cookie-handler.ts` - Add new methods, refactor heuristic
- `tests/integration/cookie-handler.test.ts` - Add tests
- `tests/e2e/workflow.test.ts` - Add Peregrine test case

**Spec Kit References**:
- Requirements: `spec/requirements-foundation.md` (Phase 12b section)
- Tasks: `tasks/phases-10-12.md` (Phase 12b section)
- Architecture: `plan/architecture.md` (CookieConsentHandler component)

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

# Run CRO analysis (default: full_page mode)
npm run start -- https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy

# Scan modes
npm run start -- --scan-mode=full_page https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy   # 100% coverage
npm run start -- --scan-mode=above_fold https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy  # First viewport only
npm run start -- --scan-mode=llm_guided https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy  # LLM decides scrolling

# Output formats
npm run start -- --output-format markdown https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy
npm run start -- --output-format json --output-file report.json https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy

# Verbose mode
npm run start -- --verbose https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy
```

---

## Architecture Overview

### Analysis Flow (Phases 3-18)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CRO ANALYSIS PIPELINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Phase 3          Phase 14           Phase 15          Phase 16-17          │
│  ┌──────────┐    ┌──────────────┐   ┌────────────┐   ┌─────────────────┐   │
│  │ Browser  │───>│ DOM Extract  │──>│ Tool       │──>│ Agent Loop      │   │
│  │ Launch & │    │ & CRO        │   │ System     │   │ (Observe→       │   │
│  │ Page Load│    │ Classify     │   │ (11 tools) │   │  Reason→Act)    │   │
│  └──────────┘    └──────────────┘   └────────────┘   └────────┬────────┘   │
│                                                               │             │
│  Phase 19                                                     ▼             │
│  ┌──────────────────────┐                           ┌─────────────────┐    │
│  │ Coverage Tracking    │◄──────────────────────────│ Tool Insights   │    │
│  │ (100% page coverage) │                           └────────┬────────┘    │
│  └──────────────────────┘                                    │             │
│                                                               ▼             │
│  Phase 18a-d                                                               │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────────────────┐  │
│  │ Business Type  │─>│ Heuristic      │─>│ Dedupe → Prioritize →       │  │
│  │ Detection      │  │ Rules (10)     │  │ Hypotheses → Score → Report │  │
│  └────────────────┘  └────────────────┘  └─────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| **CROAgent** | `src/agent/cro-agent.ts` | Main agent with observe→reason→act loop |
| **StateManager** | `src/agent/state-manager.ts` | Tracks agent state, steps, failures, coverage |
| **PromptBuilder** | `src/agent/prompt-builder.ts` | Builds system/user prompts for LLM |
| **ToolRegistry** | `src/agent/tools/tool-registry.ts` | Registers and manages 11 CRO tools |
| **ToolExecutor** | `src/agent/tools/tool-executor.ts` | Executes tools with Zod validation |
| **CoverageTracker** | `src/agent/coverage-tracker.ts` | Ensures 100% page coverage (Phase 19) |
| **DOMExtractor** | `src/browser/dom/extractor.ts` | Extracts DOM with CRO classification |
| **DOMMerger** | `src/browser/dom/dom-merger.ts` | Merges DOM from multiple scroll positions |
| **HeuristicEngine** | `src/heuristics/heuristic-engine.ts` | Runs 10 rule-based checks |
| **HypothesisGenerator** | `src/output/hypothesis-generator.ts` | Creates A/B test hypotheses |

### 11 CRO Tools (Phase 17)

| Category | Tool Name | Purpose |
|----------|-----------|---------|
| **Analysis** | `analyze_ctas` | Check CTA visibility, contrast, text |
| | `analyze_forms` | Form field count, labels, validation |
| | `detect_trust_signals` | Trust badges, reviews, certifications |
| | `assess_value_prop` | H1 clarity, benefit communication |
| | `check_navigation` | Menu structure, breadcrumbs, search |
| | `find_friction` | Quick friction check across all categories |
| **Navigation** | `scroll_page` | Scroll up/down/top/bottom |
| | `click` | Click element by index |
| | `go_to_url` | Navigate to new URL |
| **Control** | `record_insight` | LLM records custom observation |
| | `done` | Signal analysis complete |

---

## Directory Structure

```
Browser_Agent/
├── src/
│   ├── agent/
│   │   ├── cro-agent.ts         # Main CRO agent
│   │   ├── state-manager.ts     # Agent state tracking
│   │   ├── prompt-builder.ts    # LLM prompt construction
│   │   ├── message-manager.ts   # Conversation history
│   │   ├── coverage-tracker.ts  # Page coverage tracking
│   │   ├── score-calculator.ts  # CRO score calculation
│   │   └── tools/
│   │       ├── tool-registry.ts
│   │       ├── tool-executor.ts
│   │       ├── create-cro-registry.ts
│   │       └── cro/              # 11 CRO tools
│   ├── browser/
│   │   ├── browser-manager.ts   # Playwright browser control
│   │   ├── page-loader.ts       # URL loading with wait strategies
│   │   ├── cookie-handler.ts    # Cookie consent dismissal
│   │   └── dom/
│   │       ├── extractor.ts     # DOM extraction
│   │       ├── serializer.ts    # DOM to string for LLM
│   │       ├── dom-merger.ts    # Merge multi-segment DOMs
│   │       └── build-dom-tree.ts
│   ├── heuristics/
│   │   ├── heuristic-engine.ts  # Rule engine
│   │   ├── business-type-detector.ts
│   │   ├── severity-scorer.ts
│   │   └── rules/               # 10 heuristic rules
│   ├── models/                  # TypeScript interfaces
│   ├── output/                  # Formatters, reporters
│   ├── prompts/
│   │   └── system-cro.md        # System prompt template
│   ├── types/
│   │   └── index.ts             # All type definitions
│   ├── cli.ts                   # CLI entry point
│   └── index.ts                 # Main exports
├── tests/
│   ├── unit/                    # 389 unit tests
│   ├── integration/             # 83 integration tests
│   ├── e2e/                     # 4 E2E tests
│   └── fixtures/                # Test HTML pages
└── specs/
    └── 001-browser-agent-core/
        ├── spec/                # Requirements (split)
        │   ├── index.md
        │   ├── user-stories.md
        │   └── requirements-*.md
        ├── plan/                # Implementation plan (split)
        │   ├── index.md
        │   ├── architecture.md
        │   └── phase-*.md
        ├── tasks/               # Tasks (split)
        │   ├── index.md
        │   └── phase-*.md
        ├── data-model.md        # Data structures
        └── SESSION-HANDOFF.md   # This file
```

---

## Key Files to Read

For a new session, read these files in order:

1. **`specs/001-browser-agent-core/tasks/index.md`** - Task overview and summary
2. **`src/agent/cro-agent.ts`** - Main agent implementation
3. **`src/types/index.ts`** - All TypeScript interfaces
4. **`src/prompts/system-cro.md`** - LLM system prompt

---

## Models & Types

### CROAnalysisResult (main output)
```typescript
interface CROAnalysisResult {
  url: string;
  success: boolean;
  insights: CROInsight[];           // From tool execution
  heuristicInsights: CROInsight[];  // From rule engine
  businessType?: BusinessTypeResult;
  hypotheses: Hypothesis[];
  scores: CROScores;                // overall: 0-100
  report?: { markdown?: string; json?: string };
  stepsExecuted: number;
  totalTimeMs: number;
  terminationReason: string;
  errors: string[];
  pageTitle?: string;
}
```

### CROInsight
```typescript
interface CROInsight {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'cta' | 'form' | 'trust' | 'value_prop' | 'navigation' | 'custom';
  element?: string;           // xpath
  issue: string;
  recommendation: string;
  evidence: Evidence[];
}
```

### ScanMode (Phase 19)
```typescript
type ScanMode = 'full_page' | 'above_fold' | 'llm_guided';
```

---

## Coverage System (Phase 19)

The coverage system ensures 100% page analysis:

```typescript
// Initialize
const tracker = new CoverageTracker({ minCoveragePercent: 100 });
tracker.initialize(pageHeight, viewportHeight);

// During scanning
tracker.markSegmentScanned(scrollY, elementsFound);

// Check completion
tracker.getCoveragePercent();   // 0-100
tracker.isFullyCovered();       // boolean

// For LLM context
tracker.getCoverageReport();    // Human-readable string
```

**Enforcement**: In `full_page` mode, the agent cannot call `done` until coverage reaches 100%.

---

## Test Verification

```bash
# Quick verification
npx tsc --noEmit && npm run test:unit

# Full verification
npm test

# Specific test files
npx vitest run tests/unit/coverage-tracker
npx vitest run tests/unit/dom-merger
npx vitest run tests/integration/cro-agent
npx vitest run tests/e2e/coverage-workflow
```

**Known Issues**: 2 validator tests fail (pre-existing URL trailing slash normalization issue) - not blocking.

---

## Environment Variables

Required in `.env`:
```
OPENAI_API_KEY=sk-...
```

---

## Recent Changes Summary

| Phase | Description | Tasks |
|-------|-------------|-------|
| 19f | Testing & Polish | T143-T146 |
| 19e | CLI flags (--scan-mode, --min-coverage) | T141-T142 |
| 19d | Prompt updates (coverage awareness) | T139-T140 |
| 19c | Agent integration (enforcement) | T134-T138 |
| 19b | DOM changes (absolute coords, merger) | T130-T133 |
| 19a | Coverage models & tracker | T126-T129 |
| 18 | Post-processing pipeline | T104-T122 |
| 17 | 11 CRO tools | T091-T103 |
| 16 | Agent core (observe→reason→act) | T078-T090 |

---

## Common Tasks for New Sessions

### 1. Run Full Analysis
```bash
npm run start -- https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy
```

### 2. Debug Tool Execution
```bash
npm run start -- --verbose --max-steps 5 https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy
```

### 3. Generate Report
```bash
npm run start -- --output-format markdown --output-file report.md https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy
```

### 4. Test Specific Component
```bash
npx vitest run tests/unit/[component-name]
```

### 5. Type Check After Changes
```bash
npx tsc --noEmit
```

---

## Next Phase

- **Phase 20**: Unified Extraction Pipeline (58 tasks planned)
  - Layered extraction with strict token budgets
  - Multi-strategy selectors (CSS, role, text, nth, xpath)
  - Constraint detection (cookie, shadow DOM, iframes, lazy, sticky, modal)
  - See: `plan/phase-20.md`, `tasks/phase-20.md`

## Potential Future Work

- **Phase 21**: Multi-page journey analysis
- **Phase 22**: Historical tracking and trend analysis
- **Phase 23**: Custom heuristic rule configuration
- **Phase 24**: API mode for integration with other tools

---

*Generated: 2025-12-17*
