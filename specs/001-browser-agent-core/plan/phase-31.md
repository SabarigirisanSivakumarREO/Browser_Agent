# Phase 31: Browser Interaction Tools

**Date**: 2026-03-24
**Spec**: `spec/requirements-phase31.md`
**Tasks**: `tasks/phase-31.md`

## Summary

Add 13 browser interaction tools to transform the CRO agent from a
passive observer into an active browser operator. Tools are grouped by
priority: P0 (type_text, press_key, select_option, extract_text), P1
(hover, go_back, wait_for, dismiss_blocker), P2 (switch_tab,
upload_file, execute_js), P3 (drag_and_drop, get_ax_tree).

All tools follow the existing navigation tool pattern: implement `Tool`
interface, Zod params with coercion, `insights: []`, state changes in
`extracted`, never throw.

## Technical Context

**Existing Pattern** (from click-tool.ts, scroll-tool.ts):
- Implement `Tool` interface from `src/agent/tools/types.js`
- Zod schema with `z.coerce.number()` for LLM string inputs
- Find element via `findElementByIndex(context.state.domTree.root, index)`
- Interact via `context.page.locator(\`xpath=\${element.xpath}\`)`
- Return `{ success, insights: [], extracted: { ...data } }`
- Catch all errors, return `{ success: false, insights: [], error }`

**Key Playwright APIs Used**:
| Tool | Playwright API | Timeout |
|------|---------------|---------|
| type_text | `locator.fill(text)` / `locator.clear()` | 10s |
| press_key | `page.keyboard.press(key)` | 10s |
| select_option | `locator.selectOption({ value/label })` | 10s |
| hover | `locator.hover()` | 10s |
| go_back | `page.goBack()` | 30s |
| wait_for | `page.waitForSelector()` / `page.waitForURL()` | configurable |
| switch_tab | `context.pages()` + page focus | 10s |
| upload_file | `locator.setInputFiles(paths)` | 10s |
| execute_js | `page.evaluate(expr)` | 10s |
| drag_and_drop | `source.dragTo(target)` | 10s |
| dismiss_blocker | `CookieConsentHandler.dismiss()` | 10s |
| extract_text | `page.innerText('body')` / `locator.innerText()` | 10s |
| get_ax_tree | `captureAccessibilityTree(page)` | 10s |

**Element Resolution Pattern** (shared with click-tool):
```typescript
const element = findElementByIndex(context.state.domTree.root, elementIndex);
if (!element) {
  return { success: false, insights: [], error: `Element with index ${elementIndex} not found` };
}
const locator = context.page.locator(`xpath=${element.xpath}`);
```

**CROActionName Registration** (src/models/tool-definition.ts):
```typescript
export const CROActionNames = [
  // ... existing 13 ...
  // Phase 31: Browser interaction tools
  'type_text',
  'press_key',
  'select_option',
  'extract_text',
  'hover',
  'go_back',
  'wait_for',
  'dismiss_blocker',
  'switch_tab',
  'upload_file',
  'execute_js',
  'drag_and_drop',
  'get_ax_tree',
] as const;
```

## Sub-phases

### 31a: Foundation — CROActionName Registration

**Files**:
- MODIFY: `src/models/tool-definition.ts` — add 13 names to
  `CROActionNames`
- MODIFY: `src/agent/tools/create-cro-registry.ts` — import and
  register 13 tools (done incrementally per sub-phase)
- MODIFY: `src/agent/tools/cro/index.ts` — barrel exports (done
  incrementally)

Register all 13 names upfront so TypeScript is happy throughout.
Tools are registered in the factory as each sub-phase completes.

### 31b: P0 Tools — type_text, press_key, select_option, extract_text

**Files**:
- NEW: `src/agent/tools/cro/type-text-tool.ts` (~80 lines)
- NEW: `src/agent/tools/cro/press-key-tool.ts` (~60 lines)
- NEW: `src/agent/tools/cro/select-option-tool.ts` (~80 lines)
- NEW: `src/agent/tools/cro/extract-text-tool.ts` (~70 lines)
- NEW: `tests/unit/tools/p0-interaction-tools.test.ts`

**type_text** params:
```typescript
z.object({
  elementIndex: z.coerce.number().int().nonnegative(),
  text: z.string().min(1),
  clearFirst: coerceBoolean.optional().default(true),
})
```

**press_key** params:
```typescript
z.object({
  key: z.string().min(1),  // "Enter", "Escape", "Tab", "Control+a"
})
```

**select_option** params:
```typescript
z.object({
  elementIndex: z.coerce.number().int().nonnegative(),
  value: z.string().optional(),
  label: z.string().optional(),
}).refine(d => d.value || d.label, { message: 'Either value or label required' })
```

**extract_text** params:
```typescript
z.object({
  selector: z.string().optional(),
  maxLength: z.coerce.number().positive().optional().default(8000),
})
```

### 31c: P1 Tools — hover, go_back, wait_for, dismiss_blocker

**Files**:
- NEW: `src/agent/tools/cro/hover-tool.ts` (~60 lines)
- NEW: `src/agent/tools/cro/go-back-tool.ts` (~50 lines)
- NEW: `src/agent/tools/cro/wait-for-tool.ts` (~100 lines)
- NEW: `src/agent/tools/cro/dismiss-blocker-tool.ts` (~60 lines)
- NEW: `tests/unit/tools/p1-interaction-tools.test.ts`

**hover** params:
```typescript
z.object({
  elementIndex: z.coerce.number().int().nonnegative(),
})
```

**go_back** params:
```typescript
z.object({
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional().default('load'),
})
```

