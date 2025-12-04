# Domain-Specific CRO Heuristics

**Usage**: Inject relevant domain section into prompt when `page_context.domain` is detected.

---

## E-COMMERCE

### Product Pages
**Critical Elements**:
- **Images**: Minimum 4 angles, zoom functionality, lifestyle + product shots
- **Variant Selection**: Color/size pickers must show availability inline
- **Stock Status**: Real-time visibility ("3 left in stock" > "In stock")
- **Shipping Info**: Cost/timeline above fold or near price
- **Reviews**: 4.0+ rating visible, sort by recent/helpful, photo reviews prioritized
- **Add to Cart**: Sticky CTA on scroll, contrasting color, "Added!" confirmation

**Friction Points**:
- Shipping calculator behind cart entry
- Out-of-stock variants not disabled
- Size guide behind modal (should be inline)
- No product videos for $100+ items
- Generic "Buy Now" vs "Add to Cart" confusion

**Quick Wins**:
- Add "Free returns" near price
- Show related products below the fold
- Enable guest checkout prominently
- Add trust badge near checkout button

### Category Pages
**Critical Elements**:
- Filters (price, size, color, rating) above fold
- Active filter display with clear removal
- Sort options (popular, price, rating, new)
- Product grid: 3-4 columns desktop, 2 mobile
- Quick view on hover (not requiring page load)
- "Load more" vs pagination for mobile

**Friction Points**:
- Filter selection requires page reload
- No filter memory on back button
- Price shown without currency/taxes
- Inconsistent product info across cards

---

## SAAS

### Pricing Pages
**Critical Elements**:
- **Tier Comparison**: 3-4 tiers, recommended tier highlighted
- **Feature Tooltips**: Hover explanations for technical features
- **Annual Discount**: Clearly shown (toggle or badge)
- **Social Proof**: "1,000+ companies use Enterprise" near tiers
- **Trial Clarity**: "Start 14-day trial" not "Get Started"
- **No Credit Card**: Messaging if trial requires no payment

**Friction Points**:
- Feature list too long (>20 per tier)
- No clear "most popular" recommendation
- Custom pricing with no ballpark range
- Contact sales with no alternative self-serve option
- Hidden limits (users, storage, API calls)

**Quick Wins**:
- Add "What's included in trial?" explainer
- Show annual vs monthly savings prominently
- Link to demo video from pricing page
- Add customer logos by tier ("Used by X")

### Homepage
**Critical Elements**:
- **Hero Value Prop**: One sentence, benefit-focused, jargon-free
- **Primary CTA**: Demo vs Trial vs Signup (choose one priority)
- **Use Case Clarity**: "For Marketing Teams" > "For Businesses"
- **Customer Logos**: 6-8 recognizable brands above fold
- **Product Screenshot**: Actual interface, not generic illustration
- **Secondary CTA**: "See how it works" video link

