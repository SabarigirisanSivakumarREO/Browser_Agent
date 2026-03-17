# New Session Prompt

Copy-paste this to start a new Claude Code session:

```
Read specs/001-browser-agent-core/quickstart.md to get the complete project context.

## Session Context (2026-03-04)

### CRITICAL RULE - Spec Kit Maintenance
**ALWAYS update spec kit files after completing any task implementation:**
1. `tasks/phase-XX.md` - Mark task status, update acceptance
2. `quickstart.md` - Update "Last Updated" date and phase status
3. `SESSION-PROMPT.md` - Update session context for next session

### Previously Completed (Phase 28 — ❌ REVERTED 2026-03-04)
- Phase 28 reverted: retries caused timeouts under TPM limits, confidence downgrade broke annotation pipeline
- Code removed: `retryWithBackoff`, `isRateLimitError`, `downgradeUngroundedConfidence`, `EvidenceEvaluation`
- Tests deleted: `rate-limit-retry.test.ts`, `confidence-downgrade.test.ts`, `evidence-evaluations.test.ts`
- Model default changed: gpt-4o → gpt-4o-mini (gpt-4o exceeds 30K TPM with batched 9-viewport requests)

---

### Pre-existing Test Failures (NOT ours — ignore)
- `validator.test.ts` — URL trailing slash normalization
- `formatter.test.ts` — missing module `../../src/output/formatter.js`
- `browser.test.ts` — missing module `../../src/extraction/index.js`
- `dom-screenshot-mapping.test.ts` — missing module `../../src/agent/vision/vision-prompt-builder.js`
- `isPageTypeSupported('plp')` assertions — Phase 22A added PLP but old tests expect false
- `cro-full-workflow.test.ts` — business type detection mock issue

### Mock Pattern for Tests
When mocking `category-analyzer.js`, MUST include:
```js
populateElementRefs: vi.fn(),
buildElementPositionsBlock: vi.fn().mockReturnValue(null),
```

### Test Commands
```
# Type check
npx tsc --noEmit
```
```
