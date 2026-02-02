**Navigation**: [Index](./index.md) | [Previous](./phase-21j.md)

---

## Phase 21k: Deterministic Full-Page Collection

**Purpose**: Replace LLM-guided collection with deterministic viewport scanning

**Created**: 2026-02-03

**Problem**: LLM decides when collection is "complete", resulting in only 2-3 viewports captured instead of full page.

**Solution**: Programmatic scrolling based on page height calculation.

---

### Task List

#### K1: Create DeterministicCollector class

**File**: `src/agent/deterministic-collector.ts` (NEW)

**Create class with**:
```typescript
export interface CollectorConfig {
  overlapPx: number;      // Default: 100
  scrollWaitMs: number;   // Default: 300
  maxViewports: number;   // Default: 20
}

export const DEFAULT_COLLECTOR_CONFIG: CollectorConfig = {
  overlapPx: 100,
  scrollWaitMs: 300,
  maxViewports: 20,
};

export class DeterministicCollector {
  constructor(config?: Partial<CollectorConfig>);

  calculateViewportPositions(pageHeight: number, viewportHeight: number): number[];
  async collectAll(page: Page): Promise<ViewportSnapshot[]>;
  private async captureViewport(page: Page, index: number, scrollY: number): Promise<ViewportSnapshot>;
  private async getPageHeight(page: Page): Promise<number>;
  private async getViewportHeight(page: Page): Promise<number>;
}
```

**Key logic for `calculateViewportPositions`**:
```typescript
calculateViewportPositions(pageHeight: number, viewportHeight: number): number[] {
  const effectiveHeight = viewportHeight - this.config.overlapPx;
  const positions: number[] = [0];

  let currentY = effectiveHeight;
  while (currentY < pageHeight - viewportHeight) {
    positions.push(currentY);
    currentY += effectiveHeight;
  }

  // Ensure bottom is captured
  const bottomPosition = Math.max(0, pageHeight - viewportHeight);
  if (positions[positions.length - 1] !== bottomPosition) {
    positions.push(bottomPosition);
  }

  return positions.slice(0, this.config.maxViewports);
}
```

**Tests**: 8 tests in `tests/unit/deterministic-collector.test.ts`
- [ ] calculates correct positions for short page (1 viewport)
- [ ] calculates correct positions for medium page (3 viewports)
- [ ] calculates correct positions for long page (5+ viewports)
- [ ] includes overlap between viewports
- [ ] always captures page bottom
- [ ] respects maxViewports limit
- [ ] collectAll returns correct number of snapshots
- [ ] snapshots have sequential viewportIndex

**Status**: [ ] Pending

---

#### K2: Update CROAgent to use DeterministicCollector

**File**: `src/agent/cro-agent.ts`

**Changes**:

1. Add import:
```typescript
import { DeterministicCollector, DEFAULT_COLLECTOR_CONFIG } from './deterministic-collector.js';
```

2. Add new method (replace `runCollectionPhase`):
```typescript
private async runDeterministicCollection(
  page: Page,
  verbose: boolean
): Promise<ViewportSnapshot[]> {
  const collector = new DeterministicCollector();

  console.log('\n' + '═'.repeat(80));
  console.log('  COLLECTION PHASE (DETERMINISTIC FULL-PAGE SCAN)');
  console.log('═'.repeat(80));

  const pageHeight = await page.evaluate('document.documentElement.scrollHeight');
  const viewportHeight = await page.evaluate('window.innerHeight');
  const positions = collector.calculateViewportPositions(pageHeight, viewportHeight);

  console.log(`  → Page: ${pageHeight}px, Viewport: ${viewportHeight}px`);
  console.log(`  → Viewports to capture: ${positions.length}`);

  const snapshots = await collector.collectAll(page);

  console.log(`  ${c.success('✓')} Collected ${snapshots.length} viewports (100% coverage)`);
  console.log('═'.repeat(80) + '\n');

  return snapshots;
}
```

3. Update unified mode section (~line 448):
```typescript
// BEFORE:
const collectedSnapshots = await this.runCollectionPhase(
  page, domTree, url, pageTitle, collectionStateManager, registry, verbose
);

// AFTER:
const collectedSnapshots = await this.runDeterministicCollection(page, verbose);
```

