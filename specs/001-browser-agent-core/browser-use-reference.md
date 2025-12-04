# Browser-Use Reference Mapping

**Purpose**: Quick lookup table mapping our CRO agent components to Browser-Use (Python) reference implementation
**Created**: 2025-12-05
**Reference**: `browser-use/` folder (DO NOT modify, reference only)

---

## ⚠️ IMPORTANT: Usage Guidelines

**This file is for ARCHITECTURAL REFERENCE ONLY.**

| Use For | Do NOT Use For |
|---------|----------------|
| Understanding logic flow | Direct code copying |
| Data structure concepts | Python syntax/idioms |
| Algorithm patterns | Pydantic models |
| Error handling strategies | CDP-specific code |

**Our Tech Stack (ALWAYS use):**
- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js
- **Browser**: Playwright (not CDP directly)
- **Validation**: Zod (not Pydantic)
- **Types**: Interfaces + type aliases (not classes for data)

**Translation Required:**
```
Python Pydantic BaseModel  →  TypeScript interface + Zod schema
Python async def           →  TypeScript async function / Promise
Python CDP calls           →  Playwright page.evaluate()
Python dataclass           →  TypeScript interface
Python type hints          →  TypeScript types
```

**Rule**: When in doubt, check `tasks.md` for the actual TypeScript implementation code, NOT this file.

---

## Component Mapping

| Our Component | Browser-Use File | Key Function/Class |
|---------------|------------------|-------------------|
| CROAgent | `agent/service.py:718` | `Agent.step()` |
| DOMExtractor | `dom/service.py` | `DomService.get_clickable_elements()` |
| buildCroDomTree.js | `dom/buildDomTree.js` | `buildDomTree()` |
| Visibility detection | `dom/serializer/serializer.py:250` | `is_element_visible_according_to_all_parents()` |
| Interactive detection | `dom/clickable_element_detector.py` | `ClickableElementDetector.is_interactive()` |
| ToolRegistry | `tools/registry/views.py` | `RegisteredAction` |
| Tool execution | `tools/service.py` | `ToolService.act()`, `multi_act()` |
| CROAgentOutput | `agent/views.py:150` | `AgentOutput` (Pydantic model) |
| MessageBuilder | `agent/message_manager/service.py` | `MessageManager.create_state_messages()` |
| System prompt | `agent/system_prompt.md` | Full prompt structure |
| AgentState | `agent/views.py:50` | `AgentState` |
| Error recovery | `agent/service.py:850` | Failure counter, retry logic |
| Memory | `agent/views.py:100` | `AgentHistory`, `AgentStepInfo` |

---

## DOM Pipeline (Browser-Use)

Browser-Use processes DOM in 5 stages:

```
1. CDP Data Collection (parallel requests)
   └─ dom/service.py: get_dom_state()

2. Enhanced Tree Construction (merge DOM + accessibility)
   └─ dom/buildDomTree.js: buildDomTree()

3. Visibility Filtering
   └─ dom/serializer/serializer.py: filter_visible_elements()

4. Paint Order Filtering (remove occluded)
   └─ dom/serializer/serializer.py: filter_by_paint_order()

5. Bounding Box Filtering (99% containment)
   └─ dom/serializer/serializer.py: filter_by_bounding_box()

6. Index Assignment
   └─ dom/serializer/serializer.py: assign_highlight_indices()
```

**Our adaptation**: Simplified to 4 stages (no CDP, use Playwright evaluate)

---

## Agent Output Schema (Browser-Use)

```python
# agent/views.py
class AgentOutput(BaseModel):
    thinking: str | None
    evaluation_previous_goal: str
    memory: str
    next_goal: str
    action: list[ActionModel]
```

**Our adaptation**: Same structure with Zod schema

---

## Action Result Schema (Browser-Use)

```python
# tools/views.py
class ActionResult(BaseModel):
    is_done: bool
    success: bool | None
    error: str
    extracted_content: str
    metadata: dict
```

**Our adaptation**: `ToolResult` interface

