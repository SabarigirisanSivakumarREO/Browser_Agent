# Tasks: Phase 31 — Browser Interaction Tools

**Spec**: `spec/requirements-phase31.md`
**Plan**: `plan/phase-31.md`
**Total Tasks**: 34 (T673-T706)
**Total Tests**: ~40 (26 unit + 8 integration + regression)

## Phase 31a: Foundation — CROActionName Registration

**Goal**: Register all 13 new action names so TypeScript compiles throughout.

- [x] T673 Add 13 new names to `CROActionNames` array in `src/models/tool-definition.ts`: `'type_text'`, `'press_key'`, `'select_option'`, `'extract_text'`, `'hover'`, `'go_back'`, `'wait_for'`, `'dismiss_blocker'`, `'switch_tab'`, `'upload_file'`, `'execute_js'`, `'drag_and_drop'`, `'get_ax_tree'` — add after `'done'` with comment `// Phase 31: Browser interaction tools`
- [x] T674 Run `npm run typecheck` — verify PASS (names are just string literals, no implementations yet)
- [x] T675 Commit: `feat(phase-31): register 13 browser interaction tool names`

**Checkpoint**: TypeScript knows all 26 tool names. No tools implemented yet.

---

## Phase 31b: P0 Tools — type_text, press_key, select_option, extract_text

**Goal**: The 4 most critical interaction tools every browser agent needs.

### type_text

- [x] T676 Create `src/agent/tools/cro/type-text-tool.ts`:
  - Schema: `{ elementIndex: z.coerce.number().int().nonnegative(), text: z.string().min(1), clearFirst: coerceBoolean.optional().default(true) }`
  - Implementation: find element by index via `findElementByIndex(context.state.domTree.root, elementIndex)`, build locator `context.page.locator(\`xpath=\${element.xpath}\`)`, if `clearFirst` call `locator.clear()` then `locator.fill(text)`, else call `locator.fill(text)` directly. Timeout: 10s.
  - Extracted: `{ typedText, elementXpath, elementTag, cleared }`
  - Error cases: element not found, element not an input/textarea/contenteditable (check `element.tagName`), Playwright timeout
  - Export: `typeTextTool`, `TypeTextParamsSchema`, `type TypeTextParams`
  - Use `coerceBoolean` helper (same as click-tool.ts pattern: `z.preprocess(val => typeof val === 'string' ? val.toLowerCase() === 'true' : val, z.boolean())`)
  - Add `findElementByIndex` import from shared location or inline (check click-tool.ts for exact import path)

### press_key

- [x] T677 Create `src/agent/tools/cro/press-key-tool.ts`:
  - Schema: `{ key: z.string().min(1) }`
  - Implementation: call `context.page.keyboard.press(key)` with 10s timeout. Key format follows Playwright conventions: `"Enter"`, `"Escape"`, `"Tab"`, `"ArrowDown"`, `"Control+a"`, `"Shift+Enter"`, `"Meta+c"`.
  - Extracted: `{ keyPressed: key }`
  - Error cases: invalid key name (Playwright throws), timeout
  - Export: `pressKeyTool`, `PressKeyParamsSchema`, `type PressKeyParams`

### select_option

- [x] T678 Create `src/agent/tools/cro/select-option-tool.ts`:
  - Schema: `z.object({ elementIndex: z.coerce.number().int().nonnegative(), value: z.string().optional(), label: z.string().optional() }).refine(d => d.value || d.label, { message: 'Either value or label required' })`
  - Implementation: find element by index, verify tagName is `'SELECT'` (case-insensitive), build locator, call `locator.selectOption({ value })` or `locator.selectOption({ label })`. Timeout: 10s.
  - Extracted: `{ selectedValue, selectedLabel, elementXpath }`
  - Error cases: element not found, element not a select, option not found, timeout
  - Export: `selectOptionTool`, `SelectOptionParamsSchema`, `type SelectOptionParams`

### extract_text

- [x] T679 Create `src/agent/tools/cro/extract-text-tool.ts`:
  - Schema: `{ selector: z.string().optional(), maxLength: z.coerce.number().positive().optional().default(8000) }`
  - Implementation: if `selector` provided, call `context.page.locator(selector).innerText()` with 10s timeout. If no selector, call `context.page.innerText('body')`. Truncate result to `maxLength` chars with `[...truncated, showing first N of M chars]` marker.
  - Extracted: `{ text, length, truncated, selector: selector || 'body' }`
  - Error cases: selector not found, timeout, empty page
  - Export: `extractTextTool`, `ExtractTextParamsSchema`, `type ExtractTextParams`

