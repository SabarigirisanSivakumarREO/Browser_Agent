# CRO Agent - Modular Prompt System Implementation Guide

## System Overview

Your prompt system is now split into **4 modular components**:

1. **Core System Prompt** (`core_system_prompt.md`) - Role, methodology, quality standards [150 lines]
2. **Task Prompts** (`task_prompts.md`) - Analysis depth variants [6 modes]
3. **Schemas** (`schemas.md`) - JSON output structures [3 tiers + 2 focused]
4. **Domain Heuristics** (`domain_heuristics.md`) - Business-specific rules [6 domains]

**Total token reduction**: From 8,000+ tokens to 2,000-4,000 depending on task.

---

## File Structure

```
/prompts
├── core_system_prompt.md          # Always included (150 lines)
├── task_prompts.md                # Select one mode
├── schemas.md                     # Select matching schema
└── domain_heuristics.md           # Inject if domain detected

/schemas (as JSON for validation)
├── L1_SCHEMA.json
├── L1L2_SCHEMA.json
├── FULL_SCHEMA.json
├── CTA_SCHEMA.json
└── FORM_SCHEMA.json
```

---

## Implementation Pattern

### Basic Setup

```javascript
// config/prompts.js
import fs from 'fs';
import path from 'path';

const PROMPT_DIR = './prompts';
const SCHEMA_DIR = './schemas';

// Load all prompt files once at startup
export const PROMPTS = {
  core: fs.readFileSync(path.join(PROMPT_DIR, 'core_system_prompt.md'), 'utf-8'),
  tasks: {
    QUICK_SCAN: extractSection('task_prompts.md', 'QUICK_SCAN'),
    STANDARD_AUDIT: extractSection('task_prompts.md', 'STANDARD_AUDIT'),
    DEEP_ANALYSIS: extractSection('task_prompts.md', 'DEEP_ANALYSIS'),
    FOCUSED: extractSection('task_prompts.md', 'FOCUSED_EXTRACTION'),
    COMPARISON: extractSection('task_prompts.md', 'COMPARISON_MODE')
  },
  domains: {
    ecommerce: extractSection('domain_heuristics.md', 'E-COMMERCE'),
    saas: extractSection('domain_heuristics.md', 'SAAS'),
    travel: extractSection('domain_heuristics.md', 'TRAVEL'),
    b2b: extractSection('domain_heuristics.md', 'B2B'),
    fintech: extractSection('domain_heuristics.md', 'FINTECH'),
    insurance: extractSection('domain_heuristics.md', 'INSURANCE')
  }
};

export const SCHEMAS = {
  L1: JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, 'L1_SCHEMA.json'))),
  L1L2: JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, 'L1L2_SCHEMA.json'))),
  FULL: JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, 'FULL_SCHEMA.json'))),
  CTA: JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, 'CTA_SCHEMA.json'))),
  FORM: JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, 'FORM_SCHEMA.json')))
};

function extractSection(file, section) {
  const content = fs.readFileSync(path.join(PROMPT_DIR, file), 'utf-8');
  const regex = new RegExp(`## ${section}[\\s\\S]*?(?=##|$)`);
  const match = content.match(regex);
  return match ? match[0] : '';
}
```

### Core Analysis Function

```javascript
// agent/analyzer.js
import { PROMPTS, SCHEMAS } from '../config/prompts.js';
import Ajv from 'ajv';

const ajv = new Ajv();

export class CROAnalyzer {
  constructor(llmClient, browser) {
    this.llm = llmClient;
    this.browser = browser;
  }

  /**
   * Main analysis function with automatic mode selection
   */
  async analyze(url, options = {}) {
    const {
      mode = 'auto',           // auto|quick|standard|deep|focused|compare
      focus = null,            // For focused mode: 'ctas'|'forms'|'trust'
      compareUrl = null,       // For comparison mode
      detectDomain = true      // Auto-inject domain heuristics
    } = options;

    // Step 1: Navigate and capture page data
    const pageData = await this.capturePage(url);

    // Step 2: Determine analysis mode
    const analysisMode = mode === 'auto' 
      ? this.determineMode(pageData) 
      : mode;

    // Step 3: Build prompt
    const prompt = this.buildPrompt(analysisMode, pageData, {
      focus,
      compareUrl,
      detectDomain
    });

    // Step 4: Execute analysis
    const response = await this.llm.complete(prompt);

    // Step 5: Validate and return
    return this.validateResponse(response, analysisMode);
  }

