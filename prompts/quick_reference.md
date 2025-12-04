# CRO Agent Quick Reference

## Mode Selection Flowchart

```
START: New page to analyze
│
├─ Need quick triage / bulk audit?
│  └─ YES → QUICK_SCAN (L1 only)
│     └─ Readiness < 60? → Escalate to STANDARD_AUDIT
│
├─ Client deliverable / optimization project?
│  └─ YES → STANDARD_AUDIT (L1 + L2)
│     └─ Major issues found? → FOCUSED mode on problem area
│
├─ Strategic planning / complex page?
│  └─ YES → DEEP_ANALYSIS (Full L1-L4)
│
├─ Know specific problem area (forms/CTAs)?
│  └─ YES → FOCUSED mode
│
└─ A/B test or competitor comparison?
   └─ YES → COMPARISON mode
```

---

## Quick Mode Reference

| Mode | When to Use | What You Get | Token Cost |
|------|------------|--------------|-----------|
| **QUICK_SCAN** | First look, bulk audits, budget-constrained | Critical issues, quick wins, readiness score | ~3K |
| **STANDARD_AUDIT** | Client reports, focused projects | Full conversion systems analysis | ~6K |
| **DEEP_ANALYSIS** | Strategy, complex pages, pre-redesign | Everything + psychology + test plan | ~11K |
| **FOCUSED** | Known problem (bad forms, weak CTAs) | Deep dive on specific element type | ~4K |
| **COMPARISON** | A/B tests, competitor analysis | Side-by-side + differential insights | ~8K |

---

## Common Scenarios

### Scenario 1: New Client Onboarding
```javascript
// Step 1: Audit key pages (quick)
const pages = [homepage, pricing, signup, product];
const audits = await Promise.all(
  pages.map(url => analyzer.analyze(url, { mode: 'quick' }))
);

// Step 2: Identify worst performers
const needsWork = audits
  .filter(a => a.conversion_readiness < 60)
  .map(a => a.page_context.url);

// Step 3: Deep dive on problem pages
const deepDives = await Promise.all(
  needsWork.map(url => analyzer.analyze(url, { mode: 'standard' }))
);
```

### Scenario 2: Form Optimization Project
```javascript
// Directly target forms
const formAnalysis = await analyzer.analyze(url, {
  mode: 'focused',
  focus: 'forms'
});

// Iterate on high-friction forms
for (const form of formAnalysis.form_analysis.field_inventory) {
  if (form.friction_level === 'high') {
    console.log(`Fix: ${form.recommendation}`);
  }
}
```

### Scenario 3: A/B Test Design
```javascript
// Compare current vs proposed
const comparison = await analyzer.analyze(currentUrl, {
  mode: 'compare',
  compareUrl: proposedUrl
});

// Use test hypotheses
const { test_hypotheses } = comparison.strategic_optimization;
console.log('Recommended tests:', test_hypotheses);
```

### Scenario 4: Checkout Flow Audit
```javascript
// Analyze each step
const steps = ['/cart', '/checkout', '/payment', '/confirmation'];
const flow = await Promise.all(
  steps.map(step => analyzer.analyze(site + step, { mode: 'standard' }))
);

// Identify drop-off points
flow.forEach((analysis, i) => {
  if (analysis.critical_issues.length > 0) {
    console.log(`⚠️ Issues at step ${i + 1}:`, analysis.critical_issues);
  }
});
```

---

## Domain Detection Triggers

| Domain | URL Patterns | Content Signals |
|--------|-------------|----------------|
| **E-commerce** | /product, /cart, /shop | "add to cart", "buy now", product grids |
| **SaaS** | /pricing, /trial, /demo | pricing tables, "free trial", feature lists |
| **Travel** | /hotel, /flight, /booking | date pickers, "check-in", destination search |
| **B2B** | /enterprise, /contact-sales | "request demo", case studies, ROI calculators |
| **Fintech** | /bank, /invest, /wallet | "secure", rate/fee info, account signup |
| **Insurance** | /quote, /policy, /coverage | "get quote", coverage comparison, premiums |

Manual override:
```javascript
await analyzer.analyze(url, { 
  detectDomain: false // Skip auto-detection
});
// Or force specific domain:
// Modify buildPrompt() to accept domain param
```

---

## Troubleshooting

### Issue: Token limit exceeded
**Cause**: Page too large or DEEP mode on complex page  
**Fix**: 
```javascript
// Use progressive approach
const quick = await analyze(url, { mode: 'quick' });
if (quick.conversion_readiness < 60) {
  // Use standard instead of deep
  return await analyze(url, { mode: 'standard' });
}
```

### Issue: Schema validation fails
**Cause**: LLM hallucinated fields or wrong format  
**Fix**:
```javascript
// Add schema enforcement to prompt
const prompt = `
${basePrompt}

CRITICAL: Your response MUST be valid JSON matching this exact schema.
Do not add fields not in schema. Do not skip required fields.
`;
```

### Issue: Generic/vague analysis
**Cause**: Insufficient page data or unclear instructions  
**Fix**:
```javascript
// Ensure DOM is clean but comprehensive
cleanDOM(html) {
  // Keep all text content, CTAs, forms
  // Remove only scripts, styles, comments
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
}

// Add reminder to prompt
"Reference actual page elements with exact copy, not generic descriptions."
```

