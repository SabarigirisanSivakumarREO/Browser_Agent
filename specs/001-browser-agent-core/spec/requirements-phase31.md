# Requirements: Phase 31 — Browser Interaction Tools

**Phase**: 31
**Created**: 2026-03-24
**Status**: Draft

## Overview

Add 13 browser interaction tools ("hands") to the CRO agent, enabling it
to type text, press keys, hover elements, select dropdowns, navigate
back, wait for conditions, switch tabs, upload files, dismiss blockers,
extract text, execute JavaScript, drag-and-drop, and retrieve the
accessibility tree as a tool. These transform the agent from a passive
CRO observer into an active browser operator competitive with
browser-use and Stagehand.

## Competitive Context

| Capability | browser-use | Stagehand v3 | Claude CU | This Agent (current) | This Agent (Phase 31) |
|-----------|:-----------:|:------------:|:---------:|:--------------------:|:---------------------:|
| Type text | fill, type | act, fillForm | type | — | type_text |
| Press key | press_key | keys | key | — | press_key |
| Hover | — | act | mouse_move | — | hover |
| Select dropdown | select | fillForm | — | — | select_option |
| Go back | go_back | navback | — | — | go_back |
| Wait | implicit | wait | wait | — | wait_for |
| Switch tab | switch_tab | — | — | — | switch_tab |
| Upload file | upload_file | — | — | — | upload_file |
| Dismiss blocker | — | — | — | cookie-handler (internal) | dismiss_blocker |
| Extract text | extract_text | extract | — | — | extract_text |
| Execute JS | execute_javascript | — | — | — | execute_js |
| Drag & drop | — | dragAndDrop | left_click_drag | — | drag_and_drop |
| A11y tree tool | — | ariaTree | — | ax-tree (internal) | get_ax_tree |

## User Stories

### US-31a: Text Input (P0)

As the agent, I need to type text into input fields so I can fill
search boxes, login forms, and text areas.

**Acceptance Scenarios**:

1. **Given** an input field at DOM index 5, **When** `type_text` is
   called with `{ elementIndex: 5, text: "hello" }`, **Then** the
   field value becomes "hello".
2. **Given** a pre-filled field, **When** `clearFirst: true`, **Then**
   existing text is cleared before typing.
3. **Given** a non-existent index, **When** called, **Then** returns
   `{ success: false, error: "Element with index N not found" }`.

### US-31b: Keyboard Actions (P0)

As the agent, I need to press keyboard keys so I can submit forms
(Enter), close modals (Escape), navigate between fields (Tab), and
use shortcuts (Ctrl+A).

**Acceptance Scenarios**:

1. **Given** a focused input, **When** `press_key` with `key: "Enter"`,
   **Then** form submission or equivalent action occurs.
2. **Given** a modal, **When** `press_key` with `key: "Escape"`,
   **Then** the modal closes.
3. **Given** `key: "Control+a"`, **When** called, **Then** select-all
   shortcut fires.

### US-31c: Hover (P1)

As the agent, I need to hover over elements to reveal dropdown menus,
tooltips, and hidden content.

**Acceptance Scenarios**:

1. **Given** a nav menu item, **When** `hover` with its index, **Then**
   the dropdown submenu becomes visible.
2. **Given** an element with a tooltip, **When** hovered, **Then** the
   tooltip text appears in the DOM.

### US-31d: Select Option (P0)

As the agent, I need to select dropdown options so I can interact with
select elements (size, color, quantity, country pickers).

**Acceptance Scenarios**:

1. **Given** a `<select>` at index 8, **When** `select_option` with
   `value: "blue"`, **Then** the option is selected.
2. **Given** `label: "Large"`, **When** called, **Then** the option
   with matching visible text is selected.

### US-31e: Navigation & Waiting (P1)

As the agent, I need to go back in browser history and wait for page
conditions so I can navigate multi-page flows and handle SPAs.

