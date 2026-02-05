# Phase 23: LLM Input Capture

**Navigation**: [Index](./index.md) | [Previous](./phase-22.md)

---

## Purpose

Capture and store all inputs sent to the LLM during vision analysis for debugging, auditing, and cross-referencing what the model receives vs. what it outputs.

**Created**: 2026-02-03

**Problem**:
1. No visibility into exact inputs sent to LLM per viewport
2. Difficult to debug why LLM made certain observations
3. No audit trail for analysis reproducibility

**Solution**: Save DOM snapshots, screenshots, and prompts to `./llm-inputs/{timestamp}/` directory structure

---

## Directory Structure

```
./llm-inputs/{timestamp}/
├── DOM-snapshots/
│   ├── viewport-0.json       # Serialized DOM for viewport 0
│   ├── viewport-1.json       # Serialized DOM for viewport 1
│   └── ...
├── Screenshots/
│   ├── viewport-0.png        # Raw screenshot (before annotation)
│   ├── viewport-1.png
│   └── ...
└── Prompts/
    ├── system-prompt.txt     # Shared system prompt
    ├── viewport-0-prompt.txt # User prompt for viewport 0
    ├── viewport-1-prompt.txt # User prompt for viewport 1
    └── ...
```

---

## Architecture

### Capture Points

| Component | File | Function | What to Capture |
|-----------|------|----------|-----------------|
| Vision Analyzer | `src/heuristics/vision/analyzer.ts` | `analyze()` | System prompt, user prompt |
| Prompt Builder | `src/heuristics/vision/prompt-builder.ts` | `buildVisionPrompt()` | Constructed user prompt |
| Multi-Viewport | `src/heuristics/vision/multi-viewport-analyzer.ts` | `analyzeSingleViewport()` | Per-viewport prompts |
| CRO Agent | `src/agent/cro-agent.ts` | `analyze()` | Pass captured inputs to CLI |
| CLI | `src/cli.ts` | `processVisionMode()` | Save to disk |

### Data Flow

```
CROVisionAnalyzer.analyze()
  ├── buildSystemPrompt() → capture systemPrompt
  ├── buildVisionPrompt() → capture userPrompt
  └── return { ...result, capturedInputs: { systemPrompt, userPrompt } }
       ↓
MultiViewportVisionAnalyzer.analyzeSingleViewport()
  └── collect capturedInputs per viewport
       ↓
CROAgent.analyze()
  └── include llmInputs[] in result
       ↓
processVisionMode() in CLI
  └── LLMInputWriter.save(llmInputs, timestamp)
```

---

## Task List

### T400: Create LLMInputWriter class

**File**: `src/output/llm-input-writer.ts` (new file)

**Implementation**:
```typescript
export interface LLMInputData {
  viewportIndex: number;
  scrollPosition: number;
  domSnapshot: object;           // Serialized DOM tree
  screenshotBase64: string;      // Raw screenshot
  systemPrompt: string;          // System prompt text
  userPrompt: string;            // User prompt text
  timestamp: number;
}

export interface LLMInputWriterConfig {
  outputDir: string;             // Base directory (default: ./llm-inputs)
}

export class LLMInputWriter {
  constructor(config: LLMInputWriterConfig);

  // Save all inputs for a session
  async saveAll(inputs: LLMInputData[], sessionTimestamp: string): Promise<{
    success: boolean;
    outputDir: string;
    filesWritten: number;
    errors: string[];
  }>;

  // Save individual components
  private async saveDOMSnapshot(input: LLMInputData, dir: string): Promise<void>;
  private async saveScreenshot(input: LLMInputData, dir: string): Promise<void>;
  private async savePrompt(input: LLMInputData, dir: string): Promise<void>;
  private async saveSystemPrompt(systemPrompt: string, dir: string): Promise<void>;
}
```

**Status**: [x] Complete

---

### T401: Add capturedInputs to CROVisionAnalyzer

**File**: `src/heuristics/vision/analyzer.ts`

