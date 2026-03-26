# Requirements: Phase 35 — Intelligent Element Perception & Targeting

**Phase**: 35
**Created**: 2026-03-25
**Status**: Draft
**Root Cause**: Agent perceiver returns only 20 header/nav elements in DOM order; product/content links never reach the planner. XPath fallback generates globally unscoped selectors that click wrong elements.

## Problem Statement

The perceiver captures interactive elements via `querySelectorAll` in DOM order with a hard cap of 20. On content-rich pages (Amazon search results, product listings), all 20 slots are consumed by header/navigation elements (logo, search bar, cart, account). Product links, which are the actual targets for goal-directed tasks, never appear in the element list.

Additionally, the XPath fallback (`//a[N]`) is globally unscoped — a product link that is the 1st `<a>` in its parent `<div>` gets `//a[1]`, which Playwright resolves to the first `<a>` in the entire document (the site logo).

The AX tree is capped at 8000 chars, insufficient for dense pages, and has no mapping to element indices — the planner cannot correlate a product name in the AX tree to a clickable element.

## Functional Requirements

### FR-001: Viewport-Aware Element Collection
- Perceiver MUST prioritize elements visible in the current viewport over off-screen elements
- Elements MUST be scored by: (a) within viewport, (b) in main content area vs header/footer, (c) interactive affordance (links with substantial text > icon buttons)
- Element limit MUST increase from 20 to 50
- Elements MUST be sorted by relevance score, not DOM order

### FR-002: Content Area Detection
- Perceiver MUST identify the main content region using ARIA landmarks (`main`, `[role="main"]`), `<main>` tag, or largest content block heuristic
- Elements within the main content area MUST receive higher priority than header/nav/footer elements
- Header/nav/footer elements MUST still be included (capped at 10) for navigation purposes

### FR-003: Robust Selector Generation
- XPath fallback MUST be scoped to the element's parent chain, not global
- Selector priority: (1) `id` attribute, (2) unique `data-*` or `aria-label`, (3) CSS path with parent context, (4) scoped XPath
- Generated selectors MUST resolve to exactly one element when evaluated by Playwright
- Selector uniqueness MUST be verified during generation via `querySelectorAll` count check

### FR-004: Expanded AX Tree Budget
- AX tree character limit MUST increase from 8000 to 16000 chars for agent-mode
- AX tree MUST prioritize main content region nodes over header/footer
- Product-relevant node roles (link, heading, img, listitem) MUST be preserved before generic nodes are truncated

### FR-005: AX Tree to Element Index Mapping
- Each interactive element in the element list MUST include an `axNodeId` or text snippet that maps to the corresponding AX tree entry
- The planner prompt MUST cross-reference element indices with AX tree context
- Format: `[index] <tag> "text" — AX: "full accessible name"`

### FR-006: Enhanced Planner Context
- Planner system prompt MUST instruct the LLM to prefer elements in the main content area for goal-relevant actions
- Planner MUST receive a `contentRegion` summary: count of links, buttons, and form fields in the main content vs header
- When the planner needs to click a product/result, it MUST use `extract_text` or `get_ax_tree` first if no suitable element is visible

### FR-007: Screenshot Vision for Planner
- The planner LLM call MUST include a viewport screenshot as a vision input alongside the text prompt
- The screenshot MUST be captured at each perception step (already exists in perceiver) and sent as a base64 JPEG image part in the `HumanMessage` content array
- gpt-4o-mini supports vision — the planner MUST use multimodal `HumanMessage` with `[{ type: 'text', text: ... }, { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,...' } }]`
- The screenshot MUST always be sent (not just when AX tree is short)
- Screenshot quality MUST be JPEG at quality 50 to minimize token cost (~300 tokens per image)

### FR-008: Auto-Extract Page Summary
- After each perception step, the perceiver MUST extract the first 2000 characters of visible text from the main content area
- This `pageText` summary MUST be included in `PerceivedState` and sent to the planner
- Extraction uses `page.evaluate(() => document.querySelector('main')?.innerText || document.body.innerText)` truncated to 2000 chars
- This provides the planner with product names, prices, and ratings even when AX tree is truncated

## Edge Cases

- Pages with no `<main>` or ARIA landmarks — fall back to largest `<div>` by child count
- Infinite scroll pages — elements change on scroll; perceiver should re-collect
- Iframes — elements in iframes are not captured by `querySelectorAll` on main frame
- Shadow DOM — elements in shadow roots are not visible to standard selectors
- Vision token cost — JPEG q50 at 1280x800 ≈ 300 tokens, well within budget

## Success Criteria

- **SC-001**: On Amazon search results, product links appear in the element list (at least 5 product links in top 50)
- **SC-002**: Clicking a product by elementIndex navigates to the correct product page (not the logo)
- **SC-003**: Agent completes the Amazon search + product detail fetch task without REDIRECT_LOOP
- **SC-004**: AX tree on Amazon SERP includes at least 3 product names with ratings
- **SC-005**: All existing Phase 32-34 tests continue to pass
- **SC-006**: Element collection adds <500ms overhead per perception step
- **SC-007**: Planner receives a viewport screenshot at every step
- **SC-008**: Planner receives visible page text (≤2000 chars) at every step
