# Task-Specific Analysis Prompts

## QUICK_SCAN (L1 Foundation Only)
**Use case**: Initial triage, large-scale audits, quick checks  
**Token budget**: ~2K input, ~1K output  
**Time estimate**: 10-15 seconds

```markdown
Perform a **Level 1 Foundation Analysis** using the L1_SCHEMA.

Focus on:
1. Page identification (type, domain, primary goal)
2. Critical issues blocking conversion (broken CTAs, missing forms, major UX problems)
3. Quick wins (high-impact, low-effort improvements)
4. Conversion readiness score

Be ruthlessly prioritized. Only flag issues with clear conversion impact.

Include screenshots: above-fold-desktop.png
Return: L1_SCHEMA JSON
```

---

## STANDARD_AUDIT (L1 + L2 Conversion Systems)
**Use case**: Client deliverables, focused optimization projects  
**Token budget**: ~4K input, ~3K output  
**Time estimate**: 30-45 seconds

```markdown
Perform a **Standard CRO Audit** using the L1L2_SCHEMA.

**Phase 1 - Foundation (L1)**:
- Page context and layout structure
- Hidden content discovery
- Critical issues and quick wins
- Conversion readiness baseline

**Phase 2 - Conversion Systems (L2)**:
- Value proposition analysis (clarity, differentiation, proof)
- CTA inventory and optimization (all visible CTAs, prioritized by prominence)
- Form friction analysis (field-by-field breakdown)
- Trust signal audit (presence, placement, authenticity)
- Pricing/navigation UX

**Domain-specific focus**:
- If e-commerce: Product info, cart/checkout, shipping clarity
- If SaaS: Value prop, pricing page, signup flow
- If travel: Search UX, results filtering, booking transparency
- If B2B: Lead forms, case studies, demo/contact paths

Include screenshots: above-fold-desktop.png, full-page-desktop.png
Return: L1L2_SCHEMA JSON
```

---

## DEEP_ANALYSIS (Full L1-L4)
**Use case**: Complex pages, strategic planning, comprehensive teardowns  
**Token budget**: ~8K input, ~6K output  
**Time estimate**: 60-90 seconds

```markdown
Perform a **Deep CRO Analysis** using the FULL_SCHEMA.

**Phase 1 - Foundation (L1)**:
Complete page reconnaissance including metadata, layout, hidden content, and critical issue identification.

**Phase 2 - Conversion Systems (L2)**:
Detailed analysis of value proposition, CTAs, forms, trust signals, pricing, and navigation.

**Phase 3 - User Psychology (L3)**:
- User pain points (evidence-based friction identification)
- CRO obstacles by funnel stage (awareness → action)
- Cognitive load assessment (information density, decision complexity)
- Observable persuasion patterns (scarcity, urgency, social proof, authority)
- Emotional journey mapping (anxiety points, confidence builders)

**Phase 4 - Strategic Optimization (L4)**:
- A/B test hypotheses (prioritized by impact/effort)
- Segment-specific recommendations (new vs returning, mobile vs desktop)
- Funnel optimization strategy
- Competitive positioning insights
- 30/60/90 day roadmap

**Analysis depth requirements**:
- Examine both desktop AND mobile viewports
- Extract all hidden content (tabs, accordions, modals)
- Reference specific copy, not descriptions
- Provide test hypotheses with expected lift estimates
- Consider implementation feasibility

Include screenshots: above-fold-desktop.png, full-page-desktop.png, above-fold-mobile.png
Return: FULL_SCHEMA JSON
```

---

## FOCUSED_EXTRACTION (Custom Module)
**Use case**: Analyzing specific elements (all CTAs, checkout flow, pricing page)  
**Token budget**: Variable  
**Time estimate**: 15-30 seconds

```markdown
Perform a **Focused Extraction** on: {FOCUS_AREA}

Extract only the relevant schema section:
- forms → FORM_SCHEMA
- ctas → CTA_SCHEMA
- trust_signals → TRUST_SCHEMA
- value_proposition → VP_SCHEMA
- checkout_flow → CHECKOUT_SCHEMA

Provide deep analysis of ONLY this element type across the entire page.
Include competitive benchmarking context if relevant.

Return: Targeted schema subset with enhanced detail
```

---

## COMPARISON_MODE (Multi-Page Analysis)
**Use case**: Before/after testing, competitor analysis, variant comparison  
**Token budget**: ~5K input per page  
**Time estimate**: 45-60 seconds

```markdown
Perform a **Comparative Analysis** between:
- Page A: {URL_A}
- Page B: {URL_B}

For each page, extract L1+L2 analysis, then provide:

**Differential Analysis**:
1. Key differences in conversion approach
2. Relative strengths and weaknesses
3. Which page likely performs better and why
4. Hybrid recommendations (best of both)

**Test Insights**:
If this is an A/B test variant comparison, identify:
- What hypothesis is being tested
- Expected impact on conversion
- Potential unintended consequences
- Recommendation on which variant to ship

Return: Comparative JSON with side-by-side findings + differential analysis
```

---

## USAGE GUIDE

**Prompt injection pattern**:
```javascript
const prompt = `
${CORE_SYSTEM_PROMPT}

---

${TASK_SPECIFIC_PROMPT[analysisType]}

---

SCHEMA TO USE:
${SCHEMA[analysisType]}

---

PAGE DATA:
URL: ${url}
DOM: ${dom}
Screenshots: ${screenshots}
`;
```

**Token management**:
- Quick Scan: ~3K total tokens
- Standard Audit: ~7K total tokens
- Deep Analysis: ~14K total tokens
- Focused: ~4K total tokens

**Chaining for complex analysis**:
1. Run QUICK_SCAN first (validate page is analyzable)
2. If conversion_readiness_score < 50, run DEEP_ANALYSIS
3. If specific issues found, run FOCUSED_EXTRACTION on problem areas
4. For test design, use findings to generate COMPARISON_MODE setup
