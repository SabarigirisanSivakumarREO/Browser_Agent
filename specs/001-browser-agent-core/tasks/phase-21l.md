# Phase 21l: Default Evidence & Mapping

**Navigation**: [Index](./index.md) | [Previous](./phase-21j.md)

---

## Purpose

Make DOM-screenshot mapping and evidence saving part of the default vision workflow instead of opt-in flags.

**Created**: 2026-02-03

**Problem**:
1. Evidence saving requires `--save-evidence` flag (easy to forget)
2. Screenshot annotation requires `--annotate-screenshots` flag (easy to forget)
3. Core features shouldn't require extra flags

**Solution**: Flip defaults - evidence & annotation ON by default, opt-out flags for minimal output

---

## Task List

### T391: Change saveEvidence default to true

**File**: `src/cli.ts`

**Changes**:
1. Line 83: Change `let saveEvidence = false;` to `let saveEvidence = true;`
2. Update CLIOptions interface comment

**Before**:
```typescript
let saveEvidence = false;  // Save screenshots as evidence
```

**After**:
```typescript
let saveEvidence = true;  // Save screenshots as evidence (default: on)
```

**Status**: [ ] Pending

---

### T392: Change annotateScreenshots default to true

**File**: `src/cli.ts`

**Changes**:
1. Line 85: Change `let annotateScreenshots = false;` to `let annotateScreenshots = true;`
2. Update CLIOptions interface comment

**Before**:
```typescript
let annotateScreenshots = false;  // Annotate screenshots with bounding boxes
```

**After**:
```typescript
let annotateScreenshots = true;  // Annotate screenshots with bounding boxes (default: on)
```

**Status**: [ ] Pending

---

### T393: Add --no-save-evidence opt-out flag

**File**: `src/cli.ts`

**Changes**:
1. Add flag parsing in argument loop (around line 235):
```typescript
} else if (arg === '--no-save-evidence') {
  saveEvidence = false;
}
```

2. Keep existing `--save-evidence` for backward compatibility (no-op when default is true)

**Status**: [ ] Pending

---

### T394: Add --no-annotate-screenshots opt-out flag

**File**: `src/cli.ts`

**Changes**:
1. Add flag parsing in argument loop (around line 240):
```typescript
} else if (arg === '--no-annotate-screenshots') {
  annotateScreenshots = false;
}
```

2. Keep existing `--annotate-screenshots` for backward compatibility (no-op when default is true)

**Status**: [ ] Pending

---

### T395: Create default evidence directory with timestamp

**File**: `src/cli.ts`

**Changes**:
1. Generate timestamped evidence directory when not specified
2. Around line 565, before evidence saving:

```typescript
// Generate default evidence directory with timestamp
if (saveEvidence && !evidenceDir) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  evidenceDir = `./evidence/${timestamp}`;
}
```

3. Ensure directory is created if it doesn't exist

**Status**: [ ] Pending

---

### T396: Update CLI help text for new defaults

**File**: `src/cli.ts`

**Changes**:
Update help text (around line 330-345):

**Before**:
```
EVIDENCE OPTIONS:
  --save-evidence         Save viewport screenshots as evidence files
  --evidence-dir <path>   Directory to save evidence (default: ./evidence)
  --annotate-screenshots  Annotate screenshots with element bounding boxes
                          Requires --save-evidence to take effect
```

**After**:
```
EVIDENCE OPTIONS (enabled by default with --vision):
  --no-save-evidence      Disable saving viewport screenshots as evidence
  --no-annotate-screenshots  Disable bounding box annotations on screenshots
  --evidence-dir <path>   Directory to save evidence (default: ./evidence/{timestamp})

  Note: --save-evidence and --annotate-screenshots still accepted for compatibility
```

**Status**: [ ] Pending

---

### T397: Update examples in help text

**File**: `src/cli.ts`

**Changes**:
Update examples section (around line 390-400):

**Before**:
```
npm run start -- --vision --save-evidence https://example.com/product
npm run start -- --vision --save-evidence --annotate-screenshots https://example.com/product
```

**After**:
```
# Default: saves evidence + annotates screenshots
npm run start -- --vision https://example.com/product

# Opt-out examples
npm run start -- --vision --no-save-evidence https://example.com/product
npm run start -- --vision --no-annotate-screenshots https://example.com/product

# Custom evidence directory
npm run start -- --vision --evidence-dir ./reports https://example.com/product
```

**Status**: [x] ✅ Complete (2026-02-03)

---

### T398: Unit tests for new CLI defaults

**File**: `tests/unit/cli-options.test.ts`