**wait_for** params:
```typescript
z.object({
  condition: z.enum(['selector', 'url_contains', 'network_idle', 'timeout']),
  value: z.string().optional(),
  timeoutMs: z.coerce.number().positive().max(30000).optional().default(10000),
})
```

**dismiss_blocker** params:
```typescript
z.object({
  strategy: z.enum(['auto', 'cookie', 'modal', 'overlay']).optional().default('auto'),
})
```

**dismiss_blocker implementation**:
- Import `CookieConsentHandler` from `src/browser/cookie-handler.ts`
- Instantiate with page, call `dismiss()`
- Wrap `CookieConsentResult` into `ToolResult`

### 31d: P2 Tools — switch_tab, upload_file, execute_js

**Files**:
- NEW: `src/agent/tools/cro/switch-tab-tool.ts` (~70 lines)
- NEW: `src/agent/tools/cro/upload-file-tool.ts` (~70 lines)
- NEW: `src/agent/tools/cro/execute-js-tool.ts` (~60 lines)
- NEW: `tests/unit/tools/p2-interaction-tools.test.ts`

**switch_tab** params:
```typescript
z.object({
  tabIndex: z.coerce.number().int().nonnegative(),
})
```

**switch_tab implementation**:
- Access browser context via `context.page.context()`
- Get all pages: `context.page.context().pages()`
- Validate tabIndex bounds
- Bring target page to front: `pages[tabIndex].bringToFront()`
- Return new page URL and title

**upload_file** params:
```typescript
z.object({
  elementIndex: z.coerce.number().int().nonnegative(),
  filePaths: z.array(z.string()).min(1),
})
```

**execute_js** params:
```typescript
z.object({
  expression: z.string().min(1),
})
```

### 31e: P3 Tools — drag_and_drop, get_ax_tree

**Files**:
- NEW: `src/agent/tools/cro/drag-and-drop-tool.ts` (~70 lines)
- NEW: `src/agent/tools/cro/get-ax-tree-tool.ts` (~50 lines)
- NEW: `tests/unit/tools/p3-interaction-tools.test.ts`

**drag_and_drop** params:
```typescript
z.object({
  sourceIndex: z.coerce.number().int().nonnegative(),
  targetIndex: z.coerce.number().int().nonnegative(),
})
```

**get_ax_tree** params:
```typescript
z.object({
  maxTokens: z.coerce.number().positive().optional().default(500),
})
```

**get_ax_tree implementation**:
- Import `captureAccessibilityTree` from `src/browser/ax-tree-serializer.ts`
- Call with `context.page` and `{ maxTokens }`
- Return serialized tree in `extracted`

### 31f: Registry Wiring & Integration

**Files**:
- MODIFY: `src/agent/tools/create-cro-registry.ts` — register all 13
- MODIFY: `src/agent/tools/cro/index.ts` — export all 13
- NEW: `tests/integration/interaction-tools.test.ts` — 6 integration
  tests with real browser

**Integration tests** (require Playwright browser):
1. type_text fills an input field on example page
2. press_key Enter submits form
3. hover reveals hidden element
4. go_back navigates to previous page
5. extract_text retrieves page content
6. Full tool count is 26 (13 old + 13 new)

### 31g: Regression Validation

**Tests**:
- Run full suite: `npm test` — all 1317+ existing tests pass
- Verify `getToolDefinitions()` returns 26 tool definitions
- Update quickstart.md with Phase 31 status

## Dependencies

```
31a (CROActionNames) ← start immediately
  ↓
31b (P0 tools) ←─── depends on 31a
  ↓
31c (P1 tools) ←─── depends on 31a, can parallel with 31b
  ↓
31d (P2 tools) ←─── depends on 31a, can parallel with 31b/c
  ↓
31e (P3 tools) ←─── depends on 31a, can parallel with 31b/c/d
  ↓
31f (wiring) ←───── depends on 31b + 31c + 31d + 31e
  ↓
31g (validation) ←─ depends on 31f
```

## Session Plan

- **Session 1**: 31a + 31b (foundation + P0 tools) — ~12 tasks, ~16 tests
- **Session 2**: 31c + 31d (P1 + P2 tools) — ~12 tasks, ~14 tests
- **Session 3**: 31e + 31f + 31g (P3 + wiring + validation) — ~10 tasks, ~10 tests

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| CROActionName union grows large (26) | Certain | Low | Union type is just strings, no perf impact |
| LLM confused by 26 tools | Medium | Medium | Descriptions must be very clear; group by category |
| switch_tab breaks page reference | Low | High | Store original page ref, restore on failure |
| execute_js security risk | Medium | Medium | Documented as escape hatch, user responsibility |
| Existing tests break | Low | High | All new tools are additive, no existing code modified except registry |
| findElementByIndex shared dependency | Low | Low | Already battle-tested in click-tool |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality | ✅ | Each tool < 150 lines, single responsibility |
| II. TypeScript Strict | ✅ | Zod schemas, explicit return types |
| III. Perception Layer | ✅ | extract_text + get_ax_tree extend perception |
| IV. Error Handling | ✅ | Never throw pattern, all errors caught |
| V. LLM Integration | ✅ | Tool descriptions for LLM, coerced params |
| VI. Cost & Performance | ✅ | No LLM calls in tools, pure Playwright |
| VII. Modular Architecture | ✅ | One file per tool, barrel exports |
| VIII. Testing Discipline | ✅ | Unit + integration tests per priority tier |
| IX. Security | ✅ | execute_js documented as user-responsibility |
| X. Production Readiness | ✅ | All magic values in constants |
