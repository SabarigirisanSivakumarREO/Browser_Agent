# Browser Agent Core - LLM Context Prompt

**Use this prompt to onboard an LLM for project analysis, gap identification, and solution integration.**

---

## Project Identity

**Name**: Browser Agent Core
**Type**: TypeScript CLI tool for CRO (Conversion Rate Optimization) analysis
**Stack**: Playwright + GPT-4o + Zod + LangChain
**Status**: Phase 19 Complete (177/235 tasks) | Phase 20 Planned (58 tasks)

---

## What It Does

```
URL Input → Browser Automation → DOM Extraction → Agent Loop → Heuristic Analysis → Report
```

1. **Loads** websites via Playwright (Chromium)
2. **Extracts** DOM with CRO classification (CTAs, forms, trust signals, value props, navigation)
3. **Runs** observe→reason→act loop with GPT-4o and 11 specialized tools
4. **Applies** 10 heuristic rules for automated issue detection
5. **Generates** A/B test hypotheses and CRO scores (0-100)
6. **Outputs** structured reports (JSON/Markdown)

---

## Architecture (13 Modules)

| Module | Path | Responsibility |
|--------|------|----------------|
| **browser** | `src/browser/` | Playwright lifecycle, page loading, cookie handling |
| **dom** | `src/browser/dom/` | DOM extraction, serialization, multi-segment merging |
| **agent** | `src/agent/` | CROAgent, StateManager, PromptBuilder, MessageManager |
| **tools** | `src/agent/tools/` | 11 CRO tools (analysis, navigation, control) |
| **coverage** | `src/agent/coverage-tracker.ts` | 100% page coverage enforcement |
| **heuristics** | `src/heuristics/` | 10 rule-based checks, business type detection |
| **models** | `src/models/` | Zod schemas for validation |
| **output** | `src/output/` | Report formatters, hypothesis generator |
| **prompts** | `src/prompts/` | System prompt template |
| **types** | `src/types/` | TypeScript interfaces |
| **extraction** | `src/extraction/` | Legacy heading extraction |
| **langchain** | `src/langchain/` | LLM processor |
| **cli** | `src/cli.ts` | Entry point |

---

## Core Data Flow

```
┌────────────┐    ┌──────────────┐    ┌────────────┐    ┌─────────────┐
│ PageLoader │───>│ DOMExtractor │───>│ ToolSystem │───>│ CROAgent    │
│ (Playwright)│    │ (CRO classify)│   │ (11 tools) │    │ (GPT-4o)    │
└────────────┘    └──────────────┘    └────────────┘    └──────┬──────┘
                                                               │
┌────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────┐    ┌────────────────┐    ┌─────────────────┐
│ HeuristicEngine │───>│ HypothesisGen  │───>│ ReportFormatter │
│ (10 rules)      │    │ (A/B tests)    │    │ (MD/JSON)       │
└─────────────────┘    └────────────────┘    └─────────────────┘
```

---

## Key Types

```typescript
// Main output
interface CROAnalysisResult {
  url: string;
  success: boolean;
  insights: CROInsight[];           // From tool execution
  heuristicInsights: CROInsight[];  // From rule engine
  businessType?: BusinessTypeResult;
  hypotheses: Hypothesis[];
  scores: CROScores;                // overall: 0-100
  stepsExecuted: number;
  terminationReason: string;
}

// Insight structure
interface CROInsight {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'cta' | 'form' | 'trust' | 'value_prop' | 'navigation' | 'custom';
  issue: string;
  recommendation: string;
  evidence: Evidence[];
}

// Coverage control
type ScanMode = 'full_page' | 'above_fold' | 'llm_guided';
```

---

## 11 CRO Tools

| Category | Tool | Purpose |
|----------|------|---------|
| **Analysis** | `analyze_ctas` | CTA visibility, contrast, text |
| | `analyze_forms` | Field count, labels, validation |
| | `detect_trust_signals` | Badges, reviews, certifications |
| | `assess_value_prop` | H1 clarity, benefits |
| | `check_navigation` | Menu, breadcrumbs, search |
| | `find_friction` | Quick friction check |
| **Navigation** | `scroll_page` | Scroll control |
| | `click` | Click element by index |
| | `go_to_url` | Navigate to URL |
| **Control** | `record_insight` | LLM records observation |
| | `done` | Signal completion |

---

## 10 Heuristic Rules

| ID | Rule | Severity |
|----|------|----------|
| H001 | Missing primary CTA | critical |
| H002 | CTA below fold | high |
| H003 | Low contrast CTA | high |
| H004 | Generic CTA text | medium |
| H005 | Form too long | medium |
| H006 | Missing trust signals | high |
| H007 | Unclear value proposition | critical |
| H008 | Poor navigation | medium |
| H009 | Missing social proof | medium |
| H010 | Mobile friction | high |

---

## Project Structure

```
Browser_Agent/
├── src/
│   ├── agent/           # CROAgent, StateManager, tools/
│   ├── browser/         # BrowserManager, PageLoader, dom/
│   ├── heuristics/      # HeuristicEngine, rules/
│   ├── models/          # Zod schemas
│   ├── output/          # Formatters, reporters
│   ├── prompts/         # System prompt template
│   ├── types/           # TypeScript interfaces
│   └── cli.ts           # Entry point
├── tests/
│   ├── unit/            # 389 tests
│   ├── integration/     # 83 tests
│   └── e2e/             # 4 tests
├── specs/001-browser-agent-core/
│   ├── spec/            # Requirements (FR-001 to FR-141)
│   ├── plan/            # Architecture & phases
│   ├── tasks/           # Task definitions (T001-T204)
│   └── quickstart.md    # Entry point
└── design/              # SVG diagrams, flow charts
```