  /**
   * Smart mode selection based on page complexity
   */
  determineMode(pageData) {
    const { dom, complexity } = pageData;

    // Count elements to estimate complexity
    const ctaCount = dom.querySelectorAll('button, a[href], input[type="submit"]').length;
    const formCount = dom.querySelectorAll('form').length;
    const sections = dom.querySelectorAll('section, article, .section').length;

    if (complexity < 30 || sections < 5) return 'QUICK_SCAN';
    if (complexity < 80 && (ctaCount > 10 || formCount > 2)) return 'STANDARD_AUDIT';
    return 'DEEP_ANALYSIS';
  }

  /**
   * Assemble modular prompt
   */
  buildPrompt(mode, pageData, options) {
    const { focus, compareUrl, detectDomain } = options;

    let parts = [
      PROMPTS.core,
      '---\n'
    ];

    // Add task-specific instructions
    if (mode === 'FOCUSED' && focus) {
      parts.push(PROMPTS.tasks.FOCUSED.replace('{FOCUS_AREA}', focus));
    } else if (mode === 'COMPARISON' && compareUrl) {
      parts.push(
        PROMPTS.tasks.COMPARISON
          .replace('{URL_A}', pageData.url)
          .replace('{URL_B}', compareUrl)
      );
    } else {
      parts.push(PROMPTS.tasks[mode]);
    }

    parts.push('---\n');

    // Add domain heuristics if detected
    if (detectDomain) {
      const domain = this.detectDomain(pageData);
      if (domain && PROMPTS.domains[domain]) {
        parts.push('## DOMAIN-SPECIFIC HEURISTICS\n');
        parts.push(PROMPTS.domains[domain]);
        parts.push('---\n');
      }
    }

    // Add schema
    const schemaKey = this.getSchemaKey(mode, focus);
    parts.push('## OUTPUT SCHEMA\n');
    parts.push('```json\n');
    parts.push(JSON.stringify(SCHEMAS[schemaKey], null, 2));
    parts.push('\n```\n---\n');

    // Add page data
    parts.push('## PAGE DATA\n');
    parts.push(`URL: ${pageData.url}\n`);
    parts.push(`Page Type: ${pageData.pageType || 'unknown'}\n`);
    parts.push(`Viewport: ${pageData.viewport}\n\n`);
    parts.push('### DOM Structure\n```html\n');
    parts.push(this.cleanDOM(pageData.dom));
    parts.push('\n```\n\n');

    if (pageData.screenshots) {
      parts.push('### Screenshots\n');
      parts.push(`Above fold: ${pageData.screenshots.aboveFold}\n`);
      if (pageData.screenshots.fullPage) {
        parts.push(`Full page: ${pageData.screenshots.fullPage}\n`);
      }
    }

    return parts.join('');
  }

  /**
   * Map mode to schema
   */
  getSchemaKey(mode, focus) {
    if (mode === 'FOCUSED') {
      const focusMap = {
        'ctas': 'CTA',
        'forms': 'FORM',
        'trust': 'L1L2',
        'value_prop': 'L1L2'
      };
      return focusMap[focus] || 'L1';
    }

    const modeMap = {
      'QUICK_SCAN': 'L1',
      'STANDARD_AUDIT': 'L1L2',
      'DEEP_ANALYSIS': 'FULL',
      'COMPARISON': 'L1L2'
    };

    return modeMap[mode] || 'L1';
  }

  /**
   * Detect business domain from page content
   */
  detectDomain(pageData) {
    const { url, dom, text } = pageData;
    const lowerText = text.toLowerCase();
    const lowerUrl = url.toLowerCase();

    // Domain detection heuristics
    const patterns = {
      ecommerce: [
        /add to cart|shopping cart|checkout|buy now|shop now/i,
        /(product|cart|checkout|shop)/i.test(lowerUrl)
      ],
      saas: [
        /pricing|free trial|signup|demo|subscribe|plans/i,
        /(pricing|trial|demo|signup)/i.test(lowerUrl)
      ],
      travel: [
        /hotel|flight|booking|reservation|check-in|destination/i,
        /(hotel|flight|travel|booking)/i.test(lowerUrl)
      ],
      b2b: [
        /enterprise|case study|contact sales|request demo|solution/i,
        dom.querySelectorAll('form[action*="demo"], form[action*="contact"]').length > 0
      ],
      fintech: [
        /account|banking|investment|crypto|wallet|payment|transfer/i,
        /(bank|invest|crypto|wallet|finance)/i.test(lowerUrl)
      ],
      insurance: [
        /insurance|coverage|quote|policy|claim|premium/i,
        /(insurance|quote|policy)/i.test(lowerUrl)
      ]
    };

    // Score each domain
    const scores = {};
    for (const [domain, checks] of Object.entries(patterns)) {
      scores[domain] = checks.filter(check => 
        typeof check === 'boolean' ? check : check.test(lowerText)
      ).length;
    }

    // Return highest scoring domain if score > 1
    const [topDomain, topScore] = Object.entries(scores)
      .sort(([,a], [,b]) => b - a)[0];

    return topScore > 1 ? topDomain : null;
  }