### Issue: Missed hidden content
**Cause**: JS-heavy SPA or complex interactions  
**Fix**:
```javascript
async revealHiddenContent(page) {
  // Wait for app to hydrate
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000); // Give React/Vue time
  
  // Try multiple reveal strategies
  await page.evaluate(() => {
    // Trigger tabs
    document.querySelectorAll('[role="tab"]').forEach(el => el.click());
    
    // Open accordions
    document.querySelectorAll('[aria-expanded="false"]').forEach(el => {
      el.click();
    });
    
    // Scroll to bottom (lazy load)
    window.scrollTo(0, document.body.scrollHeight);
  });
  
  await page.waitForTimeout(1000);
}
```

### Issue: Wrong domain detection
**Cause**: Ambiguous page signals  
**Fix**:
```javascript
// Add domain scoring threshold
detectDomain(pageData) {
  const scores = { /* ... scoring logic ... */ };
  const [topDomain, topScore] = Object.entries(scores)
    .sort(([,a], [,b]) => b - a)[0];
  
  // Require confidence threshold
  return topScore >= 2 ? topDomain : null;
}

// Or add manual override
await analyzer.analyze(url, { 
  domain: 'ecommerce' // Force specific domain
});
```

### Issue: Analysis too slow
**Cause**: Full page screenshots, complex DOM  
**Fix**:
```javascript
// Optimize screenshot capture
screenshots: {
  aboveFold: await page.screenshot({ 
    clip: { x: 0, y: 0, width: 1280, height: 800 },
    type: 'jpeg', // Faster than PNG
    quality: 80   // Reduce file size
  }),
  fullPage: skipFullPage ? null : await page.screenshot({ fullPage: true })
}

// Simplify DOM more aggressively
cleanDOM(html) {
  // Only keep semantic content
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // Remove non-essential elements
  temp.querySelectorAll('svg, iframe, video').forEach(el => el.remove());
  
  return temp.innerHTML.substring(0, 10000); // Hard limit
}
```

---

## Performance Optimization Checklist

- [ ] Use QUICK_SCAN for bulk analysis (100+ pages)
- [ ] Cache analysis results (24-48hr TTL)
- [ ] Parallelize page captures (10 concurrent max)
- [ ] Compress DOM before sending to LLM
- [ ] Skip full-page screenshots when not needed
- [ ] Use focused mode when problem area is known
- [ ] Batch similar pages together
- [ ] Monitor token usage per analysis
- [ ] Set timeouts (30s for quick, 60s for deep)
- [ ] Retry logic for rate limits

---

## Quality Assurance

### Pre-flight Checks
```javascript
// Before running analysis
async function preflight(url) {
  const page = await browser.newPage();
  await page.goto(url);
  
  // Check if page is accessible
  const status = page.response()?.status();
  if (status !== 200) {
    throw new Error(`Page returned ${status}`);
  }
  
  // Check if page has content
  const bodyText = await page.evaluate(() => document.body.innerText);
  if (bodyText.length < 100) {
    console.warn('Page has very little content');
  }
  
  // Check if page requires auth
  const hasLoginForm = await page.$('form[action*="login"]');
  if (hasLoginForm) {
    console.warn('Page may require authentication');
  }
  
  await page.close();
}
```

### Post-analysis Validation
```javascript
// After analysis completes
function validateAnalysis(result, mode) {
  const checks = {
    hasPageContext: !!result.page_context,
    hasCriticalIssues: Array.isArray(result.critical_issues),
    hasConversionScore: typeof result.conversion_readiness === 'number',
    hasSpecificEvidence: JSON.stringify(result).includes('http') // Has URLs/examples
  };
  
  const failed = Object.entries(checks)
    .filter(([_, passed]) => !passed)
    .map(([check]) => check);
  
  if (failed.length > 0) {
    console.error('Analysis quality issues:', failed);
    // Re-run with enhanced prompt or manual review
  }
  
  return failed.length === 0;
}
```

---

## Emergency Fallbacks

### Fallback 1: Simplified Schema
If LLM keeps failing schema validation:
```javascript
// Ultra-simple schema
const MINIMAL_SCHEMA = {
  url: "string",
  issues: ["array of strings"],
  recommendations: ["array of strings"],
  priority_score: 0-10
};
```

### Fallback 2: No JSON Mode
If JSON parsing fails repeatedly:
```javascript
// Request markdown instead
const prompt = `${basePrompt}

Return your analysis in markdown format with sections:
# Critical Issues
# Quick Wins  
# Recommendations

Be specific and reference actual page elements.
`;
```

### Fallback 3: Human Review Flag
```javascript
// Auto-flag for human review if:
const needsHumanReview = 
  result.conversion_readiness < 40 ||
  result.critical_issues.length > 5 ||
  !validateAnalysis(result);

if (needsHumanReview) {
  console.log('⚠️ Flagging for manual review');
  // Send to review queue
}
```

---

## Cost Estimation

**GPT-4 Pricing** (as of 2024):
- Input: $0.01 / 1K tokens
- Output: $0.03 / 1K tokens

| Mode | Avg Cost | Per 100 Pages |
|------|----------|--------------|
| Quick Scan | $0.04 | $4 |
| Standard | $0.12 | $12 |
| Deep | $0.28 | $28 |

**Optimization for cost**:
- Use Claude Haiku for quick scans ($0.001/1K = 10x cheaper)
- Use GPT-4 only for deep analysis
- Cache frequently analyzed pages

---

## When to Ignore the System

**Don't force modular prompts if:**
- Analyzing a single page once (just use original prompt)
- Page is so broken you need creative problem-solving (use conversational mode)
- Doing exploratory research (rigid schema limits discovery)

**The modular system is for:**
- Production agents analyzing 10+ pages
- Repeatable workflows
- Cost-sensitive operations
- Building client-facing tools

Use the right tool for the job. Sometimes that's a 540-line comprehensive prompt. But for your browser agent doing bulk CRO analysis? This modular system is the solution.
