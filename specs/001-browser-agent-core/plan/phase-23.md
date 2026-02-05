# Phase 23: LLM Input Capture

**Navigation**: [Index](./index.md) | [Previous: Phase 22](./phase-22.md)

---

## Overview

Phase 23 implements LLM input capture for debugging, auditing, and cross-referencing what inputs the vision analysis model receives versus what it outputs.

**Created**: 2026-02-03

---

## Problem Statement

1. No visibility into exact inputs sent to LLM per viewport
2. Difficult to debug why LLM made certain observations
3. No audit trail for analysis reproducibility
4. Cannot verify if DOM/screenshot data was correctly passed

---

## Solution Architecture

### Directory Structure

```
./llm-inputs/{timestamp}/
├── DOM-snapshots/
│   ├── viewport-0.json       # Serialized DOM tree
│   ├── viewport-1.json
│   └── ...
├── Screenshots/
│   ├── viewport-0.png        # Raw screenshot (before annotation)
│   ├── viewport-1.png
│   └── ...
└── Prompts/
    ├── system-prompt.txt     # Shared system prompt
    ├── viewport-0-prompt.txt # User prompt for viewport 0
    ├── viewport-1-prompt.txt
    └── ...
```

### Data Flow

```
CROVisionAnalyzer.analyze()
  ├── buildSystemPrompt() → capture systemPrompt
  ├── buildVisionPrompt() → capture userPrompt
  └── return { ...result, capturedInputs }
       ↓
MultiViewportVisionAnalyzer.analyzeSingleViewport()
  └── collect capturedInputs per viewport + DOM snapshot
       ↓
CROAgent.analyze()
  └── include llmInputs[] in result
       ↓
processVisionMode() in CLI
  └── LLMInputWriter.save(llmInputs, timestamp)
```

---

## Components

### 1. LLMInputWriter Class

**File**: `src/output/llm-input-writer.ts`

**Responsibilities**:
- Create timestamped directory structure
- Save DOM snapshots as formatted JSON
- Save screenshots as PNG files
- Save system prompt once per session
- Save user prompts per viewport

**Interface**:
```typescript
interface LLMInputData {
  viewportIndex: number;
  scrollPosition: number;
  domSnapshot: object;
  screenshotBase64: string;
  systemPrompt: string;
  userPrompt: string;
  timestamp: number;
}

class LLMInputWriter {
  constructor(config: { outputDir: string });
  async saveAll(inputs: LLMInputData[], sessionTimestamp: string): Promise<WriteResult>;
}
```

### 2. Capture Points

| Component | Method | Captures |
|-----------|--------|----------|
| `CROVisionAnalyzer` | `analyze()` | systemPrompt, userPrompt, screenshot |
| `MultiViewportVisionAnalyzer` | `analyzeSingleViewport()` | Above + DOM snapshot |
| `CROAgent` | `analyze()` | Aggregated llmInputs[] |
| CLI | `processVisionMode()` | Triggers save to disk |

---

## Integration

### Trigger Condition

LLM inputs are saved when:
- `--vision` flag is used (vision mode enabled)
- `saveEvidence` is `true` (default after Phase 21l)

### Output Location

- Evidence (annotated screenshots): `./evidence/{timestamp}/`
- LLM inputs (raw data): `./llm-inputs/{timestamp}/`

Both use the same timestamp for correlation.

---

## Dependencies

| Dependency | Source |
|------------|--------|
| Phase 21l complete | Default evidence saving enabled |
| `ScreenshotWriter` pattern | File I/O utilities |
| Vision analyzer pipeline | Prompt construction flow |

---

## Files Modified

| File | Changes |
|------|---------|
| `src/output/llm-input-writer.ts` | **New** - Writer class |
| `src/output/index.ts` | Add export |
| `src/heuristics/vision/analyzer.ts` | Add capturedInputs to return |
| `src/heuristics/vision/multi-viewport-analyzer.ts` | Collect inputs per viewport |
| `src/heuristics/vision/types.ts` | Add interfaces |
| `src/agent/cro-agent.ts` | Pass llmInputs in result |
| `src/cli.ts` | Integrate LLMInputWriter |

---

## Testing Strategy

### Unit Tests (8)
- Directory structure creation
- DOM snapshot JSON formatting
- Screenshot PNG saving
- System prompt saving (once)
- User prompt per viewport
- Multiple viewport handling
- Success/failure reporting
- Error handling

### Integration Tests (4)
- Full pipeline capture during vision analysis
- Correct directory structure created
- Opt-out with `--no-save-evidence`
- Timestamp correlation with evidence directory

---

## Task Reference

See [../tasks/phase-23.md](../tasks/phase-23.md) for implementation tasks T400-T408.
