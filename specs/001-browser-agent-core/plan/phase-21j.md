**Navigation**: [Index](./index.md) | [Previous](./phase-21.md)

## Phase 21j: CLI Vision Agent Fix

### Summary

Fix the `--vision-agent` CLI mode to use the unified CROAgent instead of the deprecated VisionAgent. This resolves three bugs:
1. Only one viewport captured (LLM-guided vs enforced full-page)
2. Evidence not saving (empty snapshots)
3. No proof of DOM-Screenshot mapping

**Created**: 2026-02-02

---

### Problem Analysis

The current CLI at `processVisionAgentMode()` uses the **deprecated** `VisionAgent` class:

```typescript
// Current (WRONG) - cli.ts:643
const visionAgent = createVisionAgent({...});  // ❌ Deprecated
const result = await visionAgent.analyze(page, pageType);
```

**Issues with VisionAgent**:
1. LLM-guided scrolling - LLM decides when to scroll/capture
2. May stop after 1 viewport if LLM thinks it has enough
3. No enforced full-page coverage
4. Relies on LLM calling `capture_viewport` tool multiple times

**Solution**: Use unified CROAgent with `enableUnifiedMode: true`:

```typescript
// Fixed (CORRECT)
const croAgent = new CROAgent({...});
const result = await croAgent.analyze(url, {
  enableUnifiedMode: true,
  visionAgentMode: true,
  scanMode: 'full_page'
});
```

**Benefits of unified mode**:
1. Enforced full-page coverage (scroll + capture loop)
2. Collection phase systematically captures ALL viewports
3. Analysis phase runs AFTER collection
4. Evidence populated correctly

---

### Architecture Change

```
BEFORE (Deprecated VisionAgent):
┌─────────────────────────────────────────────────────────────────────────────────┐
│  CLI --vision-agent                                                             │
│  └── createVisionAgent() ← DEPRECATED                                           │
│      └── LLM decides: capture? scroll? evaluate? done?                          │
│          └── May capture 1 viewport, then stop                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

AFTER (Unified CROAgent):
┌─────────────────────────────────────────────────────────────────────────────────┐
│  CLI --vision-agent                                                             │
│  └── CROAgent.analyze({ enableUnifiedMode: true, visionAgentMode: true })       │
│      ├── COLLECTION PHASE (enforced full-page)                                  │
│      │   └── scroll_page + capture_viewport until 100% coverage                 │
│      ├── ANALYSIS PHASE (category-based LLM calls)                              │
│      │   └── For each category: send DOM + screenshots → evaluations            │
│      └── OUTPUT PHASE                                                           │
│          └── Evidence saved, screenshots annotated                              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### Sub-Tasks

| Task | Description | Est. Tests |
|------|-------------|------------|
| T383 | Refactor `processVisionAgentMode()` to use CROAgent | 0 |
| T384 | Update CROAgent to return snapshots in result | 5 |
| T385 | Add console output for DOM-Screenshot mapping proof | 2 |
| T386 | Fix evidence saving to use CROAgent result | 3 |
| T387 | Add verbose logging for collection phase | 2 |
| T388 | Update CLI help text to reflect changes | 0 |
| T389 | Integration test: full-page coverage with evidence | 5 |
| T390 | Integration test: annotated screenshots | 3 |
| **TOTAL** | **8 tasks** | **~20 tests** |

---

### Key Code Changes

#### 1. CLI processVisionAgentMode() - T383

**File**: `src/cli.ts` (lines 540-825)

**Before**:
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
const croAgent = new CROAgent({
  browser: { /* existing config */ },
  processing: { model: options.visionModel },
  maxSteps: options.maxSteps,
  verbose: options.verbose,
});

const result = await croAgent.analyze(url, {
  enableUnifiedMode: true,
  visionAgentMode: true,
  scanMode: 'full_page',
  minCoverage: 100,
});
```

#### 2. CROAgent Result - T384

**File**: `src/agent/cro-agent.ts`

Add `snapshots` to `CROAnalysisResult`:
```typescript
interface CROAnalysisResult {
  // ... existing fields
  snapshots: ViewportSnapshot[];  // Add this
}
```

#### 3. DOM-Screenshot Mapping Proof - T385

**File**: `src/cli.ts`

Add console output:
```typescript
console.log(`\n  DOM-Screenshot Mapping:`);
for (const snapshot of result.snapshots) {
  console.log(`  • Viewport ${snapshot.viewportIndex}: ${snapshot.visibleElements?.length ?? 0} elements mapped`);
}
```

#### 4. Evidence Saving - T386

**File**: `src/cli.ts`

Ensure `visibleElements` is available from unified mode:
```typescript
if (options.saveEvidence && result.snapshots.length > 0) {
  // snapshots from CROAgent have visibleElements populated
  // via capture-viewport-tool.ts lines 187-188
}
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/cli.ts` | Refactor processVisionAgentMode() |
| `src/agent/cro-agent.ts` | Return snapshots in result |
| `src/models/agent-state.ts` | Ensure ViewportSnapshot exported |
| `tests/integration/vision-agent.test.ts` | Update tests for unified mode |

---

### Acceptance Criteria

1. `npm run start -- --vision-agent --save-evidence URL` captures **all viewports** (not just 1)
2. Evidence directory contains screenshots for each viewport
3. Console shows DOM-Screenshot mapping counts
4. Annotated screenshots show bounding boxes on elements
5. All existing tests pass

---

### Related Files

- **Tasks**: [../tasks/phase-21j.md](../tasks/phase-21j.md)
- **Deprecated**: `src/agent/vision/vision-agent.ts`
- **Target**: `src/agent/cro-agent.ts`
