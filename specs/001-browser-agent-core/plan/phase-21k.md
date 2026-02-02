**Navigation**: [Index](./index.md) | [Previous](./phase-21j.md)

---

# Phase 21k: Deterministic Full-Page Collection

**Purpose**: Replace LLM-guided collection with deterministic viewport scanning to enforce true 100% page coverage.

**Created**: 2026-02-03

---

## Problem Statement

The current collection phase in `CROAgent.runCollectionPhase()` is **LLM-guided**:
- LLM decides when to capture viewport
- LLM decides when to scroll
- LLM decides when collection is "complete"

This causes:
1. Only 2-3 viewports captured (LLM thinks "enough")
2. Premature `collection_done` calls
3. Inconsistent coverage across runs
4. Bottom sections of long pages never analyzed

**Evidence**: User reports only first few sections captured, no full-page coverage.

---

## Solution: Deterministic Collection

Remove LLM from collection phase entirely. Use programmatic scrolling:

```
┌─────────────────────────────────────────────────────────────┐
│                    CURRENT (LLM-Guided)                     │
├─────────────────────────────────────────────────────────────┤
│  LLM → "capture_viewport" → LLM → "scroll_page" → LLM →    │
│  "capture_viewport" → LLM → "collection_done" (too early!) │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    NEW (Deterministic)                      │
├─────────────────────────────────────────────────────────────┤
│  Calculate viewports needed from pageHeight/viewportHeight  │
│  FOR each viewport position:                                │
│    1. Scroll to position                                    │
│    2. Wait for render                                       │
│    3. Capture DOM + screenshot                              │
│  END FOR                                                    │
│  → ALL viewports captured, 100% coverage guaranteed         │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture Changes

### Before (CR-001-B)
```
CLI --vision-agent
    └── CROAgent.analyze()
        └── runCollectionPhase()  ← LLM-guided loop
            ├── LLM decides: capture_viewport
            ├── LLM decides: scroll_page
            └── LLM decides: collection_done
        └── AnalysisOrchestrator.runAnalysis()  ← LLM analyzes
```

### After (Phase 21k)
```
CLI --vision-agent
    └── CROAgent.analyze()
        └── runDeterministicCollection()  ← NEW: Programmatic loop
            ├── Calculate viewport count
            ├── FOR each viewport: scroll → wait → capture
            └── Return all snapshots
        └── AnalysisOrchestrator.runAnalysis()  ← LLM analyzes (unchanged)
```

---

## Implementation Plan

### Task K1: Create DeterministicCollector class

**File**: `src/agent/deterministic-collector.ts` (NEW)

**Purpose**: Encapsulate deterministic viewport collection logic

```typescript
export interface CollectorConfig {
  /** Overlap between viewports in pixels (default: 100) */
  overlapPx: number;
  /** Wait time after scroll for render (default: 300ms) */
  scrollWaitMs: number;
  /** Maximum viewports to capture (safety limit, default: 20) */
  maxViewports: number;
}

export class DeterministicCollector {
  constructor(private config: CollectorConfig = DEFAULT_CONFIG) {}

  /**
   * Calculate viewport positions for full-page coverage
   */
  calculateViewportPositions(pageHeight: number, viewportHeight: number): number[] {
    const effectiveHeight = viewportHeight - this.config.overlapPx;
    const positions: number[] = [0]; // Always start at top

    let currentY = effectiveHeight;
    while (currentY < pageHeight - viewportHeight) {
      positions.push(currentY);
      currentY += effectiveHeight;
    }

    // Add final position to capture bottom
    const bottomPosition = Math.max(0, pageHeight - viewportHeight);
    if (positions[positions.length - 1] !== bottomPosition) {
      positions.push(bottomPosition);
    }

    return positions.slice(0, this.config.maxViewports);
  }

