**Navigation**: [Index](./index.md) | [Previous](./phases-15-16.md) | [Next](./phase-18.md)

---

## Phase 17a: Navigation Tools (US7) **[COMPLETE]**

**Purpose**: Implement navigation tools (scroll, click, go_to_url) that change page state

**Prerequisites**:
- Phase 16 (Agent Core) complete
- Dependencies: PageState, DOMTree from `src/models/`
- Pattern: Navigation tools return `insights: []` (empty array)

**CROActionNames Coverage** (Phase 17 total - must implement ALL):
```
Analysis:  analyze_ctas ✅, analyze_forms, detect_trust_signals, assess_value_prop, check_navigation, find_friction
Navigation: scroll_page ✅, click ✅, go_to_url ✅  ← COMPLETE
Control:    record_insight, done
```

**Note**: analyze_ctas exists from Phase 15b (T077c)

---

#### T091 [US7] Create src/agent/tools/cro/scroll-tool.ts ✅

**Action Name**: `scroll_page`

**Parameters**:
```typescript
z.object({
  direction: z.enum(['up', 'down', 'top', 'bottom']),
  amount: z.number().positive().optional().default(500),
})
```

**Returns**: `{ success, insights: [], extracted: { previousY, newY, atTop, atBottom } }`

**Error Handling**:
| Condition | Behavior |
|-----------|----------|
| Already at top + scroll up | success: true, atTop: true, newY unchanged |
| Already at bottom + scroll down | success: true, atBottom: true, newY unchanged |
| Page evaluation fails | success: false, error: message |

**Acceptance Criteria**:
- [ ] Scroll down increases scrollY by amount
- [ ] Scroll up decreases scrollY by amount
- [ ] Scroll top sets scrollY to 0
- [ ] Scroll bottom sets scrollY to max
- [ ] Returns atTop: true when scrollY === 0
- [ ] Returns atBottom: true when scrollY >= maxScroll

**Unit Tests** (6):
1. scroll down from top
2. scroll up from middle
3. scroll to top
4. scroll to bottom
5. scroll at boundary (no movement)
6. invalid direction rejected by Zod

---

#### T092 [US7] Create src/agent/tools/cro/click-tool.ts ✅

**Action Name**: `click`

**Parameters**:
```typescript
z.object({
  elementIndex: z.number().int().nonnegative(),
  waitForNavigation: z.boolean().optional().default(false),
})
```

**Returns**: `{ success, insights: [], extracted: { clickedXpath, elementText, navigationOccurred } }`

**Error Handling**:
| Condition | Behavior |
|-----------|----------|
| Element index not found | success: false, error: "Element with index N not found" |
| Element not visible | success: false, error: "Element N is not visible" |
| Element disappeared (DOM mutation) | success: false, error: "Element no longer in DOM" |
| Click timeout | success: false, error: "Click timed out after 5000ms" |

**Acceptance Criteria**:
- [ ] Click by valid index succeeds
- [ ] Click by invalid index returns error (not throws)
- [ ] Click hidden element returns error
- [ ] waitForNavigation: true waits up to 5s
- [ ] Returns navigationOccurred: true if URL changed
- [ ] Returns clickedXpath and elementText in extracted

**Unit Tests** (7):
1. click valid visible element
2. click invalid index (not found)
3. click hidden element
4. click with navigation wait (mock)
5. navigation detection
6. element xpath captured
7. negative index rejected by Zod

---

#### T093 [US7] Create src/agent/tools/cro/go-to-url-tool.ts ✅

**Action Name**: `go_to_url`

**Parameters**:
```typescript
z.object({
  url: z.string().url(),
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional().default('load'),
})
```

**Returns**: `{ success, insights: [], extracted: { previousUrl, newUrl, loadTimeMs } }`

**Error Handling**:
| Condition | Behavior |
|-----------|----------|
| Invalid URL format | Zod validation fails |
| Navigation timeout (60s) | success: false, error: "Navigation timed out" |
| Network error | success: false, error: "Navigation failed: {message}" |

**Acceptance Criteria**:
- [ ] Navigates to valid URL
- [ ] Returns previous and new URL
- [ ] Tracks load time in ms
- [ ] Invalid URL rejected by Zod
- [ ] Timeout after 60s returns error