**Acceptance Scenarios**:

1. **Given** navigation history, **When** `go_back` called, **Then**
   the previous page loads.
2. **Given** `wait_for` with `selector: ".results"`, **When** the
   element appears within timeout, **Then** returns success.
3. **Given** `wait_for` with `url_contains: "/checkout"`, **When**
   URL matches, **Then** returns success.

### US-31f: Tab Management (P2)

As the agent, I need to switch between browser tabs to handle popups,
`target="_blank"` links, and OAuth flows.

**Acceptance Scenarios**:

1. **Given** 3 open tabs, **When** `switch_tab` with `tabIndex: 1`,
   **Then** the agent operates on tab 1.
2. **Given** a new popup, **When** switching to it, **Then** page
   operations work on the popup.

### US-31g: File Upload (P2)

As the agent, I need to upload files through file input elements.

**Acceptance Scenarios**:

1. **Given** a file input, **When** `upload_file` with a valid path,
   **Then** the file is attached.

### US-31h: Dismiss Blocker (P1)

As the agent, I need to dismiss cookie banners, modals, and overlays
that block interaction — exposed as a callable tool (currently only
internal).

**Acceptance Scenarios**:

1. **Given** a cookie consent banner, **When** `dismiss_blocker`
   called, **Then** the banner is dismissed and result reports success.
2. **Given** no blocker present, **When** called, **Then** returns
   success with `dismissed: false`.

### US-31i: Content Extraction (P0)

As the agent, I need to extract visible text and the accessibility tree
from the current page so the LLM can reason about page content without
a full viewport capture.

**Acceptance Scenarios**:

1. **Given** a page, **When** `extract_text` with
   `selector: ".product-title"`, **Then** returns the text content.
2. **Given** no selector, **When** called, **Then** returns full page
   visible text (truncated to budget).
3. **Given** a page, **When** `get_ax_tree` called, **Then** returns
   serialized accessibility tree as text.

### US-31j: JavaScript Execution (P2)

As the agent, I need to execute arbitrary JavaScript as an escape hatch
for interactions not covered by other tools.

**Acceptance Scenarios**:

1. **Given** JS expression `document.title`, **When** `execute_js`
   called, **Then** returns the page title.
2. **Given** mutating JS, **When** called, **Then** the DOM changes
   and result is returned.

### US-31k: Drag and Drop (P3)

As the agent, I need to drag elements between positions for reordering,
file drop zones, and slider interactions.

**Acceptance Scenarios**:

1. **Given** source element and target element, **When** `drag_and_drop`
   called, **Then** the source is moved to the target position.

## Functional Requirements

### Type Registration (Foundation)

- **FR-31-001**: Each new tool MUST be added to `CROActionNames` array
  in `src/models/tool-definition.ts`.
- **FR-31-002**: Each new tool MUST be registered in
  `createCRORegistry()` in `src/agent/tools/create-cro-registry.ts`.
- **FR-31-003**: Each new tool MUST export: `{toolName}Tool` (Tool
  object), `{ToolName}ParamsSchema` (Zod schema),
  `type {ToolName}Params` (inferred type).
- **FR-31-004**: Each new tool MUST be exported from
  `src/agent/tools/cro/index.ts` barrel.
- **FR-31-005**: All tools MUST follow the navigation tool pattern:
  `insights: []` (empty array), data in `extracted`.
- **FR-31-006**: All tools MUST never throw — catch all errors, return
  `{ success: false, insights: [], error: message }`.
- **FR-31-007**: All Playwright element actions MUST have 10s timeout.
- **FR-31-008**: All Playwright navigation actions MUST have 30s timeout.

### P0 Tools (Critical)

- **FR-31-010**: `type_text` MUST locate element by DOM index (same
  pattern as `click`), optionally clear first, then call
  `locator.fill(text)`.
- **FR-31-011**: `type_text` MUST support `clearFirst` boolean param
  (default: true).