**Changes**:
1. Modify `analyze()` to capture and return prompts
2. Add `CapturedLLMInputs` interface to return type

**Before** (conceptual):
```typescript
async analyze(screenshot, pageType, viewport): Promise<VisionAnalysisResult> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildVisionPrompt(heuristics, viewport);
  const response = await this.callVisionAPI(screenshot, systemPrompt, userPrompt);
  // ... parse and return
}
```

**After**:
```typescript
async analyze(screenshot, pageType, viewport): Promise<VisionAnalysisResult> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildVisionPrompt(heuristics, viewport);
  const response = await this.callVisionAPI(screenshot, systemPrompt, userPrompt);

  return {
    // ... existing fields
    capturedInputs: {
      systemPrompt,
      userPrompt,
      screenshotBase64: screenshot.base64,
    }
  };
}
```

**Status**: [x] Complete

---

### T402: Add capturedInputs to MultiViewportVisionAnalyzer

**File**: `src/heuristics/vision/multi-viewport-analyzer.ts`

**Changes**:
1. Modify `analyzeSingleViewport()` to collect captured inputs
2. Include DOM snapshot in captured data
3. Aggregate inputs in `analyzeFullPage()` result

**Implementation**:
```typescript
interface ViewportLLMInputs {
  viewportIndex: number;
  scrollPosition: number;
  domSnapshot: object;
  screenshotBase64: string;
  systemPrompt: string;
  userPrompt: string;
}

// In analyzeFullPage() result:
return {
  // ... existing fields
  llmInputs: ViewportLLMInputs[]
};
```

**Status**: [x] Complete

---

### T403: Pass llmInputs through CROAgent result

**File**: `src/agent/cro-agent.ts`

**Changes**:
1. Add `llmInputs` field to `CROAnalysisResult` type
2. Pass inputs from vision analysis to final result

**Type update** (in `src/agent/types.ts` or inline):
```typescript
export interface CROAnalysisResult {
  // ... existing fields
  llmInputs?: ViewportLLMInputs[];  // New field
}
```

**Status**: [x] Complete

---

### T404: Integrate LLMInputWriter in processVisionMode

**File**: `src/cli.ts`

**Changes**:
1. Import `LLMInputWriter`
2. After analysis, save LLM inputs when `saveEvidence` is true
3. Generate timestamped directory `./llm-inputs/{timestamp}/`

**Implementation** (in `processVisionMode()`):
```typescript
// Save LLM inputs (part of default evidence saving)
if (options.saveEvidence && result.llmInputs && result.llmInputs.length > 0) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const llmInputWriter = new LLMInputWriter({
    outputDir: `./llm-inputs/${timestamp}`,
  });

  const writeResult = await llmInputWriter.saveAll(result.llmInputs, timestamp);

  if (writeResult.success) {
    console.log(`  ${GREEN}Saved LLM inputs to ${writeResult.outputDir}${RESET}`);
  }
}
```

**Status**: [x] Complete

---

### T405: Export LLMInputWriter from output module

**File**: `src/output/index.ts`

**Changes**:
```typescript
export { LLMInputWriter, type LLMInputData, type LLMInputWriterConfig } from './llm-input-writer.js';
```

**Status**: [x] Complete

---

### T406: Update help text for LLM input saving

**File**: `src/cli.ts`

**Changes**:
Update EVIDENCE CAPTURE OPTIONS section:

```
EVIDENCE CAPTURE OPTIONS (enabled by default with --vision):
  --no-save-evidence      Disable saving viewport screenshots and LLM inputs
  --no-annotate-screenshots  Disable bounding box annotations on screenshots
  --evidence-dir <path>   Directory for evidence files (default: ./evidence/{timestamp})

  When evidence saving is enabled, the following are saved:
  • Annotated screenshots → ./evidence/{timestamp}/
  • LLM inputs (DOM, screenshots, prompts) → ./llm-inputs/{timestamp}/
```

**Status**: [x] Complete

---

### T407: Unit tests for LLMInputWriter

