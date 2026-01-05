**Navigation**: [Index](./index.md) | [Previous](./architecture.md) | [Next](./phase-13-15.md)

## Dependencies

### Production
```json
{
  "playwright": "^1.56.1",
  "@playwright/browser-chromium": "^1.56.1",
  "langchain": "^1.0.6",
  "@langchain/openai": "^1.1.2",
  "dotenv": "^17.2.3",
  "zod": "^4.1.12"
}
```

**Notes**:
- `@playwright/browser-chromium`: Added in Phase 10 (T036) - auto-installs Chromium browser with npm install
- `dotenv`: Added in Phase 10 (T038) - loads .env files for configuration
- `@langchain/core`: Peer dependency of `@langchain/openai` (HumanMessage, SystemMessage)

### Development
```json
{
  "typescript": "^5.9.3",
  "@types/node": "^24.10.1",
  "vitest": "^4.0.13",
  "@playwright/test": "^1.56.1",
  "eslint": "^9.39.1",
  "@typescript-eslint/eslint-plugin": "^8.47.0",
  "@typescript-eslint/parser": "^8.47.0",
  "prettier": "^3.6.2",
  "tsx": "^4.20.6"
}
```

**Notes**:
- `@typescript-eslint/parser`: Required for ESLint to parse TypeScript
- `tsx`: Replaces ts-node for better ESM support in development
- All versions updated to current as of 2025-11-24, fully compatible with original design

## Test Strategy

### Test Case 1: Basic URL Loading Verification (US1)
- Load `https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy`
- Verify page title extracted
- Verify no errors

### Test Case 2: Data Extraction Accuracy (US2)
- Load page with known heading structure
- Verify all h1-h6 captured
- Verify correct hierarchy levels
- Verify document order preserved

### Test Case 3: End-to-End Multi-URL Workflow (US1-US4)
- Process 3 different URLs sequentially:
  1. `https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy` (simple)
  2. `https://developer.mozilla.org/en-US/` (complex)
  3. `https://httpstat.us/404` (error case)
- Verify results for each URL
- Verify error handling for 404
- Verify console output format

### Test Case 4: Cookie Consent Handling (US5)
- Test with known CMP sites (OneTrust, Cookiebot)
- Verify popup dismissed before extraction
- Verify heuristic fallback on custom banners
- Verify sites without popups have no delay
- Verify `--no-cookie-dismiss` flag disables feature

## Complexity Tracking

> No constitution violations identified. All principles satisfied.

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| 4 modules | Keep | Maps directly to user stories and separation of concerns |
| LangChain abstraction | Keep | Enables future model swapping without code changes |
| Visible browser | Required | Per CR-001, aids debugging |