### P0 Tests

- [x] T680 [P] Create `tests/unit/tools/p0-interaction-tools.test.ts` — 10 tests:
  1. type_text: fills input field (mock locator.fill called with text)
  2. type_text: clears before typing when clearFirst=true
  3. type_text: returns error when element not found
  4. type_text: returns error when element is not input/textarea
  5. press_key: calls page.keyboard.press with correct key
  6. press_key: handles modifier combos (Control+a)
  7. press_key: returns error on invalid key
  8. select_option: selects by value
  9. select_option: selects by label
  10. extract_text: returns truncated body text

### P0 Wiring

- [x] T681 Export all 4 P0 tools from `src/agent/tools/cro/index.ts`
- [x] T682 Import and register all 4 P0 tools in `src/agent/tools/create-cro-registry.ts`
- [x] T683 Run `npm run typecheck && npm run test:unit` — verify all pass
- [x] T684 Commit: `feat(phase-31): add P0 interaction tools — type_text, press_key, select_option, extract_text`

**Checkpoint**: 4 P0 tools registered and tested. Registry has 17 tools. 10 new unit tests.

---

## Phase 31c: P1 Tools — hover, go_back, wait_for, dismiss_blocker

**Goal**: Navigation support and blocker dismissal.

### hover

- [x] T685 Create `src/agent/tools/cro/hover-tool.ts`:
  - Schema: `{ elementIndex: z.coerce.number().int().nonnegative() }`
  - Implementation: find element by index, `locator.hover({ timeout: 10000 })`. Playwright auto-scrolls to element before hovering.
  - Extracted: `{ hoveredXpath, elementText, elementTag }`
  - Export: `hoverTool`, `HoverParamsSchema`, `type HoverParams`

### go_back

- [x] T686 Create `src/agent/tools/cro/go-back-tool.ts`:
  - Schema: `{ waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional().default('load') }`
  - Implementation: record `previousUrl = context.page.url()`, call `context.page.goBack({ waitUntil, timeout: 30000 })`. If response is null (no history), return success with same URL.
  - Extracted: `{ previousUrl, newUrl, navigationOccurred }`
  - Export: `goBackTool`, `GoBackParamsSchema`, `type GoBackParams`

### wait_for

- [x] T687 Create `src/agent/tools/cro/wait-for-tool.ts`:
  - Schema: `{ condition: z.enum(['selector', 'url_contains', 'network_idle', 'timeout']), value: z.string().optional(), timeoutMs: z.coerce.number().positive().max(30000).optional().default(10000) }`
  - Refine: if condition is `selector` or `url_contains`, value is required
  - Implementation:
    - `selector`: `context.page.waitForSelector(value, { state: 'visible', timeout: timeoutMs })`
    - `url_contains`: `context.page.waitForURL(url => url.toString().includes(value), { timeout: timeoutMs })`
    - `network_idle`: `context.page.waitForLoadState('networkidle', { timeout: timeoutMs })`
    - `timeout`: `context.page.waitForTimeout(timeoutMs)`
  - Extracted: `{ condition, value, waited: true, actualUrl: context.page.url() }`
  - Export: `waitForTool`, `WaitForParamsSchema`, `type WaitForParams`

### dismiss_blocker

- [x] T688 Create `src/agent/tools/cro/dismiss-blocker-tool.ts`:
  - Schema: `{ strategy: z.enum(['auto', 'cookie', 'modal', 'overlay']).optional().default('auto') }`
  - Implementation: import `CookieConsentHandler` from `../../browser/cookie-handler.js`. Instantiate `new CookieConsentHandler(context.page, { timeout: 10000 })` (check constructor signature). Call `handler.dismiss()`. Map `CookieConsentResult` to `ToolResult`:
    - `dismissed: true` → `{ success: true, extracted: { dismissed: true, mode, buttonText } }`
    - `dismissed: false` → `{ success: true, extracted: { dismissed: false, mode: 'none' } }`
  - Note: Even when no blocker found, return `success: true` (absence of blocker is not an error)
  - Export: `dismissBlockerTool`, `DismissBlockerParamsSchema`, `type DismissBlockerParams`

### P1 Tests