**File**: `tests/unit/llm-input-writer.test.ts` (new file)

**Tests** (8 total):
```typescript
describe('LLMInputWriter', () => {
  it('creates directory structure with timestamp', async () => {});
  it('saves DOM snapshot as JSON', async () => {});
  it('saves screenshot as PNG', async () => {});
  it('saves system prompt once', async () => {});
  it('saves user prompt per viewport', async () => {});
  it('handles multiple viewports', async () => {});
  it('returns success with file count', async () => {});
  it('handles write errors gracefully', async () => {});
});
```

**Status**: [x] Complete

---

### T408: Integration test for LLM input capture

**File**: `tests/integration/llm-input-capture.test.ts` (new file)

**Tests** (4 total):
```typescript
describe('LLM Input Capture Integration', () => {
  it('captures inputs during vision analysis', async () => {});
  it('saves all inputs when --vision used', async () => {});
  it('does not save inputs with --no-save-evidence', async () => {});
  it('creates correct directory structure', async () => {});
});
```

**Status**: [x] Complete

---

## Task Summary

| Task | Description | Tests | Status |
|------|-------------|-------|--------|
| T400 | Create LLMInputWriter class | 0 | [x] Complete |
| T401 | Add capturedInputs to CROVisionAnalyzer | 0 | [x] Complete |
| T402 | Add capturedInputs to CategoryAnalyzer/Orchestrator | 0 | [x] Complete |
| T403 | Pass llmInputs through CROAgent result | 0 | [x] Complete |
| T404 | Integrate LLMInputWriter in CLI | 0 | [x] Complete |
| T405 | Export from output module | 0 | [x] Complete |
| T406 | Update help text | 0 | [x] Complete |
| T407 | Unit tests | 13 | [x] Complete |
| T408 | Integration tests | 5 | [x] Complete |
| **TOTAL** | **9 tasks** | **18 tests** | **9/9 complete** |

---

## Implementation Order

1. **T400** - Create LLMInputWriter class (foundation)
2. **T401** - Add capturedInputs to CROVisionAnalyzer
3. **T402** - Add capturedInputs to MultiViewportVisionAnalyzer
4. **T403** - Pass llmInputs through CROAgent
5. **T404** - Integrate in CLI
6. **T405** - Export from module
7. **T406** - Update help text
8. **T407** - Unit tests
9. **T408** - Integration tests

---

## Files Modified/Created

| File | Action |
|------|--------|
| `src/output/llm-input-writer.ts` | Create |
| `src/output/index.ts` | Modify (add export) |
| `src/heuristics/vision/analyzer.ts` | Modify |
| `src/heuristics/vision/multi-viewport-analyzer.ts` | Modify |
| `src/heuristics/vision/types.ts` | Modify (add interfaces) |
| `src/agent/cro-agent.ts` | Modify |
| `src/cli.ts` | Modify |
| `tests/unit/llm-input-writer.test.ts` | Create |
| `tests/integration/llm-input-capture.test.ts` | Create |

---

## CLI Behavior After Implementation

```bash
# Default: Vision mode saves evidence + LLM inputs
npm run start -- --vision https://example.com
# Output:
#   ./evidence/2026-02-03T10-30-00/     (annotated screenshots)
#   ./llm-inputs/2026-02-03T10-30-00/   (DOM, screenshots, prompts)

# Opt-out: No evidence or LLM input saving
npm run start -- --vision --no-save-evidence https://example.com
```

---

## Session Handoff Notes

**Key insight**: Prompts are built in `src/heuristics/vision/prompt-builder.ts` and called via `CROVisionAnalyzer.callVisionAPI()`. The capture point is in `analyze()` method before the API call.

**Dependencies**:
- Phase 21l must be complete (default evidence saving)
- Uses existing `ScreenshotWriter` pattern for file I/O

**Test command after implementation**:
```bash
npm run start -- --vision https://www.peregrineclothing.co.uk/products/lynton-polo-shirt
# Then check: ls ./llm-inputs/
```