**Unit Tests** (5):
1. navigate to valid URL
2. invalid URL rejected
3. load time tracked
4. previous URL captured
5. waitUntil parameter respected

---

### Phase 17a Tests

- [x] T093a [P] [US7] Create tests/unit/navigation-tools.test.ts (21 tests) ✅
  | Tool | Tests |
  |------|-------|
  | scroll-tool | 6 |
  | click-tool | 7 |
  | go-to-url-tool | 5 |
  | schema validation | 3 |

---

**Phase 17a Checkpoint**: ✅
- [x] 3 navigation tools compile and export ✅
- [x] 21 unit tests passing (233 total) ✅
- [x] All tools return `insights: []` ✅
- [x] Test: `npm run start -- --tool scroll_page <url>` works ✅

**Phase 17a Total**: 4 tasks, 21 tests (completed 2025-12-08)

---

## Phase 17b: Analysis Tools (US7, US8) **[COMPLETE]**

**Purpose**: Implement analysis tools that examine DOM and return CROInsight[]

**Prerequisites**: Phase 17a (Navigation Tools) complete

**CROActionNames Coverage**:
```
Analysis:  analyze_ctas ✅, analyze_forms ✅, detect_trust_signals ✅, assess_value_prop ✅, check_navigation ✅, find_friction ✅  ← THIS PHASE COMPLETE
Navigation: scroll_page ✅, click ✅, go_to_url ✅
Control:    record_insight, done
```

---

#### T094 [US7] Create src/agent/tools/cro/analyze-forms-tool.ts ✅

**Action Name**: `analyze_forms`

**Parameters**:
```typescript
z.object({
  formSelector: z.string().optional(),
  includeHiddenFields: z.boolean().optional().default(false),
})
```

**Insight Types** (6):
| ID | Type | Severity | Condition | US8 Criteria |
|----|------|----------|-----------|--------------|
| F001 | `form_field_overload` | high | >5 visible fields | field count ✓ |
| F002 | `missing_field_label` | medium | input without label/placeholder | label quality ✓ |
| F003 | `missing_input_type` | medium | input without type attribute | validation issues ✓ |
| F004 | `no_required_indicator` | low | required without visual indicator | validation issues ✓ |
| F005 | `no_error_container` | low | form without error message area | validation issues ✓ |
| F006 | `no_submit_button` | high | form without submit button | field count ✓ |

**Error Handling**:
| Condition | Behavior |
|-----------|----------|
| No forms found | success: true, insights: [], extracted: { totalForms: 0 } |
| formSelector matches nothing | success: true, insights: [], extracted: { totalForms: 0 } |

**Acceptance Criteria** (maps to US8):
- [ ] Detects forms with >5 fields (field count)
- [ ] Detects inputs without labels (label quality)
- [ ] Detects inputs without type attribute (validation)
- [ ] Detects required fields without indicator (validation)
- [ ] Detects forms without submit button
- [ ] Returns empty insights for pages with no forms

**Unit Tests** (12):
1. form with 6 fields → F001
2. form with 4 fields → no F001
3. input without label → F002
4. input with placeholder → no F002
5. input without type → F003
6. input with type="email" → no F003
7. required without indicator → F004
8. form without submit → F006
9. form with button type=submit → no F006
10. multiple forms analyzed
11. formSelector filters correctly
12. empty page returns empty insights

---

#### T095 [US7] Create src/agent/tools/cro/analyze-trust-tool.ts ✅

**Action Name**: `detect_trust_signals`

**Parameters**:
```typescript
z.object({
  focusArea: z.string().optional().default('full_page'),
}).transform((data) => ({
  focusArea: normalizeAreaParam(data.focusArea), // Handles LLM variations
}))
```

**Insight Types** (5):
| ID | Type | Severity | Condition | US8 Criteria |
|----|------|----------|-----------|--------------|
| TR001 | `no_trust_above_fold` | medium | No trust elements in viewport | badges ✓ |
| TR002 | `no_reviews` | low | No review/testimonial elements | reviews ✓ |
| TR003 | `no_security_badge` | medium | No SSL/security/payment badges | badges ✓ |
| TR004 | `no_guarantees` | low | No guarantee/warranty mentions | guarantees ✓ |
| TR005 | `no_certifications` | low | No certification badges | certifications ✓ |