- [x] T689 [P] Create `tests/unit/tools/p1-interaction-tools.test.ts` — 8 tests:
  1. hover: calls locator.hover on correct element
  2. hover: returns error when element not found
  3. go_back: calls page.goBack and returns URLs
  4. go_back: handles no history (null response)
  5. wait_for selector: calls waitForSelector with value
  6. wait_for url_contains: calls waitForURL with predicate
  7. wait_for timeout exceeded: returns error
  8. dismiss_blocker: wraps CookieConsentHandler result

### P1 Wiring

- [x] T690 Export all 4 P1 tools from `src/agent/tools/cro/index.ts`
- [x] T691 Import and register all 4 P1 tools in `src/agent/tools/create-cro-registry.ts`
- [x] T692 Run `npm run typecheck && npm run test:unit` — verify all pass
- [x] T693 Commit: `feat(phase-31): add P1 interaction tools — hover, go_back, wait_for, dismiss_blocker`

**Checkpoint**: 8 P1 tools registered. Registry has 21 tools. 18 new unit tests cumulative.

---

## Phase 31d: P2 Tools — switch_tab, upload_file, execute_js

**Goal**: Tab management, file uploads, and JS escape hatch.

### switch_tab

- [x] T694 Create `src/agent/tools/cro/switch-tab-tool.ts`:
  - Schema: `{ tabIndex: z.coerce.number().int().nonnegative() }`
  - Implementation: get all pages `const pages = context.page.context().pages()`. Validate `tabIndex < pages.length` (return error with `availableTabs: pages.length` if out of bounds). Call `pages[tabIndex].bringToFront()`. Return new page info.
  - Extracted: `{ previousUrl, newUrl, newTitle, tabIndex, totalTabs }`
  - Note: This tool does NOT change `context.page` — the caller (agent loop) must handle page switching if needed. The tool only brings the tab to front.
  - Export: `switchTabTool`, `SwitchTabParamsSchema`, `type SwitchTabParams`

### upload_file

- [x] T695 Create `src/agent/tools/cro/upload-file-tool.ts`:
  - Schema: `{ elementIndex: z.coerce.number().int().nonnegative(), filePaths: z.array(z.string()).min(1) }`
  - Implementation: find element by index, verify tagName is `'INPUT'` and has `type="file"` attribute (check `element.attributes?.type`). Build locator, call `locator.setInputFiles(filePaths)`. Timeout: 10s.
  - Extracted: `{ uploadedFiles: filePaths, elementXpath }`
  - Error cases: element not found, not a file input, file not found (Playwright throws)
  - Export: `uploadFileTool`, `UploadFileParamsSchema`, `type UploadFileParams`

### execute_js

- [x] T696 Create `src/agent/tools/cro/execute-js-tool.ts`:
  - Schema: `{ expression: z.string().min(1) }`
  - Implementation: call `context.page.evaluate(expression)` wrapped in a timeout Promise (`Promise.race` with 10s timeout). Serialize result: if object, `JSON.stringify(result, null, 2)` truncated to 8000 chars. If primitive, `String(result)`.
  - Extracted: `{ result: serializedResult, type: typeof rawResult }`
  - Error cases: JS syntax error, evaluation error, timeout, serialization error
  - Security note in description: "Execute JavaScript in page context. Use as escape hatch for interactions not covered by other tools."
  - Export: `executeJsTool`, `ExecuteJsParamsSchema`, `type ExecuteJsParams`

### P2 Tests

- [x] T697 [P] Create `tests/unit/tools/p2-interaction-tools.test.ts` — 6 tests:
  1. switch_tab: brings correct tab to front
  2. switch_tab: returns error for invalid tabIndex
  3. upload_file: calls setInputFiles with paths
  4. upload_file: returns error for non-file-input element
  5. execute_js: evaluates expression and returns result
  6. execute_js: returns error on syntax error

### P2 Wiring

- [x] T698 Export all 3 P2 tools from `src/agent/tools/cro/index.ts`
- [x] T699 Import and register all 3 P2 tools in `src/agent/tools/create-cro-registry.ts`
- [x] T700 Run `npm run typecheck && npm run test:unit` — verify all pass
- [x] T701 Commit: `feat(phase-31): add P2 interaction tools — switch_tab, upload_file, execute_js`

**Checkpoint**: 11 P2 tools registered. Registry has 24 tools. 24 new unit tests cumulative.

---

## Phase 31e: P3 Tools — drag_and_drop, get_ax_tree

