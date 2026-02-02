**Navigation**: [Index](./index.md) | [Previous](./phase-21.md)

---

## Phase 21j: CLI Vision Agent Fix

**Purpose**: Fix `--vision-agent` CLI to use unified CROAgent instead of deprecated VisionAgent

**Created**: 2026-02-02

**Problem**:
1. Only 1 viewport captured (LLM-guided scroll, not enforced)
2. Evidence not saving (empty snapshots)
3. No proof of DOM-Screenshot mapping

**Solution**: Replace deprecated VisionAgent with CROAgent unified mode

---

### Task List

#### T383: Refactor processVisionAgentMode() to use CROAgent

**File**: `src/cli.ts`

**Changes**:
1. Remove import of `createVisionAgent` from vision module
2. Use existing `CROAgent` import
3. Replace VisionAgent instantiation with CROAgent
4. Call `croAgent.analyze()` with unified mode options

**Before** (lines 643-649):
```typescript
const visionAgent = createVisionAgent({
  model: options.visionModel,
  maxSteps: options.maxSteps,
  verbose: options.verbose,
});

const result = await visionAgent.analyze(page, pageTypeResult.type);
```

**After**:
```typescript
// Close initial page - CROAgent manages its own browser
await browserManager.close();

const croAgent = new CROAgent({
  browser: {
    headless: options.headless,
    timeout: options.timeout,
    browserType: 'chromium',
    waitUntil: options.waitUntil,
    postLoadWait: options.postLoadWait,
    dismissCookieConsent: options.dismissCookieConsent,
  },
  processing: {
    model: options.visionModel,
  },
  maxSteps: options.maxSteps,
  verbose: options.verbose,
});

const result = await croAgent.analyze(url, {
  enableUnifiedMode: true,
  visionAgentMode: true,
  scanMode: 'full_page',
  coverageConfig: { minCoveragePercent: 100 },
});
```

**Status**: [x] ✅ Complete (2026-02-02)

---

#### T384: Update CROAgent to return snapshots in result

**File**: `src/agent/cro-agent.ts`

**Changes**:
1. Add `snapshots: ViewportSnapshot[]` to return result
2. Capture snapshots from collection phase
3. Return them in final result

**Find CROAnalysisResult interface and add**:
```typescript
snapshots?: ViewportSnapshot[];
```

**In analyze() method, after collection phase**:
```typescript
// Store snapshots for evidence saving
const collectedSnapshots = stateManager.getViewportSnapshots();
// ... later in return:
return {
  ...existingResult,
  snapshots: collectedSnapshots,
};
```

**Tests**: 5 tests in `tests/integration/cro-agent.test.ts`
- Test: Unified mode returns snapshots array
- Test: Snapshots have visibleElements populated
- Test: Snapshots have elementMappings populated
- Test: Multiple viewports captured in full_page mode
- Test: Snapshot count matches coverage segments

**Status**: [ ] Pending

---

#### T385: Add console output for DOM-Screenshot mapping proof

**File**: `src/cli.ts`

**Changes**:
Add after result display (around line 730):

```typescript
// DOM-Screenshot Mapping Summary
if (result.snapshots && result.snapshots.length > 0) {
  console.log(`\n  ${CYAN}DOM-Screenshot Mapping:${RESET}`);
  for (const snapshot of result.snapshots) {
    const mappedCount = snapshot.elementMappings?.length ?? 0;
    const visibleCount = snapshot.visibleElements?.length ?? 0;
    console.log(`  • Viewport ${snapshot.viewportIndex} (scroll: ${snapshot.scrollPosition}px): ${mappedCount} mapped, ${visibleCount} visible`);
  }
  const totalMapped = result.snapshots.reduce((sum, s) => sum + (s.elementMappings?.length ?? 0), 0);
  const totalVisible = result.snapshots.reduce((sum, s) => sum + (s.visibleElements?.length ?? 0), 0);
  console.log(`  ${GREEN}Total: ${totalMapped} element mappings, ${totalVisible} visible across ${result.snapshots.length} viewports${RESET}`);
}
```

**Tests**: 2 tests
- Test: Console shows mapping counts when snapshots exist
- Test: Console shows total across viewports

**Status**: [ ] Pending

---

#### T386: Fix evidence saving to use CROAgent result

**File**: `src/cli.ts`

**Changes**:
1. Update evidence saving block (lines 738-812) to handle CROAgent result
2. Ensure `result.snapshots` type matches expected structure
3. Map CROAgent evaluations to evidence format

**Key change** - evaluations need viewportIndex:
```typescript
// CROAgent evaluations may not have viewportIndex set
// Need to map them from analysis orchestrator
const viewportEvaluations = result.evaluations.filter(
  (e) => e.viewportIndex === snapshot.viewportIndex
);
```