**Detection Patterns**:
```typescript
const TRUST_PATTERNS = {
  reviews: ['.review', '.testimonial', '[class*="rating"]', '.stars'],
  badges: ['.trust-badge', '.security-seal', '[class*="secure"]', 'img[alt*="ssl"]'],
  guarantees: ['[class*="guarantee"]', '[class*="warranty"]', '[class*="money-back"]'],
  certifications: ['.certification', '.accredited', '[class*="certified"]'],
};
```

**Error Handling**:
| Condition | Behavior |
|-----------|----------|
| No trust elements found | success: true, insights: [TR001-TR005 as applicable] |

**Acceptance Criteria** (maps to US8):
- [ ] Detects trust badges (security seals, payment icons)
- [ ] Finds review/testimonial sections
- [ ] Identifies guarantee mentions
- [ ] Recognizes certification badges
- [ ] Distinguishes above-fold vs full-page

**Unit Tests** (10):
1. page with trust badge → no TR003
2. page without trust badge → TR003
3. page with reviews → no TR002
4. page without reviews → TR002
5. page with guarantee → no TR004
6. above_fold filters correctly
7. full_page includes footer
8. multiple trust signals detected
9. trust signal count in extracted
10. empty page returns all applicable insights

---

#### T096 [US7] Create src/agent/tools/cro/analyze-value-prop-tool.ts ✅

**Action Name**: `assess_value_prop`

**Parameters**:
```typescript
z.object({
  checkH1Only: z.boolean().optional().default(false),
})
```

**Insight Types** (5):
| ID | Type | Severity | Condition | US8 Criteria |
|----|------|----------|-----------|--------------|
| VP001 | `missing_h1` | high | No H1 on page | headline clarity ✓ |
| VP002 | `multiple_h1` | medium | >1 H1 elements | headline clarity ✓ |
| VP003 | `generic_headline` | medium | H1 matches generic patterns | benefit communication ✓ |
| VP004 | `no_subheadline` | low | H1 without H2 support | benefit communication ✓ |
| VP005 | `headline_too_long` | low | H1 >10 words | headline clarity ✓ |

**Generic Patterns**:
```typescript
const GENERIC_PATTERNS = [
  /^welcome$/i, /^home$/i, /^homepage$/i,
  /^untitled$/i, /^page\s*\d*$/i, /^about$/i,
];
```

**Error Handling**:
| Condition | Behavior |
|-----------|----------|
| No value_prop elements | success: true, insights: [VP001] |

**Acceptance Criteria** (maps to US8):
- [ ] Detects missing H1 (headline clarity)
- [ ] Detects multiple H1s (headline clarity)
- [ ] Flags generic headlines like "Welcome" (benefit communication)
- [ ] Checks for supporting H2 (benefit communication)
- [ ] Flags headlines >10 words

**Unit Tests** (10):
1. page with single H1 → no VP001, VP002
2. page with no H1 → VP001
3. page with 2 H1s → VP002
4. H1 = "Welcome" → VP003
5. H1 = "Get 50% Off Your First Order" → no VP003
6. H1 without H2 → VP004
7. H1 with H2 → no VP004
8. H1 with 12 words → VP005
9. H1 with 8 words → no VP005
10. checkH1Only: true ignores H2-H6

---

#### T097 [US7] Create src/agent/tools/cro/check-navigation-tool.ts ✅

**Action Name**: `check_navigation`

**Parameters**:
```typescript
z.object({
  includeFooter: z.boolean().optional().default(true),
})
```

**Insight Types** (5):
| ID | Type | Severity | Condition | US8 Criteria |
|----|------|----------|-----------|--------------|
| NAV001 | `no_main_nav` | high | No <nav> or role="navigation" | menu structure ✓ |
| NAV002 | `no_breadcrumbs` | low | No breadcrumb on non-home page | breadcrumbs ✓ |
| NAV003 | `no_search` | medium | No search input/button | search presence ✓ |
| NAV004 | `deep_nav_nesting` | low | Nav menu >3 levels deep | menu structure ✓ |
| NAV005 | `no_home_link` | low | No link to home/root | menu structure ✓ |

