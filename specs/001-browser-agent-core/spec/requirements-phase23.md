# Requirements: Phase 23 - LLM Input Capture

**Navigation**: [Index](./index.md) | [Previous: Phase 22](./requirements-phase22.md)

---

## Overview

Phase 23 captures and stores all inputs sent to the LLM during vision analysis for debugging, auditing, and cross-referencing.

**Created**: 2026-02-03

---

## Functional Requirements

### FR-360: LLM Input Writer Module

The system SHALL provide an `LLMInputWriter` class that:
- Creates timestamped directory structure for LLM inputs
- Handles file I/O for DOM, screenshots, and prompts
- Reports success/failure with file counts

**Acceptance Criteria**:
- [ ] `LLMInputWriter` class exists in `src/output/`
- [ ] Exported from `src/output/index.ts`
- [ ] Creates `./llm-inputs/{timestamp}/` directory structure

---

### FR-361: DOM Snapshot Capture

The system SHALL save DOM snapshots as JSON files:
- One file per viewport: `DOM-snapshots/viewport-{N}.json`
- Contains serialized DOM tree with element indices
- Formatted for human readability (2-space indent)

**Acceptance Criteria**:
- [ ] DOM snapshots saved as valid JSON
- [ ] Files named `viewport-0.json`, `viewport-1.json`, etc.
- [ ] Contains full DOM tree structure

---

### FR-362: Screenshot Capture

The system SHALL save raw screenshots (before annotation):
- One file per viewport: `Screenshots/viewport-{N}.png`
- PNG format from base64 data
- Same screenshots sent to LLM vision API

**Acceptance Criteria**:
- [ ] Screenshots saved as PNG files
- [ ] Files named `viewport-0.png`, `viewport-1.png`, etc.
- [ ] Matches exact data sent to LLM

---

### FR-363: System Prompt Capture

The system SHALL save the system prompt:
- Single file: `Prompts/system-prompt.txt`
- Contains full system prompt text
- Saved once per analysis session

**Acceptance Criteria**:
- [ ] System prompt saved as text file
- [ ] File named `system-prompt.txt`
- [ ] Contains complete prompt text

---

### FR-364: User Prompt Capture

The system SHALL save user prompts per viewport:
- One file per viewport: `Prompts/viewport-{N}-prompt.txt`
- Contains constructed user prompt with heuristics context
- Includes viewport-specific data (scroll position, element count)

**Acceptance Criteria**:
- [ ] User prompts saved as text files
- [ ] Files named `viewport-0-prompt.txt`, etc.
- [ ] Contains full prompt sent to LLM

---

### FR-365: CROVisionAnalyzer Capture Integration

The `CROVisionAnalyzer.analyze()` method SHALL return captured inputs:
- `capturedInputs.systemPrompt`: System prompt text
- `capturedInputs.userPrompt`: User prompt text
- `capturedInputs.screenshotBase64`: Raw screenshot data

**Acceptance Criteria**:
- [ ] `analyze()` returns `capturedInputs` object
- [ ] Contains all three input types
- [ ] No modification to existing return fields

---

### FR-366: MultiViewportVisionAnalyzer Capture Aggregation

The `MultiViewportVisionAnalyzer` SHALL aggregate captured inputs:
- Collect inputs from each `analyzeSingleViewport()` call
- Include DOM snapshot in captured data
- Return `llmInputs[]` array in result

**Acceptance Criteria**:
- [ ] `llmInputs` array in analysis result
- [ ] One entry per analyzed viewport
- [ ] Contains viewport index and scroll position

---

### FR-367: CROAgent Result Pass-through

The `CROAgent.analyze()` method SHALL include LLM inputs in result:
- Add `llmInputs` field to `CROAnalysisResult`
- Pass through from vision analysis
- Optional field (undefined when vision disabled)

**Acceptance Criteria**:
- [ ] `llmInputs` field in `CROAnalysisResult` type
- [ ] Populated when vision mode enabled
- [ ] Undefined when vision mode disabled

---

### FR-368: CLI Integration

The CLI `processVisionMode()` function SHALL save LLM inputs:
- Trigger when `saveEvidence` is true (default)
- Use same timestamp as evidence directory
- Display success message with output directory

**Acceptance Criteria**:
- [ ] LLM inputs saved by default with `--vision`
- [ ] Same timestamp as `./evidence/{timestamp}/`
- [ ] Console output shows save location

---

### FR-369: Opt-out Behavior

The `--no-save-evidence` flag SHALL disable LLM input saving:
- No `./llm-inputs/` directory created
- No file I/O for captured inputs
- Consistent with evidence opt-out

**Acceptance Criteria**:
- [ ] `--no-save-evidence` disables LLM input saving
- [ ] No directory created when opted out
- [ ] No errors when opted out

---

### FR-370: Directory Structure

The LLM inputs directory SHALL follow this structure:
```
./llm-inputs/{ISO-timestamp}/
├── DOM-snapshots/
│   └── viewport-{N}.json
├── Screenshots/
│   └── viewport-{N}.png
└── Prompts/
    ├── system-prompt.txt
    └── viewport-{N}-prompt.txt
```

**Acceptance Criteria**:
- [ ] Three subdirectories created
- [ ] Files organized by type
- [ ] Timestamp format: `YYYY-MM-DDTHH-MM-SS`

---

### FR-371: Help Text Update

The CLI help text SHALL document LLM input saving:
- Mention in EVIDENCE CAPTURE OPTIONS section
- Explain what is saved and where
- Note opt-out behavior

**Acceptance Criteria**:
- [ ] Help text mentions LLM inputs
- [ ] Output directory documented
- [ ] Opt-out flag referenced

---

### FR-372: Error Handling

The `LLMInputWriter` SHALL handle errors gracefully:
- Continue on individual file write failures
- Report partial success with error details
- Never crash the main analysis flow

**Acceptance Criteria**:
- [ ] Partial success reported
- [ ] Errors collected and returned
- [ ] Analysis continues on write failure

---

## Configuration Requirements

### CR-044: LLM Input Directory

**Default**: `./llm-inputs/{timestamp}/`
**Override**: Not configurable (uses evidence timestamp)

---

## Success Criteria

### SC-157: LLM Input Capture

- [ ] All LLM inputs (DOM, screenshot, prompts) saved per viewport
- [ ] Directory structure matches specification
- [ ] Opt-out works with `--no-save-evidence`
- [ ] 8 unit tests passing
- [ ] 4 integration tests passing

---

## Task Mapping

| Requirement | Tasks |
|-------------|-------|
| FR-360 | T400 |
| FR-361 | T400, T401 |
| FR-362 | T400, T402 |
| FR-363, FR-364 | T400, T403 |
| FR-365 | T401 |
| FR-366 | T402 |
| FR-367 | T403 |
| FR-368 | T404 |
| FR-369 | T404 |
| FR-370 | T400 |
| FR-371 | T406 |
| FR-372 | T400 |
| Testing | T407, T408 |