**Goal**: Drag interaction and accessibility tree as a callable tool.

### drag_and_drop

- [x] T702 Create `src/agent/tools/cro/drag-and-drop-tool.ts`:
  - Schema: `{ sourceIndex: z.coerce.number().int().nonnegative(), targetIndex: z.coerce.number().int().nonnegative() }`
  - Implementation: find source and target elements by index. Build locators for both. Call `sourceLocator.dragTo(targetLocator, { timeout: 10000 })`. If sourceIndex === targetIndex, return success (no-op).
  - Extracted: `{ sourceXpath, targetXpath, sourceText, targetText }`
  - Export: `dragAndDropTool`, `DragAndDropParamsSchema`, `type DragAndDropParams`

### get_ax_tree

- [x] T703 Create `src/agent/tools/cro/get-ax-tree-tool.ts`:
  - Schema: `{ maxTokens: z.coerce.number().positive().optional().default(500) }`
  - Implementation: import `captureAccessibilityTree` from `../../../browser/ax-tree-serializer.js`. Call `captureAccessibilityTree(context.page, { maxTokens })`. If result is null, return `{ success: true, extracted: { axTree: null, reason: 'empty or capture failed' } }`.
  - Extracted: `{ axTree: serializedText, tokenEstimate: Math.ceil(text.length / 4) }`
  - Export: `getAxTreeTool`, `GetAxTreeParamsSchema`, `type GetAxTreeParams`

### P3 Tests

- [x] T704 [P] Create `tests/unit/tools/p3-interaction-tools.test.ts` — 4 tests:
  1. drag_and_drop: calls sourceLocator.dragTo(targetLocator)
  2. drag_and_drop: handles same source/target (no-op)
  3. get_ax_tree: returns serialized accessibility tree
  4. get_ax_tree: returns null when capture fails

**Checkpoint**: 13 tools implemented. 28 new unit tests cumulative.

---

## Phase 31f: Registry Wiring & Integration Tests

**Goal**: All 13 tools registered, integration tests with real browser.

- [x] T705 [P] Final wiring verification:
  - Export all P3 tools from `src/agent/tools/cro/index.ts`
  - Register all P3 tools in `src/agent/tools/create-cro-registry.ts`
  - Run `npm run typecheck` — verify PASS
  - Verify `createCRORegistry().size === 26`
  - Create `tests/integration/interaction-tools.test.ts` — 8 integration tests (real Playwright browser):
    1. type_text fills input on data:text/html test page
    2. press_key Enter triggers form submit
    3. select_option picks dropdown value
    4. hover changes element visibility (CSS :hover)
    5. go_back navigates history
    6. extract_text returns page body text
    7. wait_for selector resolves when element appears
    8. Tool registry has 26 tools total
  - Run `npm run test:unit && npm run test:integration` — verify all pass
- [x] T706 Commit: `feat(phase-31): wire all 13 interaction tools + integration tests`

**Checkpoint**: All 26 tools registered and tested. ~36 new tests total.

---

## Phase 31g: Regression & Documentation

**Goal**: Zero regressions, updated docs.

- [x] T707 Run `npm test` — verify all 1317+ existing tests pass alongside new tests
- [x] T708 Update `specs/001-browser-agent-core/quickstart.md`:
  - Add Phase 31 to status section
  - Update tool count (13 → 26)
  - Add new tool names to architecture table
- [x] T709 Commit: `docs(phase-31): update quickstart with browser interaction tools status`

**Checkpoint**: Phase 31 complete. All tests pass. Docs updated.

---

## Dependencies & Execution Order

- **31a** (T673-T675): No dependencies — start immediately
- **31b** (T676-T684): Depends on 31a
- **31c** (T685-T693): Depends on 31a, can parallel with 31b
- **31d** (T694-T701): Depends on 31a, can parallel with 31b/c
- **31e** (T702-T704): Depends on 31a, can parallel with 31b/c/d
- **31f** (T705-T706): Depends on 31b + 31c + 31d + 31e
- **31g** (T707-T709): Depends on 31f

## Session Plan

- **Session 1**: 31a + 31b (T673-T684) — 12 tasks, ~10 unit tests
- **Session 2**: 31c + 31d (T685-T701) — 17 tasks, ~14 unit tests
- **Session 3**: 31e + 31f + 31g (T702-T709) — 8 tasks, ~12 tests (4 unit + 8 integration)
