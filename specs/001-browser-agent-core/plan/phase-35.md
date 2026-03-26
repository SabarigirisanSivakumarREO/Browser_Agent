# Implementation Plan: Phase 35 — Intelligent Element Perception & Targeting

**Branch**: `main` (SPECIFY_FEATURE=001-browser-agent-core)
**Date**: 2026-03-25
**Spec**: `spec/requirements-phase35.md`
**Estimated Tasks**: 29

## Summary

Overhaul the perceiver's element collection to prioritize content-area elements over header/nav, increase the element limit to 50, fix XPath generation to produce uniquely-scoped selectors, expand AX tree budget, and add AX-tree-to-element mapping so the planner can correlate product names to clickable indices.

## Technical Context

**Language/Version**: TypeScript 5.x strict mode
**Primary Dependencies**: Playwright (page.evaluate, AX tree APIs)
**Testing**: Vitest — unit + integration tests
**Key Constraint**: Element collection must stay under 500ms per step

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality | ✅ | perceiver.ts approaching limit — will extract element collector to separate file |
| IV. Error Handling | ✅ | All new page.evaluate calls wrapped in try/catch |
| VI. Cost & Performance | ✅ | 500ms budget, single page.evaluate call |
| VII. Modular Architecture | ✅ | New `element-collector.ts` module extracted from perceiver |
| VIII. Testing Discipline | ✅ | Tests for all new logic |

## Architecture

### Change Map

```
src/agent/agent-loop/
├── perceiver.ts              # MODIFY — delegate to element-collector, increase AX budget
├── element-collector.ts      # NEW — viewport-aware element collection + scoring
├── selector-generator.ts     # NEW — robust scoped selector generation
├── types.ts                  # MODIFY — expand InteractiveElement, add ContentRegion
├── planner.ts                # MODIFY — update prompt with content region + AX mapping
├── index.ts                  # MODIFY — export new modules
src/browser/
├── ax-tree-serializer.ts     # MODIFY — content-priority truncation for agent mode
tests/
├── unit/agent-loop/
│   ├── element-collector.test.ts   # NEW
│   ├── selector-generator.test.ts  # NEW
│   └── planner-context.test.ts     # NEW
└── integration/
    └── element-perception.test.ts  # NEW
```

## Implementation Phases

### Phase 35A: Element Collector Extraction (5 tasks)

**Goal**: Extract element collection from perceiver into a dedicated module with viewport-aware scoring.

**New file `element-collector.ts`**:

```typescript
interface ElementCollectionConfig {
  maxElements?: number;        // default: 50
  maxHeaderElements?: number;  // default: 10
  textMaxLength?: number;      // default: 80
}

interface CollectedElement extends InteractiveElement {
  region: 'header' | 'main' | 'footer' | 'unknown';
  score: number;
  accessibleName?: string;
}

async function collectInteractiveElements(
  page: Page,
  config?: ElementCollectionConfig
): Promise<{ elements: CollectedElement[]; contentRegion: ContentRegion }>
```

**Scoring algorithm** (all computed inside a single `page.evaluate`):
1. Find main content region: `<main>`, `[role="main"]`, or largest `<div>` by descendant count
2. For each interactive element with non-zero bounding rect:
   - `+10` if within viewport (0 ≤ top ≤ viewportHeight)
   - `+8` if inside main content region
   - `+5` if has meaningful text (length > 3, not just icon)
   - `+3` if is a link with href (not `javascript:void`)
   - `+2` if has `aria-label`
   - `-5` if inside `<header>`, `<nav>`, or `[role="navigation"]`
3. Sort by score descending
4. Cap header/nav elements at `maxHeaderElements` (10)
5. Fill remaining slots with content elements up to `maxElements` (50)

**ContentRegion summary**:
```typescript
interface ContentRegion {
  hasMainLandmark: boolean;
  mainContentLinks: number;
  mainContentButtons: number;
  headerElements: number;
  totalInteractive: number;
}
```

**Changes to `perceiver.ts`**:
- Replace inline `page.evaluate` element collection (lines 98-149) with call to `collectInteractiveElements()`
- Pass `ContentRegion` through `PerceivedState`

### Phase 35B: Robust Selector Generation (4 tasks)

**Goal**: Generate selectors that uniquely resolve to one element.

**New file `selector-generator.ts`**:

```typescript
function generateUniqueSelector(el: HTMLElement): string
```

**Strategy chain** (inside page.evaluate):
1. **ID**: `#${id}` — if `id` exists and `querySelectorAll('#' + id).length === 1`
2. **aria-label**: `[aria-label="${label}"]` scoped to tag — if unique
3. **data-testid / data-action**: `[data-testid="${val}"]` — if exists
4. **Text content CSS**: `a:has-text("exact text")` — for links with unique text
5. **Scoped CSS path**: Build parent chain: `main > div:nth-child(3) > a:nth-child(1)` — always unique
6. **Full XPath with parent**: `/html/body/main/div[3]/a[1]` — absolute path fallback

Uniqueness verified: `document.querySelectorAll(selector).length === 1`

**Changes to perceiver**:
- Replace old xpath generation with `generateUniqueSelector` call inside the same `page.evaluate`

### Phase 35C: AX Tree Enhancements (4 tasks)

**Goal**: Expand AX tree budget and prioritize content region nodes.