---

## Phase Summary

| Phase | Focus | Status |
|-------|-------|--------|
| 1-12 | Foundation (browser, extraction, LangChain, cookies) | ✅ |
| 13-15 | CRO models, DOM extraction, tool system | ✅ |
| 16 | Agent core (observe→reason→act loop) | ✅ |
| 17 | 11 CRO tools | ✅ |
| 18 | Heuristics, business type, hypotheses | ✅ |
| 19 | 100% page coverage system | ✅ |
| **20** | **Unified Extraction Pipeline** | 📋 Planned |

---

## Phase 20 (Planned) - Key Improvements

**Layered Extraction Architecture**:
- Layer 0: Types, schemas, token budgets, multi-strategy selectors
- Layer 1: PageSnapshot (meta, screenshot, landmarks, nodes, forms, prices, constraints)
- Layer 2: PageCoverage (state capture, merge with fingerprint deduplication)
- Layer 3: LLM context preparation with progressive disclosure

**Hard Caps**:
- maxNodesTotal: 250
- maxInteractive: 120
- snapshot token target: < 4k
- standard coverage: < 12k

**New Capabilities**:
- SelectorBundle: CSS + fallback strategies (role, text, nth, xpath)
- Fingerprint anchoring for PLP deduplication
- Constraint detection: cookie, shadow DOM, iframes, lazy, sticky, modal

---

## CLI Usage

```bash
# Default CRO analysis (full_page mode)
npm run start -- https://example.com

# Scan modes
npm run start -- --scan-mode=full_page https://example.com    # 100% coverage
npm run start -- --scan-mode=above_fold https://example.com   # First viewport
npm run start -- --scan-mode=llm_guided https://example.com   # LLM decides

# Output
npm run start -- --output-format markdown --output-file report.md https://example.com
npm run start -- --verbose https://example.com
```

---

## Spec Kit Structure (Source of Truth)

| File | Purpose |
|------|---------|
| `spec/user-stories.md` | US1-US14 user stories |
| `spec/requirements-*.md` | FR-001 to FR-141 functional requirements |
| `plan/architecture.md` | Module design, dependencies |
| `plan/phase-*.md` | Phase-specific implementation details |
| `tasks/index.md` | Task summary (177 done, 58 pending) |
| `tasks/phase-*.md` | Task definitions with checkpoints |

---

## Change Workflow (MUST FOLLOW)

```
1. Update spec/      → Add/modify requirements
2. Update plan/      → Update architecture if needed
3. Update tasks/     → Add tasks in appropriate phase
4. Update quickstart → Sync recent changes
5. Get approval      → Present changes, wait for confirmation
6. Implement         → Write code after approval
7. Run tests         → Verify all pass
8. Update design/    → Update diagrams
```

---

## Gap Analysis Checklist

When reviewing this project, check for:

### Architecture Gaps
- [ ] Missing error handling in critical paths
- [ ] Incomplete type coverage
- [ ] Missing edge case handling
- [ ] Performance bottlenecks
- [ ] Memory leaks in long-running operations

### Feature Gaps
- [ ] Missing CRO analysis categories
- [ ] Incomplete heuristic coverage
- [ ] Missing tool capabilities
- [ ] Output format limitations

### Quality Gaps
- [ ] Test coverage holes
- [ ] Missing integration tests for new features
- [ ] Documentation inconsistencies
- [ ] Type safety violations

### Phase 20 Integration Points
- [ ] Backward compatibility with existing extraction
- [ ] Migration path for current DOM structure
- [ ] Token budget enforcement
- [ ] Selector strategy fallbacks

---

## Integration Guidelines

When suggesting improvements:

1. **Align with existing patterns**: Follow established module structure
2. **Update spec kit first**: Requirements → Plan → Tasks → Code
3. **Maintain type safety**: Use Zod schemas for runtime validation
4. **Add tests**: Unit tests required, integration tests for cross-module
5. **Respect token budgets**: LLM context must stay within limits
6. **Preserve CLI interface**: Backward compatible flags

---

## Quick Verification Commands

```bash
# Type check
npx tsc --noEmit

# Run tests
npm test                    # All
npm run test:unit          # Unit only
npm run test:integration   # Integration only

# Run analysis
npm run start -- --verbose https://example.com
```

---

## Key Files to Read for Deep Context

| Priority | File | Purpose |
|----------|------|---------|
| 1 | `src/agent/cro-agent.ts` | Main agent implementation |
| 2 | `src/types/index.ts` | All TypeScript interfaces |
| 3 | `src/prompts/system-cro.md` | LLM system prompt |
| 4 | `src/browser/dom/extractor.ts` | DOM extraction logic |
| 5 | `src/heuristics/heuristic-engine.ts` | Rule engine |

---

*Use this context to analyze the project, identify gaps, and propose solutions that integrate cleanly with the existing architecture and planned phases.*