- **FR-31-012**: `press_key` MUST accept key name string and call
  `page.keyboard.press(key)`.
- **FR-31-013**: `press_key` MUST support modifier combinations:
  `Control+a`, `Shift+Enter`, `Alt+Tab`.
- **FR-31-014**: `select_option` MUST locate `<select>` by DOM index
  and call `locator.selectOption()` with either `value` or `label`.
- **FR-31-015**: `extract_text` MUST accept optional `selector` param.
  With selector: extract matching element text. Without: extract
  `page.innerText('body')` truncated to 8000 chars.

### P1 Tools (High)

- **FR-31-020**: `hover` MUST locate element by DOM index and call
  `locator.hover()` with 10s timeout.
- **FR-31-021**: `go_back` MUST call `page.goBack()` with 30s timeout
  and return new URL.
- **FR-31-022**: `wait_for` MUST support 4 condition types:
  `selector` (element visible), `url_contains` (URL substring),
  `network_idle` (no pending requests), `timeout` (fixed delay).
- **FR-31-023**: `wait_for` MUST accept `timeoutMs` param (default:
  10000, max: 30000).
- **FR-31-024**: `dismiss_blocker` MUST delegate to existing
  `CookieConsentHandler.dismiss()` and wrap result as `ToolResult`.

### P2 Tools (Medium)

- **FR-31-030**: `switch_tab` MUST accept `tabIndex` number, get all
  pages from browser context, switch to target page.
- **FR-31-031**: `upload_file` MUST locate file input by DOM index and
  call `locator.setInputFiles(filePaths)`.
- **FR-31-032**: `execute_js` MUST call `page.evaluate(expression)` and
  return the result as `extracted`.
- **FR-31-033**: `execute_js` MUST have 10s timeout via
  `page.evaluate` options.

### P3 Tools (Later)

- **FR-31-040**: `drag_and_drop` MUST accept `sourceIndex` and
  `targetIndex`, locate both elements, call
  `source.dragTo(target)`.
- **FR-31-041**: `get_ax_tree` MUST delegate to existing
  `captureAccessibilityTree()` and return serialized text as
  `extracted`.

## Non-Functional Requirements

- **NFR-31-001**: Adding 13 tools MUST NOT break any existing 1317
  tests.
- **NFR-31-002**: Each tool file MUST stay under 150 lines (simple
  interaction tools should be 50-80 lines).
- **NFR-31-003**: Tool parameter schemas MUST use `z.coerce` for
  numeric params (LLM sends strings).
- **NFR-31-004**: All tool descriptions MUST be LLM-friendly (clear,
  concise, include usage hints).

## Edge Cases

- `type_text` on non-input element: return error "Element is not an
  input field"
- `select_option` on non-select element: return error
- `press_key` with invalid key name: Playwright throws, catch and
  return error
- `wait_for` timeout exceeded: return `{ success: false, error:
  "Timeout waiting for condition" }`
- `switch_tab` with invalid index: return error with available tab count
- `upload_file` with non-existent file: return error
- `execute_js` syntax error: catch and return error
- `go_back` with no history: returns current URL, success: true
- `drag_and_drop` with same source/target: return success (no-op)
- `dismiss_blocker` no blocker found: return `{ success: true,
  dismissed: false }`
- `hover` element not visible: Playwright auto-scrolls, but if still
  fails return error
- `extract_text` empty page: return empty string, success: true
- `get_ax_tree` capture failure: return null in extracted, success: true

## Success Criteria

- **SC-31-001**: All 13 tools registered and callable via ToolExecutor.
- **SC-31-002**: All P0 tools pass unit + integration tests.
- **SC-31-003**: All 1317+ existing tests pass (zero regressions).
- **SC-31-004**: `getToolDefinitions()` returns 26 tools (13 existing +
  13 new).
- **SC-31-005**: Each tool file under 150 lines.