**Changes to `perceiver.ts`**:
- Increase `AX_TREE_MAX_CHARS` from 8000 to 16000 for agent mode
- Pass `agentMode: true` config to perceiver (plumbed from agent-loop)

**Changes to `ax-tree-serializer.ts`**:
- Add `prioritizeContent` option: when true, serialize `<main>` region nodes first, then header/footer
- Increase node name truncation from 50 to 80 chars
- Add role-based priority: `link` > `heading` > `listitem` > `button` > others (within content region)

**AX-to-element mapping**:
- Each `CollectedElement` gets an `accessibleName` field populated from `el.getAttribute('aria-label') || el.innerText`
- Perceiver formats elements as: `[0] <a> "Product Name Here..." — AX: "Product Name Full Accessible Name"`

### Phase 35D: Planner Prompt Enhancement (4 tasks)

**Goal**: Give the planner better context to make correct element choices.

**Changes to planner system prompt**:
- Add instruction: "Prefer elements in the main content area (region: 'main') for goal-relevant actions like clicking products, links, or results"
- Add instruction: "If no suitable element is in the list, use scroll_page to reveal more content or get_ax_tree for full page structure"
- Add instruction: "Match element text with what you see in the AX tree to confirm the right target"

**Changes to planner user message**:
- Add `CONTENT REGION` section showing main content vs header element counts
- Element format expanded: `[index] <a> "text" (region: main, score: 18)`
- Add `accessibleName` when different from display text

### Phase 35E: Screenshot Vision for Planner (4 tasks)

**Goal**: Send viewport screenshot to the planner as a vision input so the LLM can "see" the page.

**Changes to `perceiver.ts`**:
- Always capture screenshot (remove the AX-tree-length gate at lines 142-148)
- Always include `screenshotBase64` in `PerceivedState` (currently optional, only set when AX tree is short)

**Changes to `planner.ts`**:
- Change `HumanMessage` from a plain text string to a multimodal content array:
  ```typescript
  new HumanMessage({
    content: [
      { type: 'text', text: userMessage },
      ...(state.screenshotBase64 ? [{
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${state.screenshotBase64}` }
      }] : []),
    ]
  })
  ```
- Add `screenshotBase64` parameter to `planNextAction()` signature
- Update system prompt: add "You can see a screenshot of the current page. Use it to identify visual elements, product listings, prices, and ratings."

**Changes to `agent-loop.ts`**:
- Pass `preState.screenshotBase64` to `planNextAction()` calls

**Token cost**: JPEG q50 at 1280×800 ≈ 300 vision tokens — well within gpt-4o-mini limits.

### Phase 35F: Auto-Extract Page Summary (3 tasks)

**Goal**: Give the planner visible page text so it can see product names, prices, ratings even when AX tree is truncated.

**Changes to `perceiver.ts`**:
- After AX tree capture, run `page.evaluate` to extract `mainContentText`:
  ```typescript
  const mainContentText = await page.evaluate(() => {
    const main = document.querySelector('main, [role="main"]');
    const text = (main || document.body).innerText || '';
    return text.slice(0, 2000);
  });
  ```
- Add `pageText?: string` to `PerceivedState`

**Changes to `planner.ts`**:
- Add `PAGE TEXT (main content):` section to user message, after AX tree
- Truncate to 2000 chars in the prompt

**Changes to `types.ts`**:
- Add `pageText?: string` to `PerceivedState` interface

### Phase 35G: Integration Test + Exports (5 tasks)

**Goal**: End-to-end verification and barrel exports.

**Integration test**: Mock an Amazon-like search results page with:
- Header (logo, search, nav links) — 15 interactive elements
- Main content (10 product links with titles, prices, ratings)
- Verify: at least 5 product links appear in collected elements
- Verify: clicking elementIndex for a product navigates correctly
- Verify: AX tree contains product names

**Unit tests**:
- `element-collector.test.ts`: scoring, viewport priority, header cap, content region detection
- `selector-generator.test.ts`: ID, aria-label, data-testid, scoped CSS, uniqueness verification
- `planner-context.test.ts`: prompt includes content region, elements have region/score

## Dependencies & Execution Order

```
Phase 35A (element collector) ──┐
                                 ├──▶ Phase 35D (planner prompt) ──┐
Phase 35B (selector generator) ──┤                                  │
                                 │                                  ├──▶ Phase 35G (integration)
Phase 35C (AX tree) ─────────────┤                                  │
                                 ├──▶ Phase 35E (screenshot vision) ┘
Phase 35F (page text extract) ───┘
```

- 35A, 35B, 35C, 35F can start in parallel (different files)
- 35D depends on 35A (ContentRegion) and 35C (accessibleName)
- 35E depends on 35D (planner changes) — adds screenshot to the same planner call
- 35G depends on all

## Risks

| Risk | Mitigation |
|------|------------|
| Single page.evaluate for scoring adds latency | Benchmark; 500ms budget; all logic in one evaluate call |
| Main content detection fails on non-standard pages | Fallback to "largest div by descendant count" |
| Selector generation overhead | Cache strategy chain; short-circuit on first unique match |
| Increased element count increases planner token usage | 50 elements × ~30 tokens = ~1500 tokens — within budget |
| Scoped CSS selectors break on dynamic class names | Prefer data attributes and aria-labels over class-based selectors |
