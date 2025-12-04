# CRO Analysis Schemas

## L1_SCHEMA (Quick Scan)

```json
{
  "page_context": {
    "url": "string",
    "page_type": "homepage|product|landing|checkout|pricing|other",
    "page_subtype": "string (e.g., 'B2B_SaaS_pricing')",
    "domain": "ecommerce|saas|travel|b2b|fintech|other",
    "primary_goal": "purchase|signup|lead|booking|engagement",
    "viewport": "desktop|mobile|both",
    "timestamp": "ISO 8601"
  },
  "layout": {
    "header_nav": "brief description",
    "hero_section": "brief description",
    "content_sections": ["ordered array"],
    "sticky_elements": ["array"],
    "overlays": ["modals|popups|chat|banners"]
  },
  "hidden_content": {
    "tabs": ["content found in tabs"],
    "accordions": ["collapsed sections"],
    "modals": ["modal content"],
    "lazy_loaded": ["scroll-triggered content"],
    "interaction_failures": ["elements that couldn't be accessed"]
  },
  "critical_issues": [
    {
      "severity": "critical|high|medium",
      "category": "cta|form|trust|messaging|navigation|mobile",
      "issue": "specific problem with evidence",
      "impact": "why this hurts conversion",
      "location": "where on page"
    }
  ],
  "quick_wins": [
    {
      "change": "specific actionable improvement",
      "effort": "low|medium",
      "impact": "high|medium",
      "rationale": "why this helps"
    }
  ],
  "conversion_readiness": 0-100
}
```

**Example Output**:
```json
{
  "page_context": {
    "url": "https://acme-saas.com/pricing",
    "page_type": "pricing",
    "page_subtype": "SaaS_tiered_pricing",
    "domain": "saas",
    "primary_goal": "signup",
    "viewport": "desktop",
    "timestamp": "2025-01-15T10:30:00Z"
  },
  "critical_issues": [
    {
      "severity": "high",
      "category": "cta",
      "issue": "Primary CTA on Enterprise tier says 'Contact Us' with no trial option, creating decision friction for high-intent users",
      "impact": "Forces demo call for price-sensitive buyers who would self-serve. Likely 20-30% drop-off vs instant trial.",
      "location": "Pricing table, rightmost column"
    }
  ],
  "quick_wins": [
    {
      "change": "Change 'Contact Us' to 'Start Enterprise Trial' with '14 days free' subtext",
      "effort": "low",
      "impact": "high",
      "rationale": "Removes barrier for qualified leads. B2B SaaS trials convert 15-25% to paid."
    }
  ],
  "conversion_readiness": 72
}
```

---

## L1L2_SCHEMA (Standard Audit)

Extends L1_SCHEMA with:

```json
{
  "...L1 fields...",
  
  "value_proposition": {
    "headline": "exact hero headline text",
    "subheadline": "supporting copy",
    "clarity_score": 0-10,
    "clarity_rationale": "why this score",
    "differentiation": "strong|moderate|weak|absent",
    "benefit_focus": "benefit-led|feature-led|mixed",
    "proof_elements": ["testimonials|stats|awards|logos"],
    "gaps": ["missing elements"]
  },
  
  "ctas": [
    {
      "text": "exact CTA copy",
      "type": "primary|secondary|tertiary",
      "location": "above_fold|mid_page|footer|sticky",
      "visibility_score": 0-10,
      "visibility_rationale": "size, contrast, position factors",
      "action_clarity": "clear|vague|confusing",
      "competing_ctas": 0,
      "issues": ["specific problems"],
      "recommendation": "specific improvement"
    }
  ],
  
  "forms": [
    {
      "form_type": "signup|checkout|contact|lead_gen",
      "field_count": 0,
      "required_fields": 0,
      "friction_indicators": [
        "excessive_fields|unclear_labels|no_validation|missing_privacy|no_progress|forced_account"
      ],
      "positive_elements": ["autofill|microcopy|smart_defaults|social_login"],
      "friction_score": 0-10,
      "friction_rationale": "why this score",
      "priority": "high|medium|low"
    }
  ],
  
  "trust_signals": {
    "present": {
      "testimonials": false,
      "reviews": false,
      "security_badges": false,
      "guarantees": false,
      "client_logos": false,
      "social_proof_stats": false
    },
    "placement": "optimal|adequate|poor",
    "authenticity": "genuine|neutral|questionable",
    "gaps": ["missing elements for this domain/page type"]
  },
  
  "pricing": {
    "visibility": "prominent|findable|buried|absent",
    "clarity": "transparent|complex|confusing",
    "structure": "single|tiered|custom_quote",
    "objection_handling": ["free_trial|money_back|no_cc"],
    "hidden_costs": "string - are fees/shipping/taxes clear?",
    "issues": ["specific problems"]
  },
  
  "navigation": {
    "clarity": "intuitive|acceptable|confusing",
    "friction_points": ["specific navigation obstacles"],
    "exit_opportunities": ["ways users can leave conversion path"]
  }
}
```

**Scoring Rubrics**:
- **Visibility Score (0-10)**: Above-fold + high contrast + large size = 10; Below-fold + low contrast = 3
- **Clarity Score (0-10)**: Specific, jargon-free, benefit-clear = 10; Generic or confusing = 3
- **Friction Score (0-10)**: 10 = major friction (10+ fields, no validation); 0 = optimized

---

## FULL_SCHEMA (Deep Analysis)

Extends L1L2_SCHEMA with:

```json
{
  "...L1L2 fields...",
  
  "user_psychology": {
    "pain_points": [
      {
        "pain": "specific user question or concern",
        "evidence": "what on page indicates this",
        "location": "where",
        "severity": "critical|high|medium|low",
        "impact": "abandonment|confusion|hesitation"
      }
    ],
    "cognitive_load": {
      "information_density": "overwhelming|balanced|sparse",
      "decision_complexity": "high|medium|low",
      "visual_clutter": "excessive|moderate|minimal",
      "scannability": "excellent|good|poor",
      "issues": ["specific problems"]
    },
    "persuasion_patterns": {
      "scarcity_present": false,
      "urgency_present": false,
      "social_proof_present": false,
      "authority_present": false,
      "effectiveness": "strong|moderate|weak|absent"
    },
    "anxiety_points": ["elements creating user doubt or concern"],
    "confidence_builders": ["elements building user trust or certainty"]
  },
  
  "strategic_optimization": {
    "test_hypotheses": [
      {
        "test_name": "descriptive name",
        "hypothesis": "changing X to Y will increase Z because...",
        "variant_description": "what to change",
        "success_metric": "conversion rate|signups|revenue|engagement",
        "expected_lift": "5-15%",
        "effort": "low|medium|high",
        "priority": "high|medium|low",
        "implementation_notes": "how to build this"
      }
    ],
    "segment_recommendations": {
      "mobile": ["mobile-specific improvements"],
      "new_visitors": ["cold traffic optimizations"],
      "returning_visitors": ["warm traffic optimizations"]
    },
    "competitive_insights": "observable positioning vs category norms",
    "roadmap": {
      "immediate": ["0-30 days: quick wins"],
      "short_term": ["30-60 days: medium effort tests"],
      "long_term": ["60-90 days: strategic improvements"]
    }
  }
}
```

---

## FOCUSED SCHEMAS (Modular Extraction)

### CTA_SCHEMA (Deep CTA Analysis)
```json
{
  "cta_analysis": {
    "inventory": [
      {
        "text": "exact copy",
        "element": "button|link|submit",
        "location": "detailed position",
        "visibility_score": 0-10,
        "design_properties": {
          "color": "hex or description",
          "size": "dimensions or relative size",
          "contrast_ratio": "calculated or observed",
          "whitespace": "adequate|cramped|excessive"
        },
        "copy_analysis": {
          "action_clarity": "clear|vague|confusing",
          "value_communication": "explicit|implied|absent",
          "urgency": "present|absent",
          "first_person": true
        },
        "competitive_benchmark": "better|comparable|worse than category norm",
        "test_variants": ["alternative CTA copy to test"]
      }
    ],
    "hierarchy_issues": "are primary/secondary CTAs clear?",
    "mobile_considerations": "mobile-specific CTA issues"
  }
}
```

### FORM_SCHEMA (Deep Form Analysis)
```json
{
  "form_analysis": {
    "field_inventory": [
      {
        "field_name": "exact name/id",
        "field_type": "email|text|select|checkbox|radio|tel|file",
        "label": "visible label text",
        "placeholder": "placeholder text if present",
        "required": true,
        "validation": "none|inline|on_submit|real_time",
        "justification": "why this field is needed",
        "friction_level": "low|medium|high",
        "recommendation": "keep|remove|conditional|progressive"
      }
    ],
    "form_ux": {
      "field_order": "logical|questionable|confusing",
      "progress_indicator": "present|absent",
      "error_messaging": "helpful|generic|absent",
      "privacy_assurance": "present|absent",
      "submit_button": "clear|vague",
      "post_submit": "what happens after submission?"
    },
    "friction_score": 0-10,
    "field_reduction_test": "remove fields X, Y, Z; expected 15-25% improvement"
  }
}
```

---

## IMPLEMENTATION GUIDE

### Node.js Integration
```javascript
// schemas.js
export const SCHEMAS = {
  L1: require('./schemas/L1_SCHEMA.json'),
  L1L2: require('./schemas/L1L2_SCHEMA.json'),
  FULL: require('./schemas/FULL_SCHEMA.json'),
  CTA: require('./schemas/CTA_SCHEMA.json'),
  FORM: require('./schemas/FORM_SCHEMA.json')
};

// agent.js
import { CORE_SYSTEM_PROMPT } from './prompts/core.md';
import { TASK_PROMPTS } from './prompts/tasks.md';
import { SCHEMAS } from './schemas.js';

async function analyzePagee(url, analysisType = 'L1') {
  const prompt = `
${CORE_SYSTEM_PROMPT}

---

${TASK_PROMPTS[analysisType]}

---

SCHEMA:
${JSON.stringify(SCHEMAS[analysisType], null, 2)}

---

PAGE DATA:
URL: ${url}
DOM: ${await extractDOM(url)}
Screenshots: ${await captureScreenshots(url)}
`;

  const response = await llm.complete(prompt);
  return JSON.parse(response);
}
```

### Schema Validation
```javascript
import Ajv from 'ajv';

const ajv = new Ajv();
const validate = ajv.compile(SCHEMAS.L1);

const result = await analyzePagee(url, 'L1');
if (!validate(result)) {
  console.error('Schema validation failed:', validate.errors);
  // Retry or fallback
}
```

### Progressive Enhancement
```javascript
// Start with quick scan, deepen if needed
const l1 = await analyzePagee(url, 'L1');

if (l1.conversion_readiness < 60) {
  console.log('Page needs deeper analysis...');
  const full = await analyzePagee(url, 'FULL');
  return full;
}

return l1; // Page is decent, L1 sufficient
```