**Detection Patterns**:
```typescript
const NAV_PATTERNS = {
  mainNav: ['nav', '[role="navigation"]', '.main-nav', '.primary-nav'],
  breadcrumbs: ['.breadcrumb', '[aria-label*="breadcrumb"]', '.crumbs'],
  search: ['[type="search"]', '.search', '[role="search"]', 'input[name*="search"]'],
};
```

**Acceptance Criteria** (maps to US8):
- [ ] Detects main navigation element
- [ ] Finds breadcrumb on category/product pages
- [ ] Identifies search functionality
- [ ] Checks nav menu depth
- [ ] Verifies home link exists

**Unit Tests** (8):
1. page with <nav> → no NAV001
2. page without nav → NAV001
3. product page with breadcrumbs → no NAV002
4. product page without breadcrumbs → NAV002
5. page with search → no NAV003
6. page without search → NAV003
7. deep nav (4 levels) → NAV004
8. nav menu depth in extracted

---

#### T098 [US7] Create src/agent/tools/cro/find-friction-tool.ts ✅

**Action Name**: `find_friction`

**Parameters**:
```typescript
z.object({
  categories: z.array(z.enum(['cta', 'form', 'trust', 'value_prop', 'navigation'])).optional(),
})
```

**Purpose**: General friction point detector that runs lightweight checks across ALL CRO categories. Use when LLM wants a quick overview before diving deep.

**Insight Types** (5 - one per category):
| ID | Type | Severity | Condition |
|----|------|----------|-----------|
| FR001 | `friction_cta` | varies | Quick CTA issues (no CTA above fold) |
| FR002 | `friction_form` | varies | Quick form issues (too many fields) |
| FR003 | `friction_trust` | varies | Quick trust issues (no signals) |
| FR004 | `friction_value` | varies | Quick value issues (no H1) |
| FR005 | `friction_nav` | varies | Quick nav issues (no search) |

**Behavior**: Runs ONE quick check per category, returns summary. For deep analysis, LLM should use specific tools.

**Acceptance Criteria** (maps to US8):
- [ ] Identifies general friction points across all categories
- [ ] Can filter to specific categories via parameter
- [ ] Returns at most 5 insights (one per category)
- [ ] Provides "friction score" in extracted

**Unit Tests** (6):
1. page with issues in all categories → 5 insights
2. clean page → 0 insights
3. categories filter works
4. friction score calculated
5. each friction type has category
6. empty categories param checks all

---

### Phase 17b Tests

- [x] T098a [P] [US7] Create tests/unit/analysis-tools.test.ts (51 tests) ✅
  | Tool | Tests |
  |------|-------|
  | analyze-forms | 12 |
  | analyze-trust | 10 |
  | analyze-value-prop | 10 |
  | check-navigation | 8 |
  | find-friction | 6 |
  | schema validation | 5 |

---

**Phase 17b Checkpoint**: ✅
- [x] 5 analysis tools compile and export ✅
- [x] 51 unit tests passing (284 total) ✅
- [x] All tools return valid CROInsight[] with correct schema ✅
- [x] Total insight types: 26 (6 form + 5 trust + 5 value + 5 nav + 5 friction) ✅
- [x] Tools registered in create-cro-registry.ts ✅

**Phase 17b Total**: 6 tasks, 51 tests (completed 2025-12-08)

---

## Phase 17c: Control Tools & Integration (US7) **[COMPLETE]**

**Purpose**: Implement control tools (record_insight, done) and finalize registry/integration

**Prerequisites**: Phase 17b (Analysis Tools) complete

**CROActionNames Coverage**:
```
Analysis:  analyze_ctas ✅, analyze_forms ✅, detect_trust_signals ✅, assess_value_prop ✅, check_navigation ✅, find_friction ✅
Navigation: scroll_page ✅, click ✅, go_to_url ✅
Control:    record_insight ✅, done ✅  ← COMPLETE
```

---

#### T099 [US7] Create src/agent/tools/cro/record-insight-tool.ts ✅

**Action Name**: `record_insight`

**Purpose**: Allow LLM to manually record an observation NOT covered by automated tools. Use cases:
1. LLM notices visual issue from DOM structure (e.g., "login button same color as background")
2. LLM infers business context issue (e.g., "pricing unclear for enterprise tier")
3. Cross-element pattern (e.g., "3 different CTA styles create inconsistency")