4. Mark `runCollectionPhase` as deprecated:
```typescript
/**
 * @deprecated Use runDeterministicCollection instead (Phase 21k)
 * LLM-guided collection - kept for backward compatibility
 */
private async runCollectionPhase(...): Promise<ViewportSnapshot[]> {
```

**Tests**: 5 tests
- [ ] unified mode uses deterministic collection
- [ ] all page sections captured
- [ ] correct viewport count
- [ ] 100% coverage achieved
- [ ] snapshots passed to analysis orchestrator

**Status**: [ ] Pending

---

#### K3: Deprecate collection tools

**File**: `src/agent/tools/create-cro-registry.ts`

**Changes**:
Add deprecation comments:
```typescript
// Phase 21k: collection_done is deprecated - deterministic collection doesn't need it
// Kept for backward compatibility with legacy LLM-guided mode
registry.register(collectionDoneTool);
```

**File**: `src/agent/tools/cro/collection-done-tool.ts`

Add deprecation notice:
```typescript
/**
 * @deprecated Phase 21k - Deterministic collection doesn't need this tool
 * Collection now runs programmatically without LLM decisions
 */
export const collectionDoneTool: Tool = { ... };
```

**Status**: [ ] Pending

---

#### K4: Deprecate collection prompts

**File**: `src/agent/prompt-builder.ts`

Add deprecation to methods:
```typescript
/**
 * @deprecated Phase 21k - Collection is now deterministic, no LLM prompt needed
 */
buildCollectionSystemPrompt(): string { ... }

/**
 * @deprecated Phase 21k - Collection is now deterministic, no LLM prompt needed
 */
buildCollectionUserMessage(...): string { ... }
```

**File**: `src/prompts/system-collection.md`

Add notice at top:
```markdown
> **DEPRECATED (Phase 21k)**: This prompt is no longer used.
> Collection is now deterministic - see `DeterministicCollector` class.
> Kept for reference only.
```

**Status**: [ ] Pending

---

#### K5: Update CLI verbose output

**File**: `src/cli.ts`

**Update `processVisionAgentMode()` verbose section**:
```typescript
if (options.verbose) {
  console.log(`\n  ${CYAN}Collection Phase (Deterministic):${RESET}`);
  console.log(`  • Mode: Full-page scan`);
  console.log(`  • Overlap: 100px between viewports`);
  console.log(`  • Coverage target: 100%`);
}
```

**After collection, show summary**:
```typescript
const snapshotCount = result.snapshots?.length ?? 0;
console.log(`  ${GREEN}✓ Collected ${snapshotCount} viewports${RESET}`);
if (options.verbose && result.snapshots) {
  for (const snapshot of result.snapshots) {
    console.log(`    [${snapshot.viewportIndex}] scroll: ${snapshot.scrollPosition}px, elements: ${snapshot.dom.elementCount}`);
  }
}
```

**Status**: [ ] Pending

---

#### K6: Add collection CLI flags (optional)

**File**: `src/cli.ts`

**New flags** (parse in `parseArgs()`):
```typescript
let viewportOverlap = 100;
let maxViewports = 20;
let scrollWait = 300;

// In argument parsing:
} else if (arg === '--viewport-overlap' && args[i + 1]) {
  viewportOverlap = parseInt(args[i + 1], 10);
  i++;
} else if (arg === '--max-viewports' && args[i + 1]) {
  maxViewports = parseInt(args[i + 1], 10);
  i++;
} else if (arg === '--scroll-wait' && args[i + 1]) {
  scrollWait = parseInt(args[i + 1], 10);
  i++;
}
```

**Update help text**:
```
ADVANCED COLLECTION OPTIONS:
  --viewport-overlap <px>  Overlap between viewport captures (default: 100)
  --max-viewports <n>      Maximum viewports to capture (default: 20)
  --scroll-wait <ms>       Wait time after scroll for render (default: 300)
```

**Priority**: LOW - defaults work for most cases

**Status**: [ ] Pending

---

#### K7: Integration tests

**File**: `tests/integration/deterministic-collection.test.ts` (NEW)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser, Page } from 'playwright';
import { DeterministicCollector } from '../../src/agent/deterministic-collector.js';