---

## Error Handling Patterns

| Scenario | Browser-Use Approach | Our Implementation |
|----------|---------------------|-------------------|
| Empty LLM response | Retry with clarification | Same (FR-022) |
| Tool error | Increment failure counter | Same (CR-014) |
| 3 consecutive failures | Force done | Same (FR-023) |
| LLM timeout | 60s per call | Same (CR-012) |
| Invalid action | Zod/Pydantic validation | Zod validation |

---

## Key Files to Reference

### DOM Extraction
- `browser-use/dom/buildDomTree.js` - Core DOM traversal logic
- `browser-use/dom/clickable_element_detector.py` - Interactive element detection
- `browser-use/dom/serializer/serializer.py` - Visibility and serialization

### Agent Loop
- `browser-use/agent/service.py` - Main agent class
- `browser-use/agent/message_manager/service.py` - Message building
- `browser-use/agent/system_prompt.md` - System prompt structure

### Tools
- `browser-use/tools/registry/views.py` - Tool registration
- `browser-use/tools/service.py` - Tool execution

### Models
- `browser-use/agent/views.py` - AgentOutput, AgentState
- `browser-use/dom/views.py` - DOMNode, DOMTree

---

## CRO-Specific Adaptations

Browser-Use is general-purpose. Our CRO agent adds:

1. **CRO Element Classification** - Classify as cta|form|trust|value_prop|navigation
2. **CRO-Specific Tools** - analyze_ctas, analyze_forms, detect_trust_signals, etc.
3. **Heuristic Engine** - Rule-based checks (Baymard-style)
4. **Business Type Detection** - ecommerce, saas, banking, etc.
5. **Hypothesis Generation** - A/B test specs from insights
6. **Markdown Reporting** - Structured CRO reports

---

## DOM Serialization Format

Browser-Use format:
```
[index]<tag attributes>text content</tag>
*[index]  ← new element marker
```

Our format (same):
```
[0]<button class="cta">Buy Now</button>
[1]<form id="signup">
  [2]<input type="email" placeholder="Email">
  [3]<input type="password" placeholder="Password">
</form>
*[4]<a href="/pricing">View Pricing</a>  ← newly visible after scroll
```

---

## Visibility Detection Logic

From `dom/serializer/serializer.py`:

```python
def is_element_visible(element):
    # 1. Check CSS display/visibility/opacity
    if style.display == 'none': return False
    if style.visibility == 'hidden': return False
    if style.opacity == 0: return False

    # 2. Check bounding box exists
    if not element.bounding_box: return False

    # 3. Check not clipped by parent overflow
    if is_clipped_by_parent(element): return False

    # 4. Check viewport intersection
    if not intersects_viewport(element): return False

    return True
```

---

## Interactive Element Detection

From `dom/clickable_element_detector.py`:

```python
INTERACTIVE_TAGS = ['button', 'a', 'input', 'select', 'textarea']
INTERACTIVE_ROLES = ['button', 'link', 'checkbox', 'radio', 'textbox', 'combobox']

def is_interactive(element):
    # 1. Check tag name
    if element.tag in INTERACTIVE_TAGS: return True

    # 2. Check ARIA role
    if element.role in INTERACTIVE_ROLES: return True

    # 3. Check onclick handler
    if element.has_attribute('onclick'): return True

    # 4. Check cursor style
    if element.style.cursor == 'pointer': return True

    return False
```

---

## Usage Notes

1. **DO NOT** copy code directly from browser-use
2. **DO** use patterns and logic as reference
3. **DO** adapt to TypeScript/Playwright idioms
4. **DO** simplify where our use case allows (no CDP, single-page focus)

---

## Quick Reference Commands

```bash
# Find agent loop logic
grep -n "step" browser-use/agent/service.py

# Find DOM traversal
cat browser-use/dom/buildDomTree.js

# Find tool registration
grep -n "RegisteredAction" browser-use/tools/registry/views.py

# Find output schema
grep -n "AgentOutput" browser-use/agent/views.py
```