**Tests** (5 total):
```typescript
describe('CLI default options', () => {
  it('saveEvidence defaults to true when --vision is used', () => {
    const options = parseArgs(['--vision', 'https://example.com']);
    expect(options.saveEvidence).toBe(true);
  });

  it('annotateScreenshots defaults to true when --vision is used', () => {
    const options = parseArgs(['--vision', 'https://example.com']);
    expect(options.annotateScreenshots).toBe(true);
  });

  it('--no-save-evidence disables evidence saving', () => {
    const options = parseArgs(['--vision', '--no-save-evidence', 'https://example.com']);
    expect(options.saveEvidence).toBe(false);
  });

  it('--no-annotate-screenshots disables annotation', () => {
    const options = parseArgs(['--vision', '--no-annotate-screenshots', 'https://example.com']);
    expect(options.annotateScreenshots).toBe(false);
  });

  it('legacy --save-evidence flag still works', () => {
    const options = parseArgs(['--vision', '--save-evidence', 'https://example.com']);
    expect(options.saveEvidence).toBe(true);
  });
});
```

**Status**: [x] ✅ Complete (2026-02-03) - 15 tests in tests/unit/cli-options.test.ts

---

### T399: Integration test for default evidence creation

**File**: `tests/integration/default-evidence.test.ts` (new file)

**Tests** (4 total):
```typescript
describe('Default evidence creation', () => {
  it('creates evidence directory with timestamp when --vision used', async () => {
    // Run CLI with just --vision
    // Verify evidence directory created with timestamp format
  });

  it('saves screenshots by default', async () => {
    // Run CLI with just --vision
    // Verify screenshots exist in evidence directory
  });

  it('annotates screenshots by default', async () => {
    // Run CLI with just --vision
    // Verify screenshots have bounding box annotations
  });

  it('--no-save-evidence prevents evidence creation', async () => {
    // Run CLI with --vision --no-save-evidence
    // Verify no evidence directory created
  });
});
```

**Status**: [x] ✅ Complete (2026-02-03) - 12 tests in tests/integration/default-evidence.test.ts

---

## Task Summary

| Task | Description | Tests | Status |
|------|-------------|-------|--------|
| T391 | saveEvidence default true | 0 | [x] ✅ |
| T392 | annotateScreenshots default true | 0 | [x] ✅ |
| T393 | Add --no-save-evidence flag | 0 | [x] ✅ |
| T394 | Add --no-annotate-screenshots flag | 0 | [x] ✅ |
| T395 | Default evidence dir with timestamp | 0 | [x] ✅ |
| T396 | Update help text | 0 | [x] ✅ |
| T397 | Update examples | 0 | [x] ✅ |
| T398 | Unit tests for defaults | 15 | [x] ✅ |
| T399 | Integration test for evidence | 12 | [x] ✅ |
| **TOTAL** | **9 tasks** | **27 tests** | **9/9 complete** |

---

## Implementation Order

1. **T391** - Change saveEvidence default (simple)
2. **T392** - Change annotateScreenshots default (simple)
3. **T393** - Add --no-save-evidence flag
4. **T394** - Add --no-annotate-screenshots flag
5. **T395** - Default evidence directory with timestamp
6. **T396** - Update help text
7. **T397** - Update examples
8. **T398** - Unit tests
9. **T399** - Integration tests

---

## Files Modified

| File | Changes |
|------|---------|
| `src/cli.ts` | Defaults, opt-out flags, help text, examples |
| `tests/unit/cli-options.test.ts` | New/updated tests |
| `tests/integration/default-evidence.test.ts` | New file |

---

## CLI Behavior After Implementation

```bash
# NEW DEFAULT: Vision mode saves evidence and annotates screenshots
npm run start -- --vision https://example.com
# Output: ./evidence/2026-02-03T10-30-00/ with annotated screenshots

# Opt-out: No evidence saving
npm run start -- --vision --no-save-evidence https://example.com

# Opt-out: No annotations (plain screenshots)
npm run start -- --vision --no-annotate-screenshots https://example.com

# Custom directory (still works)
npm run start -- --vision --evidence-dir ./my-reports https://example.com

# BACKWARD COMPATIBLE: Old scripts still work
npm run start -- --vision --save-evidence --annotate-screenshots https://example.com
```

---

## Session Handoff Notes

**Key changes**:
- `saveEvidence` and `annotateScreenshots` flip from `false` to `true`
- New opt-out flags: `--no-save-evidence`, `--no-annotate-screenshots`
- Default evidence dir: `./evidence/{ISO-timestamp}/`
- Old flags still accepted for backward compatibility

**Test command after implementation**:
```bash
# This should now save evidence + annotate by default:
npm run start -- --vision https://www.peregrineclothing.co.uk/products/lynton-polo-shirt
```

**Verify**:
- Evidence directory created automatically
- Screenshots have bounding boxes
- Old scripts with explicit flags still work