**Friction Points**:
- Generic headline ("The best way to...")
- Feature list before use case
- Multiple competing CTAs above fold
- No social proof above fold
- Auto-playing video (user can't control)

### Signup Flow
**Critical Elements**:
- SSO options (Google, Microsoft) prominent
- Email/password fields only (defer company name, phone, etc.)
- Password requirements shown upfront
- "By signing up..." terms under submit
- Post-signup: immediate value (not setup tutorial)
- Progress indicator if multi-step

**Friction Points**:
- Asking for company size/role before core signup
- Password requirements only shown on error
- Email verification blocking product access
- No "Skip" option for optional fields
- Dropdown with 50+ countries

---

## TRAVEL / BOOKING

### Search Interface
**Critical Elements**:
- **Date Picker**: Flexible dates option, visual calendar, popular date ranges
- **Guest Selection**: Clear adult/child/infant breakdown
- **Location Autocomplete**: Popular destinations suggested
- **Search CTA**: "Search Hotels" not "Submit"
- **Recent Searches**: Persist for returning users
- **Filters**: Price, rating, amenities accessible without scrolling

**Friction Points**:
- Date picker requires specific dates (no flexibility)
- Location field rejects partial matches
- Guest count buried in dropdown
- No clear default for "best price" sort

### Results Pages
**Critical Elements**:
- **Map Integration**: Toggle between list/map view
- **Filter Sidebar**: Sticky filters, active count display
- **Result Cards**: Price prominent, rating + review count, primary photo
- **Sort Options**: Price, rating, distance, popular
- **Cancellation Policy**: "Free cancellation" badge on cards
- **"See availability"**: CTA clarity (vs "Book now" which is premature)

**Friction Points**:
- Price doesn't include taxes/fees
- Photos auto-rotate (user can't control)
- Review snippets too generic
- No amenity icons (requires click to see)
- Ratings without review count

### Detail Pages
**Critical Elements**:
- **Image Gallery**: 10+ photos, room-specific shots, amenities
- **Availability Calendar**: Real-time, price variance shown
- **Amenities List**: Icons + descriptions, organized by category
- **Location Map**: Nearby attractions, transit options
- **Reviews**: Filter by recent/rating, verified stays highlighted
- **Pricing Breakdown**: Nightly rate + taxes/fees + total upfront

**Friction Points**:
- Policies hidden in expandable sections
- Amenities list is text-only (no icons)
- Check-in/out times not visible
- Cancellation terms in fine print
- No comparison with similar properties

---

## B2B

### Lead Forms
**Critical Elements**:
- **Field Count**: 5-7 max for top-of-funnel
- **Business Email Validation**: Reject Gmail/Yahoo
- **Company Size Dropdown**: Simple tiers (1-10, 11-50, 51-200, 201+)
- **Privacy Assurance**: "We won't spam you" near submit
- **What Happens Next**: "We'll contact you within 24 hours"
- **No Phone Required**: Make phone optional unless critical

**Friction Points**:
- Asking for budget/timeline too early
- Required fields not marked
- Generic "Submit" button
- No indication of sales follow-up process
- Dropdown with 100+ industries

**Quick Wins**:
- Change "Submit" to "Request Demo"
- Add "No commitment required" messaging
- Show response time ("We respond in 2 hours")
- Pre-fill company data from email domain

### Case Studies
**Critical Elements**:
- **Results Upfront**: "40% increase in revenue" in headline
- **Industry Tag**: Clear relevance signaling
- **Problem/Solution/Results Structure**: Scannable sections
- **Specific Metrics**: Real numbers, timeframes, attribution
- **PDF Download**: Gated or ungated based on funnel stage
- **Related Case Studies**: Suggest 2-3 similar stories

**Friction Points**:
- Results buried at end
- Generic "success story" without metrics
- No industry/company size mentioned
- PDF requires form fill for known visitors
- No video/visual breakdown

### Demo Request
**Critical Elements**:
- **Calendar Integration**: Calendly/Chili Piper embed
- **Meeting Type Options**: Call vs video vs in-person
- **Agenda Preview**: "We'll discuss X, Y, Z"
- **Time Zone Auto-Detect**: Don't make user specify
- **Confirmation Email**: Immediate with calendar invite
- **No-Show Prevention**: Reminder 24hrs + 1hr before

**Friction Points**:
- Generic "Schedule a call" with no context
- No meeting duration specified
- Forcing specific times (no flexibility)
- Asking for detailed info in booking form
- No option to reschedule easily

---

## FINTECH / BANKING

### Security & Trust
**Critical Elements**:
- **Encryption Badges**: "256-bit SSL" visible near forms
- **Regulatory Mentions**: "FDIC insured", "SEC registered"
- **Data Protection**: "We never sell your data"
- **Two-Factor Auth**: Mentioned prominently in signup
- **Security Center Link**: Footer + near sensitive actions

**Friction Points**:
- No security messaging near financial inputs
- Generic trust badges without specifics
- Missing contact information
- No explanation of data usage
- Unclear account protection policies

### Onboarding
**Critical Elements**:
- **Step Indicator**: "Step 2 of 5" with progress bar
- **Document Requirements**: Listed upfront (ID, proof of address)
- **Progress Saving**: "Your application is saved"
- **Identity Verification**: Clear camera/upload options
- **Error Prevention**: Real-time validation, clear error messages
- **Eligibility Checker**: Before full application

**Friction Points**:
- Surprise document requests mid-flow
- No progress saving (lose data on timeout)
- Unclear photo requirements
- Generic error messages
- No way to pause and resume

### Product Pages (Accounts, Cards, Loans)
**Critical Elements**:
- **Rate/Fee Transparency**: APR, annual fee, transaction fees upfront
- **Comparison Tools**: Side-by-side product comparison
- **Eligibility Info**: Credit score requirements, income thresholds
- **Terms Clarity**: Plain language summaries + full legal
- **Calculator Tools**: Loan payment, savings growth, fee estimates

**Friction Points**:
- Rates hidden behind "Check your rate"
- Comparison requires opening multiple tabs
- Jargon-heavy descriptions
- Terms in dense PDF only
- No examples/scenarios

---

## INSURANCE

### Quote Forms
**Critical Elements**:
- **Multi-Step Design**: Progress indicator, logical grouping
- **Field Explanations**: Tooltips for VIN, coverage limits, deductibles
- **No Jargon**: "Collision coverage" explained simply
- **Inline Validation**: "This doesn't look like a valid ZIP code"
- **Save Progress**: Email link to resume
- **Quote Result**: Clear price breakdown by coverage type

**Friction Points**:
- Single-page form with 30+ fields
- Insurance terms without explanations
- Required fields for optional coverage
- No indication of quote accuracy (estimate vs final)
- Surprise questions about claims history

### Coverage Pages
**Critical Elements**:
- **Plan Comparison Table**: Basic vs Standard vs Premium
- **What's Covered**: Bullet lists, real examples
- **What's Not Covered**: Exclusions upfront, not hidden
- **Premium Factors**: What affects price (age, location, coverage)
- **Coverage Calculator**: Interactive tool to adjust limits
- **Customer Stories**: Real claim examples

**Friction Points**:
- Feature comparison without prices
- Coverage explanations in insurance jargon
- Exclusions buried in terms
- No clear recommendation for typical customer
- Static comparison (no interactivity)

---

## CONDITIONAL INJECTION LOGIC

```javascript
// In your agent code
function getDomainHeuristics(domain) {
  const heuristics = {
    'ecommerce': ECOMMERCE_HEURISTICS,
    'saas': SAAS_HEURISTICS,
    'travel': TRAVEL_HEURISTICS,
    'b2b': B2B_HEURISTICS,
    'fintech': FINTECH_HEURISTICS,
    'insurance': INSURANCE_HEURISTICS
  };
  
  return heuristics[domain] || '';
}

// Add to prompt
const prompt = `
${CORE_SYSTEM_PROMPT}
${TASK_PROMPT}
${getDomainHeuristics(detectedDomain)}
${SCHEMA}
`;
```

This keeps your base prompt lean while adding domain expertise only when needed.