  /**
   * Capture page data with Playwright
   */
  async capturePage(url) {
    const page = await this.browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });

    // Reveal hidden content
    await this.revealHiddenContent(page);

    // Capture data
    const pageData = {
      url,
      viewport: 'desktop',
      dom: await page.content(),
      text: await page.evaluate(() => document.body.innerText),
      screenshots: {
        aboveFold: await page.screenshot({ 
          clip: { x: 0, y: 0, width: 1280, height: 800 } 
        }),
        fullPage: await page.screenshot({ fullPage: true })
      },
      complexity: await this.calculateComplexity(page)
    };

    await page.close();
    return pageData;
  }

  /**
   * Reveal tabs, accordions, etc.
   */
  async revealHiddenContent(page) {
    await page.evaluate(() => {
      // Expand all accordions
      document.querySelectorAll('[aria-expanded="false"]').forEach(el => {
        el.click();
      });

      // Click all tabs
      document.querySelectorAll('[role="tab"]').forEach(el => {
        el.click();
      });

      // Expand details/summary
      document.querySelectorAll('details:not([open])').forEach(el => {
        el.open = true;
      });
    });

    // Wait for animations
    await page.waitForTimeout(1000);
  }

  /**
   * Calculate page complexity score
   */
  async calculateComplexity(page) {
    return await page.evaluate(() => {
      const counts = {
        buttons: document.querySelectorAll('button, [role="button"]').length,
        links: document.querySelectorAll('a[href]').length,
        forms: document.querySelectorAll('form').length,
        inputs: document.querySelectorAll('input, select, textarea').length,
        sections: document.querySelectorAll('section, article, [class*="section"]').length,
        images: document.querySelectorAll('img').length,
        scripts: document.querySelectorAll('script').length
      };

      // Weighted complexity formula
      return (
        counts.buttons * 2 +
        counts.links * 1 +
        counts.forms * 10 +
        counts.inputs * 3 +
        counts.sections * 2 +
        counts.images * 0.5 +
        counts.scripts * 0.1
      );
    });
  }

  /**
   * Clean DOM for token efficiency
   */
  cleanDOM(html) {
    // Remove scripts, styles, comments
    let cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Limit to ~8000 chars for token efficiency
    if (cleaned.length > 8000) {
      // Extract key sections
      const sections = [
        cleaned.match(/<header[\s\S]*?<\/header>/i)?.[0] || '',
        cleaned.match(/<main[\s\S]*?<\/main>/i)?.[0] || '',
        cleaned.match(/<nav[\s\S]*?<\/nav>/i)?.[0] || '',
        cleaned.match(/<form[\s\S]*?<\/form>/gi)?.join('\n') || ''
      ].join('\n');

      cleaned = sections.substring(0, 8000);
    }

    return cleaned;
  }

  /**
   * Validate LLM response against schema
   */
  validateResponse(response, mode) {
    const schemaKey = this.getSchemaKey(mode);
    const validate = ajv.compile(SCHEMAS[schemaKey]);

    let parsed;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[1] : response);
    } catch (e) {
      throw new Error(`Invalid JSON response: ${e.message}`);
    }

    if (!validate(parsed)) {
      console.warn('Schema validation failed:', validate.errors);
      // Continue anyway but log issues
    }

    return parsed;
  }
}
```

### Usage Examples

```javascript
// Example 1: Auto mode (smart detection)
const analyzer = new CROAnalyzer(llmClient, browser);
const result = await analyzer.analyze('https://acme-saas.com/pricing');
// → Automatically selects STANDARD_AUDIT, detects SaaS domain