  /**
   * Collect all viewports deterministically
   */
  async collectAll(page: Page): Promise<ViewportSnapshot[]> {
    const pageHeight = await this.getPageHeight(page);
    const viewportHeight = await this.getViewportHeight(page);
    const positions = this.calculateViewportPositions(pageHeight, viewportHeight);

    const snapshots: ViewportSnapshot[] = [];

    for (let i = 0; i < positions.length; i++) {
      const scrollY = positions[i];

      // 1. Scroll to position
      await page.evaluate(`window.scrollTo(0, ${scrollY})`);

      // 2. Wait for render
      await this.sleep(this.config.scrollWaitMs);

      // 3. Capture snapshot
      const snapshot = await this.captureViewport(page, i, scrollY);
      snapshots.push(snapshot);

      console.log(`  [${i + 1}/${positions.length}] Captured at ${scrollY}px`);
    }

    return snapshots;
  }
}
```

**Tests** (8 tests):
- `calculateViewportPositions` returns correct positions for short page
- `calculateViewportPositions` returns correct positions for long page
- `calculateViewportPositions` includes overlap
- `calculateViewportPositions` respects maxViewports limit
- `collectAll` captures all calculated positions
- `collectAll` scrolls to each position
- `collectAll` waits between captures
- `collectAll` returns snapshots with correct viewportIndex

---

### Task K2: Update CROAgent to use DeterministicCollector

**File**: `src/agent/cro-agent.ts`

**Changes**:
1. Import `DeterministicCollector`
2. Replace `runCollectionPhase()` with `runDeterministicCollection()`
3. Remove LLM-based collection logic
4. Keep `runCollectionPhase()` as deprecated fallback (optional)

**Before** (lines 1343-1488):
```typescript
private async runCollectionPhase(...): Promise<ViewportSnapshot[]> {
  const maxCollectionSteps = 10;
  // ... LLM loop with capture_viewport, scroll_page, collection_done
}
```

**After**:
```typescript
private async runDeterministicCollection(
  page: Page,
  verbose: boolean
): Promise<ViewportSnapshot[]> {
  const collector = new DeterministicCollector({
    overlapPx: 100,
    scrollWaitMs: 300,
    maxViewports: 20,
  });

  console.log('\n' + '═'.repeat(80));
  console.log('  COLLECTION PHASE (DETERMINISTIC FULL-PAGE SCAN)');
  console.log('═'.repeat(80));

  const snapshots = await collector.collectAll(page);

  console.log(`  ✓ Collected ${snapshots.length} viewports (100% coverage)`);
  console.log('═'.repeat(80) + '\n');

  return snapshots;
}
```

**Update unified mode section** (~line 448):
```typescript
// Replace:
const collectedSnapshots = await this.runCollectionPhase(...);