**Parameters**:
```typescript
z.object({
  type: z.string().min(1).max(50),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  element: z.string().optional(), // xpath
  issue: z.string().min(10).max(500),
  recommendation: z.string().min(10).max(500),
  category: z.enum(['cta', 'form', 'trust', 'value_prop', 'navigation', 'custom']).optional().default('custom'),
})
```

**Returns**: `{ success: true, insights: [recorded insight], extracted: { insightId } }`

**Error Handling**:
| Condition | Behavior |
|-----------|----------|
| Empty issue/recommendation | Zod validation fails |
| Missing type | Zod validation fails |

**Acceptance Criteria**:
- [x] Creates valid CROInsight with auto-generated ID ✅
- [x] Validates severity enum ✅
- [x] Stores custom category correctly ✅
- [x] Returns insight in insights array (not just extracted) ✅

**Unit Tests** (5):
1. valid insight recorded
2. auto-generated ID format
3. severity validation
4. optional element works
5. category defaults to 'custom'

---

#### T100 [US7] Create src/agent/tools/cro/done-tool.ts ✅

**Action Name**: `done`

**Purpose**: Signal analysis completion. CROAgent checks `action.name === 'done'` to exit loop.

**Parameters**:
```typescript
z.object({
  summary: z.string().min(10).max(1000),
  confidenceScore: z.number().min(0).max(1).optional(),
  areasAnalyzed: z.array(z.string()).optional(),
})
```

**Returns**: `{ success: true, insights: [], extracted: { summary, confidenceScore, areasAnalyzed } }`

**Acceptance Criteria**:
- [x] Returns success: true always ✅
- [x] Returns insights: [] always (control tool) ✅
- [x] Captures summary in extracted ✅
- [x] Validates confidenceScore range 0-1 ✅
- [x] areasAnalyzed optional array works ✅

**Unit Tests** (4):
1. valid done with summary
2. confidenceScore validation (0-1)
3. areasAnalyzed captured
4. always returns empty insights

---

### Phase 17c Tests & Integration

- [x] T100a [P] [US7] Create tests/unit/control-tools.test.ts (12 tests) ✅
  | Tool | Tests |
  |------|-------|
  | record-insight | 7 |
  | done-tool | 5 |

- [x] T101 [US7] Create tests/integration/cro-tools.test.ts (18 tests) ✅
  - Tool execution with mock PageState (5 tests)
  - Tool chaining: scroll → analyze → record (3 tests)
  - Error propagation through ToolExecutor (4 tests)
  - ToolResult schema validation (3 tests)
  - createCRORegistry() returns all 11 tools (3 tests)

- [x] T102 [US7] Update src/agent/tools/create-cro-registry.ts ✅
  - Register all 10 new tools
  - Total: 11 tools (including existing analyze_ctas)
  - Verify: `registry.getAll().length === 11`

- [x] T103 [US7] Update src/agent/tools/cro/index.ts ✅
  - Export all tool objects and param schemas

---

**Phase 17c Checkpoint**: ✅
- [x] 2 control tools compile and export ✅
- [x] 12 unit tests passing (control tools) ✅
- [x] 18 integration tests passing (all tools) ✅
- [x] createCRORegistry() returns registry with 11 tools ✅
- [x] All CROActionNames have corresponding tool implementation ✅

**Phase 17c Total**: 5 tasks, 30 tests (12 unit + 18 integration) - completed 2025-12-09

---

## Phase 17 Summary **[COMPLETE]**

| Sub-Phase | Tools | Unit Tests | Int Tests | Total | Status |
|-----------|-------|------------|-----------|-------|--------|
| 17a | 3 navigation | 21 | - | 21 | ✅ |
| 17b | 5 analysis | 51 | - | 51 | ✅ |
| 17c | 2 control + integration | 12 | 18 | 30 | ✅ |
| **Total** | **10 new (11 with analyze_ctas)** | **84** | **18** | **102** | **✅** |

**Insight Types**: 32 total (6 CTA + 6 form + 5 trust + 5 value + 5 nav + 5 friction)

---