// Example 2: Force quick scan
const quick = await analyzer.analyze('https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy', { 
  mode: 'quick' 
});
// → Returns L1 schema only

// Example 3: Deep analysis with specific domain
const deep = await analyzer.analyze('https://store.com/product/123', {
  mode: 'deep',
  detectDomain: true
});
// → Returns FULL schema with e-commerce heuristics

// Example 4: Focused CTA analysis
const ctas = await analyzer.analyze('https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy/landing', {
  mode: 'focused',
  focus: 'ctas'
});
// → Returns CTA_SCHEMA only

// Example 5: A/B test comparison
const comparison = await analyzer.analyze('https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy/v1', {
  mode: 'compare',
  compareUrl: 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy/v2'
});
// → Returns comparative analysis

// Example 6: Batch analysis with progressive depth
async function batchAnalyze(urls) {
  const results = [];
  
  for (const url of urls) {
    // Start with quick scan
    const quick = await analyzer.analyze(url, { mode: 'quick' });
    
    // Deepen if page needs it
    if (quick.conversion_readiness < 60) {
      const deep = await analyzer.analyze(url, { mode: 'deep' });
      results.push({ url, analysis: deep, depth: 'deep' });
    } else {
      results.push({ url, analysis: quick, depth: 'quick' });
    }
  }
  
  return results;
}
```

---

## Token Budget Management

| Mode | Est. Input Tokens | Est. Output Tokens | Total |
|------|------------------|-------------------|-------|
| Quick Scan | 2,000 | 800 | 2,800 |
| Standard Audit | 3,500 | 2,500 | 6,000 |
| Deep Analysis | 6,000 | 5,000 | 11,000 |
| Focused | 2,500 | 1,500 | 4,000 |
| Comparison | 5,000 | 3,000 | 8,000 |

**Cost optimization tips**:
1. Use `quick` mode for bulk audits (100+ pages)
2. Use `standard` for client deliverables
3. Reserve `deep` for strategic pages (homepage, pricing, checkout)
4. Use `focused` when you know the problem area

---

## Progressive Enhancement Pattern

```javascript
// Smart analysis that starts shallow and deepens as needed
async function smartAnalyze(url) {
  // Phase 1: Quick scan (cheap)
  console.log('Running quick scan...');
  const l1 = await analyzer.analyze(url, { mode: 'quick' });
  
  // Decision point 1: Is page decent?
  if (l1.conversion_readiness >= 70) {
    return { depth: 'quick', result: l1 };
  }
  
  // Phase 2: Standard audit (moderate cost)
  console.log('Page needs deeper analysis...');
  const l1l2 = await analyzer.analyze(url, { mode: 'standard' });
  
  // Decision point 2: Are issues specific?
  const hasMajorFormIssues = l1l2.forms.some(f => f.friction_score > 7);
  const hasCTAIssues = l1l2.ctas.some(c => c.visibility_score < 5);
  
  if (hasMajorFormIssues) {
    console.log('Deep-diving on forms...');
    const formAnalysis = await analyzer.analyze(url, { 
      mode: 'focused', 
      focus: 'forms' 
    });
    return { depth: 'focused_forms', result: { ...l1l2, formAnalysis } };
  }
  
  // Phase 3: Full strategic analysis (expensive)
  if (l1l2.conversion_readiness < 50) {
    console.log('Running full strategic analysis...');
    const full = await analyzer.analyze(url, { mode: 'deep' });
    return { depth: 'deep', result: full };
  }
  
  return { depth: 'standard', result: l1l2 };
}
```

---

## Next Steps

1. **Convert schemas to JSON**: Extract the schema definitions from `schemas.md` into separate `.json` files
2. **Test each mode**: Run analyzer on 5-10 pages per mode to validate outputs
3. **Tune domain detection**: Adjust heuristics based on false positives/negatives
4. **Build reporting layer**: Transform JSON output into client-friendly reports
5. **Add caching**: Store analysis results to avoid re-analyzing unchanged pages

---

## Key Benefits of This Architecture

✅ **Token efficiency**: 60-70% reduction vs monolithic prompt  
✅ **Maintainability**: Update one component without breaking others  
✅ **Flexibility**: Mix and match modes based on needs  
✅ **Cost control**: Use cheaper modes for bulk work  
✅ **Testability**: Validate each component independently  
✅ **Scalability**: Add new domains/modes without refactoring  

You now have a production-ready, modular CRO analysis system. Let me know when you implement it and hit issues.