describe('Deterministic Collection', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('calculateViewportPositions', () => {
    it('returns single position for short page', () => {
      const collector = new DeterministicCollector();
      const positions = collector.calculateViewportPositions(500, 720);
      expect(positions).toEqual([0]);
    });

    it('returns multiple positions for long page', () => {
      const collector = new DeterministicCollector();
      const positions = collector.calculateViewportPositions(3000, 720);
      expect(positions.length).toBeGreaterThan(3);
    });

    it('includes page bottom position', () => {
      const collector = new DeterministicCollector();
      const positions = collector.calculateViewportPositions(2000, 720);
      const lastPosition = positions[positions.length - 1];
      expect(lastPosition).toBe(2000 - 720); // 1280
    });

    it('respects maxViewports limit', () => {
      const collector = new DeterministicCollector({ maxViewports: 3 });
      const positions = collector.calculateViewportPositions(10000, 720);
      expect(positions.length).toBeLessThanOrEqual(3);
    });
  });

  describe('collectAll', () => {
    it('captures all calculated viewports', async () => {
      // Load a test page
      await page.setContent(`
        <html>
          <body style="height: 3000px;">
            <div style="position: absolute; top: 0;">Section 1</div>
            <div style="position: absolute; top: 1000px;">Section 2</div>
            <div style="position: absolute; top: 2000px;">Section 3</div>
          </body>
        </html>
      `);

      const collector = new DeterministicCollector();
      const snapshots = await collector.collectAll(page);

      expect(snapshots.length).toBeGreaterThan(2);
      expect(snapshots[0].viewportIndex).toBe(0);
      expect(snapshots[0].scrollPosition).toBe(0);
    });

    it('captures DOM at each position', async () => {
      const collector = new DeterministicCollector();
      const snapshots = await collector.collectAll(page);

      for (const snapshot of snapshots) {
        expect(snapshot.dom.elementCount).toBeGreaterThan(0);
        expect(snapshot.dom.serialized).toBeTruthy();
      }
    });

    it('captures screenshot at each position', async () => {
      const collector = new DeterministicCollector();
      const snapshots = await collector.collectAll(page);

      for (const snapshot of snapshots) {
        expect(snapshot.screenshot.base64).toBeTruthy();
        expect(snapshot.screenshot.capturedAt).toBeGreaterThan(0);
      }
    });
  });
});
```

**Tests**: 10 total
- [ ] single position for short page
- [ ] multiple positions for long page
- [ ] includes page bottom
- [ ] respects maxViewports
- [ ] overlap between viewports
- [ ] captures all viewports
- [ ] correct viewportIndex sequence
- [ ] correct scrollPosition values
- [ ] captures DOM at each position
- [ ] captures screenshot at each position

**Status**: [ ] Pending

---

## Task Summary

| Task | Description | Tests | Status |
|------|-------------|-------|--------|
| K1 | Create DeterministicCollector class | 8 | [ ] |
| K2 | Update CROAgent to use collector | 5 | [ ] |
| K3 | Deprecate collection tools | 0 | [ ] |
| K4 | Deprecate collection prompts | 0 | [ ] |
| K5 | Update CLI verbose output | 0 | [ ] |
| K6 | Add collection CLI flags (optional) | 0 | [ ] |
| K7 | Integration tests | 10 | [ ] |
| **TOTAL** | **7 tasks** | **23 tests** | |

---

## Implementation Order

1. **K1** - DeterministicCollector class (foundation)
2. **K7** - Unit tests for collector (TDD approach)
3. **K2** - Update CROAgent
4. **K5** - CLI verbose output
5. **K3** - Deprecate tools
6. **K4** - Deprecate prompts
7. **K6** - CLI flags (optional)

---

## Session Handoff Notes

**Start command**:
```
Read specs/001-browser-agent-core/quickstart.md to get the complete project context.

Current task: Phase 21k - Deterministic Full-Page Collection
Tasks file: specs/001-browser-agent-core/tasks/phase-21k.md
Plan file: specs/001-browser-agent-core/plan/phase-21k.md
```

**Key insight**: The collection phase should NOT involve LLM decisions. Calculate viewport positions mathematically, then programmatically scroll and capture. LLM is only used in the analysis phase.

**Test after implementation**:
```bash
npm run start -- --vision-agent --verbose https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt
```

**Expected**: 5-7 viewports captured, "100% coverage" shown in console.