**Tests**: 3 tests
- Test: Evidence saved when --save-evidence flag set
- Test: Correct number of screenshots saved
- Test: Screenshot filenames include viewport index

**Status**: [ ] Pending

---

#### T387: Add verbose logging for collection phase

**File**: `src/cli.ts`

**Changes**:
Add progress output during collection:

```typescript
console.log(`\n  ${CYAN}Collection Phase:${RESET}`);
console.log(`  • Scan mode: full_page`);
console.log(`  • Target coverage: 100%`);
// After collection:
console.log(`  ${GREEN}✓ Collected ${result.snapshots.length} viewports${RESET}`);
```

**Tests**: 2 tests
- Test: Verbose mode shows collection progress
- Test: Non-verbose mode shows summary only

**Status**: [ ] Pending

---

#### T388: Update CLI help text

**File**: `src/cli.ts`

**Changes**:
Update help text (around line 308) to clarify vision-agent behavior:

```typescript
VISION ANALYSIS OPTIONS:
  --vision-agent          Enable unified CRO analysis with vision
                          - Enforces full-page coverage (scrolls entire page)
                          - Captures DOM + screenshots at each viewport
                          - Evaluates ALL heuristics systematically
                          - Uses gpt-4o-mini by default (~$0.01-0.02/page)
```

**Status**: [ ] Pending

---

#### T389: Integration test - full-page coverage with evidence

**File**: `tests/integration/cli-vision-agent.test.ts` (new file)

**Tests** (5 total):
```typescript
describe('CLI --vision-agent mode', () => {
  it('captures multiple viewports for full page coverage', async () => {
    // Run CLI with --vision-agent
    // Verify result.snapshots.length > 1 for pages taller than viewport
  });

  it('populates visibleElements for each viewport', async () => {
    // Verify each snapshot has visibleElements array
  });

  it('saves evidence when --save-evidence flag set', async () => {
    // Run with --save-evidence
    // Verify files created in evidence directory
  });

  it('annotates screenshots when --annotate-screenshots set', async () => {
    // Run with --save-evidence --annotate-screenshots
    // Verify screenshots have annotation overlays
  });

  it('shows DOM-Screenshot mapping in output', async () => {
    // Capture stdout
    // Verify mapping counts displayed
  });
});
```

**Status**: [ ] Pending

---

#### T390: Integration test - annotated screenshots

**File**: `tests/integration/cli-vision-agent.test.ts`

**Tests** (3 total):
```typescript
describe('Screenshot annotation', () => {
  it('draws bounding boxes for failed heuristics', async () => {
    // Verify red boxes on failed elements
  });

  it('shows element index labels', async () => {
    // Verify [0], [1], etc. labels on screenshots
  });

  it('saves annotated screenshots to evidence dir', async () => {
    // Verify annotated files written
  });
});
```

**Status**: [ ] Pending

---

## Task Summary

| Task | Description | Tests | Status |
|------|-------------|-------|--------|
| T383 | Refactor processVisionAgentMode() | 0 | [x] ✅ |
| T384 | CROAgent returns snapshots | 5 | [x] ✅ |
| T385 | Console mapping proof | 2 | [x] ✅ |
| T386 | Fix evidence saving | 3 | [x] ✅ |
| T387 | Verbose collection logging | 2 | [x] ✅ |
| T388 | Update help text | 0 | [x] ✅ |
| T389 | Integration: full-page + evidence | 5 | [ ] 📋 |
| T390 | Integration: annotated screenshots | 3 | [ ] 📋 |
| **TOTAL** | **8 tasks** | **20 tests** | **6/8 complete** |

---

## Implementation Order

1. **T384** - CROAgent returns snapshots (foundation)
2. **T383** - Refactor CLI to use CROAgent
3. **T385** - Add mapping proof output
4. **T386** - Fix evidence saving
5. **T387** - Add verbose logging
6. **T388** - Update help text
7. **T389** - Integration tests (full-page)
8. **T390** - Integration tests (annotation)

---

## Session Handoff Notes

**Key files to read**:
- `src/cli.ts` - processVisionAgentMode() at line 540
- `src/agent/cro-agent.ts` - analyze() method, unified mode
- `src/agent/tools/cro/capture-viewport-tool.ts` - how snapshots are created

**Key understanding**:
- VisionAgent is DEPRECATED (src/agent/vision/vision-agent.ts)
- CROAgent with `enableUnifiedMode: true` is the correct approach
- Collection phase enforces full-page coverage
- Analysis phase runs AFTER collection (category-based LLM calls)

**Test command after fix**:
```bash
npm run start -- --vision-agent --save-evidence --annotate-screenshots https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt
```

**Expected output**:
- Multiple viewports captured (3-5 for typical PDP)
- Evidence saved to ./evidence/ directory
- Annotated screenshots with bounding boxes
- Console shows DOM-Screenshot mapping counts