// With:
const collectedSnapshots = await this.runDeterministicCollection(page, verbose);
```

**Tests** (5 tests):
- Unified mode uses deterministic collection
- All page sections are captured
- Viewport count matches calculated positions
- Snapshots have sequential viewportIndex
- Coverage is 100%

---

### Task K3: Remove collection tools from unified mode

**File**: `src/agent/tools/create-cro-registry.ts`

**Changes**:
- The `capture_viewport`, `scroll_page` (for collection), and `collection_done` tools are no longer needed for the unified mode collection phase
- Keep them for backward compatibility but mark as deprecated
- Add comment explaining they're only used in legacy LLM-guided mode

**Optional cleanup**:
- Remove `src/agent/tools/cro/collection-done-tool.ts` (or deprecate)
- Remove collection-specific logic from `capture-viewport-tool.ts`

---

### Task K4: Remove collection prompt and message handling

**File**: `src/agent/prompt-builder.ts`

**Changes**:
- Mark `buildCollectionSystemPrompt()` as deprecated
- Mark `buildCollectionUserMessage()` as deprecated
- Add comments explaining these are only for legacy mode

**File**: `src/prompts/system-collection.md`
- Add deprecation notice at top
- Keep for reference but not actively used

---

### Task K5: Update CLI verbose output

**File**: `src/cli.ts`

**Changes**:
Update verbose output in `processVisionAgentMode()` to show deterministic collection progress:

```typescript
if (options.verbose) {
  console.log(`  ${CYAN}Collection Phase (Deterministic):${RESET}`);
  console.log(`  • Page height: ${pageHeight}px`);
  console.log(`  • Viewport height: ${viewportHeight}px`);
  console.log(`  • Viewports to capture: ${viewportCount}`);
  console.log(`  • Overlap: 100px`);
}
```

---

### Task K6: Add collection config to CLI

**File**: `src/cli.ts`

**New CLI flags** (optional, for power users):
```
--viewport-overlap <px>    Overlap between viewport captures (default: 100)
--max-viewports <n>        Maximum viewports to capture (default: 20)
--scroll-wait <ms>         Wait time after scroll (default: 300)
```

**Note**: These are optional. Default values should work for 95% of cases.

---

### Task K7: Integration tests

**File**: `tests/integration/deterministic-collection.test.ts` (NEW)

**Tests** (10 tests):
```typescript
describe('Deterministic Collection', () => {
  it('captures all viewports for a long page', async () => {
    // Page 3000px tall, viewport 720px
    // Should capture ~5 viewports
  });

  it('captures minimum 1 viewport for short page', async () => {
    // Page 500px tall, viewport 720px
    // Should capture 1 viewport
  });

  it('includes overlap between viewports', async () => {
    // Check that viewport N+1 starts before viewport N ends
  });

  it('captures bottom of page', async () => {
    // Verify last snapshot includes page bottom
  });

  it('respects maxViewports limit', async () => {
    // Very long page should stop at maxViewports
  });

  it('waits for render after scroll', async () => {
    // Verify delay between scroll and capture
  });

  it('returns snapshots with correct viewportIndex', async () => {
    // viewportIndex should be 0, 1, 2, ...
  });

  it('returns snapshots with correct scrollPosition', async () => {
    // scrollPosition should match calculated positions
  });

  it('captures DOM at each viewport', async () => {
    // Each snapshot should have dom.elementCount > 0
  });

  it('captures screenshot at each viewport', async () => {
    // Each snapshot should have screenshot.base64
  });
});
```

---

## Task Summary

| Task | Description | Files | Tests |
|------|-------------|-------|-------|
| K1 | Create DeterministicCollector class | 1 new | 8 |
| K2 | Update CROAgent to use collector | 1 modify | 5 |
| K3 | Remove/deprecate collection tools | 1 modify | 0 |
| K4 | Deprecate collection prompts | 2 modify | 0 |
| K5 | Update CLI verbose output | 1 modify | 0 |
| K6 | Add collection CLI flags (optional) | 1 modify | 0 |
| K7 | Integration tests | 1 new | 10 |
| **TOTAL** | | **8 files** | **23 tests** |

---

## Implementation Order

1. **K1** - Create DeterministicCollector (foundation)
2. **K2** - Update CROAgent to use it
3. **K5** - Update CLI verbose output
4. **K7** - Integration tests
5. **K3** - Deprecate collection tools (cleanup)
6. **K4** - Deprecate collection prompts (cleanup)
7. **K6** - CLI flags (optional enhancement)

---

## Key Design Decisions

### 1. Overlap between viewports
- Default: 100px overlap
- Ensures no content is missed at viewport boundaries
- Elements at the edge appear in multiple snapshots (deduplication in analysis handles this)

### 2. Wait time after scroll
- Default: 300ms
- Allows lazy-loaded content to render
- Can be increased for heavy JS sites

### 3. Maximum viewports limit
- Default: 20 viewports
- Safety limit for extremely long pages
- 20 viewports × 720px = ~14,400px coverage (most pages)

### 4. Backward compatibility
- Keep LLM-guided collection as deprecated fallback
- Could add `--legacy-collection` flag if needed
- Remove completely in future version

---

## Expected Outcome

**Before** (LLM-guided):
```
Collection Phase: 2-3 viewports captured (LLM decided "enough")
Coverage: ~30-40% of page
```

**After** (Deterministic):
```
Collection Phase: 5-7 viewports captured (calculated from page height)
Coverage: 100% of page guaranteed
```

---

## Session Handoff Notes

**Key files to read**:
- `src/agent/cro-agent.ts` - `runCollectionPhase()` method (lines 1343-1488)
- `src/agent/tools/cro/capture-viewport-tool.ts` - How snapshots are created
- `src/heuristics/analysis-orchestrator.ts` - How snapshots are analyzed

**Test command after implementation**:
```bash
npm run start -- --vision-agent --verbose https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt
```

**Expected output**:
- 5-7 viewports captured (for typical PDP)
- Console shows "100% coverage"
- All page sections analyzed
- DOM-Screenshot mapping for entire page

---

## References

- Phase 21j tasks: `specs/001-browser-agent-core/tasks/phase-21j.md`
- CR-001 architecture: `specs/001-browser-agent-core/CHANGE-REQUEST-001.md`
- Coverage tracking: `src/agent/coverage-tracker.ts`
