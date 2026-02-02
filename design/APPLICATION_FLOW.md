# CRO Browser Agent Application Flow

**Last Updated**: 2026-01-30 | **Phase**: CR-001 ✅ Complete | **Next**: Phase 21h (Evidence Capture)

## High-Level Architecture

```
+-----------------------------------------------------------------------------------+
|                           CRO BROWSER AGENT SYSTEM                                 |
|                    CR-001 Complete: Unified Agent Architecture                     |
+-----------------------------------------------------------------------------------+
|                                                                                    |
|    +--------+     +-------------------+     +-----------------+                    |
|    |  CLI   | --> |  Unified CROAgent | --> |    Output       |                    |
|    | (User) |     |  (Orchestrator)   |     |   Generation    |                    |
|    +--------+     +-------------------+     +-----------------+                    |
|                            |                                                       |
|         +------------------+------------------+------------------+                  |
|         |                  |                  |                  |                  |
|         v                  v                  v                  v                  |
|   +-----------+    +-------------+    +---------------+   +---------------+        |
|   | Browser   |    | DOM + Vision|    | Analysis      |   | Heuristic     |        |
|   | Module    |    | Capture     |    | Orchestrator  |   | Knowledge     |        |
|   +-----------+    +-------------+    +---------------+   +---------------+        |
|         |                |                  |                  |                   |
|         v                v                  v                  v                   |
|   +-----------+    +-------------+    +---------------+   +---------------+        |
|   | Playwright|    | Viewport    |    | Category      |   | PDP (35 rules)|        |
|   | Browser   |    | Snapshots   |    | Analyzer      |   | + Future KBs  |        |
|   +-----------+    | (DOM+Image) |    | (per category)|   +---------------+        |
|         |          +-------------+    +---------------+                            |
|         v                                                                          |
|   +-----------+                                                                    |
|   | Cookie    |    THREE-PHASE FLOW (CR-001):                                      |
|   | Handler   |    1. COLLECTION: scroll, click, capture DOM + screenshots         |
|   +-----------+    2. ANALYSIS: LLM calls per heuristic category                   |
|                    3. OUTPUT: console, JSON, evidence, hypotheses                  |
|                                                                                    |
+-----------------------------------------------------------------------------------+
```

## Complete Data Flow Pipeline

```
                                    APPLICATION FLOW
+------------------------------------------------------------------------------------+
|                                                                                     |
|  INPUT                                                                              |
|  +----+                                                                             |
|  |URL | ---> npm run start -- https://example.com                                   |
|  +----+                                                                             |
|    |                                                                                |
|    v                                                                                |
|  +----------------------------------------------------------------------+           |
|  |                         CLI LAYER (cli.ts)                           |           |
|  |  +-------------+    +-------------+    +-------------+               |           |
|  |  | Parse Args  | -> | Load .env   | -> | Validate    |               |           |
|  |  | --headless  |    | OPENAI_KEY  |    | Environment |               |           |
|  |  | --verbose   |    |             |    |             |               |           |
|  |  | --output    |    |             |    |             |               |           |
|  |  | --max-steps |    |             |    |             |               |           |
|  |  | --timeout   |    |             |    |             |               |           |
|  |  | --scan-mode |    |             |    |             |               |           |
|  |  | --min-cover |    |             |    |             |               |           |
|  |  +-------------+    +-------------+    +-------------+               |           |
|  +----------------------------------------------------------------------+           |
|    |                                                                                |
|    v                                                                                |
|  +----------------------------------------------------------------------+           |
|  |                    CRO AGENT (cro-agent.ts)                          |           |
|  |                      [Main Orchestrator]                             |           |
|  |                                                                      |           |
|  |   analyze(url) -> CROAnalysisResult                                  |           |
|  +----------------------------------------------------------------------+           |
|    |                                                                                |
|    +----------+----------+----------+----------+----------+                         |
|    |          |          |          |          |          |                         |
|    v          v          v          v          v          v                         |
|  +-------+ +-------+ +--------+ +--------+ +--------+ +--------+                    |
|  |BROWSER| | DOM   | |COVERAGE| | AGENT  | |HEURIST | | OUTPUT |                    |
|  |MODULE | | MERGE | |TRACKER | | CORE   | |ENGINE  | | MODULE |                    |
|  +-------+ +-------+ +--------+ +--------+ +--------+ +--------+                    |
|                                                                                     |
+------------------------------------------------------------------------------------+
```

## Stage-by-Stage Processing Flow

```
+==================================================================================+
|                           STAGE 1: BROWSER SETUP                                  |
+==================================================================================+
|                                                                                   |
|   +---------------------+         +-----------------------+                       |
|   |   BrowserManager    |         |     PageLoader        |                       |
|   |   (browser/)        |         |                       |                       |
|   +---------------------+         +-----------------------+                       |
|           |                                 |                                      |
|           v                                 v                                      |
|   +---------------------+         +-----------------------+                       |
|   | - Launch Chromium   |         | - Validate URL        |                       |
|   | - Create Context    |         | - Navigate to URL     |                       |
|   |   (ignoreHTTPS:true)|         | - Wait for page load  |                       |
|   | - Set Viewport      |         | - Handle timeouts     |                       |
|   |   (1280x720)        |         | - Dismiss cookies     |                       |
|   | - Set Timeout (60s) |         |                       |                       |
|   +---------------------+         +-----------------------+                       |
|                                                                                   |
+==================================================================================+

                                        |
                                        v

+==================================================================================+
|                       STAGE 2: DOM EXTRACTION + COVERAGE                          |
+==================================================================================+
|                                                                                   |
|   +-------------------------------------------------------------------------+     |
|   |                    DOMExtractor (browser/dom/)                          |     |
|   +-------------------------------------------------------------------------+     |
|                                     |                                             |
|                                     v                                             |
|        +------------------------------------------------------------+             |
|        |                    Extract DOM Elements                    |             |
|        |  +------------------+  +------------------+  +------------+ |             |
|        |  | Query Elements   |  | Extract Attrs    |  | Classify   | |             |
|        |  | (buttons, forms, |  | (id, class,      |  | for CRO    | |             |
|        |  |  links, inputs)  |  |  href, text)     |  | Analysis   | |             |
|        |  +------------------+  +------------------+  +------------+ |             |
|        +------------------------------------------------------------+             |
|                                     |                                             |
|                                     v                                             |
|   +-------------------------------------------------------------------------+     |
|   |                    CoverageTracker (Phase 19)                           |     |
|   +-------------------------------------------------------------------------+     |
|   |  +------------------+  +------------------+  +------------------+        |     |
|   |  | Initialize       |  | Track Segments   |  | Calculate %      |        |     |
|   |  | (pageHeight,     |  | (scrollY,        |  | getCoverage      |        |     |
|   |  |  viewportHeight) |  |  elements)       |  | Percent()        |        |     |
|   |  +------------------+  +------------------+  +------------------+        |     |
|   +-------------------------------------------------------------------------+     |
|                                     |                                             |
|                                     v                                             |
|   +-------------------------------------------------------------------------+     |
|   |                    DOMMerger (Phase 19)                                 |     |
|   +-------------------------------------------------------------------------+     |
|   |  Merge DOM snapshots from multiple scroll positions                     |     |
|   |  - Absolute coordinates (page-relative)                                 |     |
|   |  - Fingerprint-based deduplication                                      |     |
|   |  - Dynamic token filtering                                              |     |
|   +-------------------------------------------------------------------------+     |
|                                     |                                             |
|                                     v                                             |
|                      +-------------------------------+                            |
|                      |        DOMTree Result         |                            |
|                      | - nodes: DOMNode[]            |                            |
|                      | - url: string                 |                            |
|                      | - title: string               |                            |
|                      | - metadata: PageMetadata      |                            |
|                      | - statistics: DOMStats        |                            |
|                      +-------------------------------+                            |
|                                     |                                             |
|                                     v                                             |
|                      +-------------------------------+                            |
|                      |     CRO Classification        |                            |
|                      | - cta (Call-to-action)        |                            |
|                      | - form (Form elements)        |                            |
|                      | - trust (Trust signals)       |                            |
|                      | - value_prop (Value props)    |                            |
|                      | - navigation (Nav elements)   |                            |
|                      +-------------------------------+                            |
|                                                                                   |
+==================================================================================+

                                        |
                                        v

+==================================================================================+
|                        STAGE 3: AGENT LOOP (with Coverage)                        |
+==================================================================================+
|                                                                                   |
|   +-------------------------------------------------------------------------+     |
|   |                    Agent Core (agent/)                                  |     |
|   |            observe -> reason -> act (dynamic maxSteps)                  |     |
|   |                                                                         |     |
|   |   SCAN MODES (Phase 19):                                                |     |
|   |   +------------------+  +------------------+  +------------------+      |     |
|   |   | full_page        |  | above_fold       |  | llm_guided       |      |     |
|   |   | Auto-scroll for  |  | Initial viewport |  | LLM decides      |      |     |
|   |   | 100% coverage    |  | only (faster)    |  | scrolling        |      |     |
|   |   +------------------+  +------------------+  +------------------+      |     |
|   +-------------------------------------------------------------------------+     |
|                                     |                                             |
|       +-----------------------------+-----------------------------+               |
|       |                             |                             |               |
|       v                             v                             v               |
|   +----------+              +---------------+             +-------------+         |
|   | OBSERVE  |              | REASON        |             | ACT         |         |
|   | (DOM     |              | (GPT-4o       |             | (Execute    |         |
|   |  State + |              |  Analysis)    |             |  Tool)      |         |
|   | Coverage)|              |               |             |             |         |
|   +----------+              +---------------+             +-------------+         |
|       |                             |                             |               |
|       v                             v                             v               |
|   +---------+               +---------------+             +-------------+         |
|   | Build   |               | API Request   |             | 11 CRO      |         |
|   | Page    |               | - System Msg  |             | Analysis    |         |
|   | State + |               | - User Msg    |             | Tools       |         |
|   | Coverage|               | - Coverage    |             |             |         |
|   | Report  |               |   Context     |             |             |         |
|   +---------+               | - temp: 0.3   |             |             |         |
|                             +---------------+             +-------------+         |
|                                                                   |               |
|                             LOOP UNTIL                            |               |
|                        'done' AND coverage >= minCoverage         |               |
|                          OR maxSteps reached                      |               |
|                                                                   v               |
|                                            +----------------------------+         |
|                                            |     CROAgentOutput         |         |
|                                            | - insights: CROInsight[]   |         |
|                                            | - hypotheses: Hypothesis[] |         |
|                                            | - stepsExecuted: number    |         |
|                                            | - actionHistory: string[]  |         |
|                                            | - coveragePercent: number  |         |
|                                            +----------------------------+         |
|                                                                                   |
+==================================================================================+

                                        |
                                        v

+==================================================================================+
|                        STAGE 4: HEURISTIC ANALYSIS                                |
+==================================================================================+
|                                                                                   |
|   +-------------------------------------------------------------------------+     |
|   |                 HeuristicEngine (heuristics/)                           |     |
|   +-------------------------------------------------------------------------+     |
|                                     |                                             |
|                                     v                                             |
|        +------------------------------------------------------------+             |
|        |            Apply 10 Heuristic Rules (H001-H010)            |             |
|        +------------------------------------------------------------+             |
|        |                                                            |             |
|        |  +------------------+  +------------------+  +------------+ |             |
|        |  | CTA Rules        |  | Form Rules       |  | Trust      | |             |
|        |  | H001: Missing    |  | H005: Form too   |  | Rules      | |             |
|        |  |   primary CTA    |  |   long           |  | H006       | |             |
|        |  | H002: CTA below  |  |                  |  |            | |             |
|        |  |   fold           |  |                  |  |            | |             |
|        |  | H003: Low        |  |                  |  |            | |             |
|        |  |   contrast       |  |                  |  |            | |             |
|        |  | H004: Generic    |  |                  |  |            | |             |
|        |  |   text           |  |                  |  |            | |             |
|        |  +------------------+  +------------------+  +------------+ |             |
|        |                                                            |             |
|        |  +------------------+  +------------------+  +------------+ |             |
|        |  | Value Prop Rules |  | Navigation Rules |  | Friction   | |             |
|        |  | H007: Unclear    |  | H008: Poor nav   |  | Detection  | |             |
|        |  |   value prop     |  |                  |  | H010       | |             |
|        |  +------------------+  +------------------+  +------------+ |             |
|        |                                                            |             |
|        |  +------------------+                                      |             |
|        |  | Social Proof     |                                      |             |
|        |  | H009: Missing    |                                      |             |
|        |  |   social proof   |                                      |             |
|        |  +------------------+                                      |             |
|        +------------------------------------------------------------+             |
|                                     |                                             |
|                                     v                                             |
|                      +-------------------------------+                            |
|                      |    Business Type Detection    |                            |
|                      | - ecommerce                   |                            |
|                      | - saas                        |                            |
|                      | - banking                     |                            |
|                      | - insurance                   |                            |
|                      | - travel                      |                            |
|                      | - media                       |                            |
|                      | - other                       |                            |
|                      +-------------------------------+                            |
|                                     |                                             |
|                                     v                                             |
|                      +-------------------------------+                            |
|                      |   Severity Scoring            |                            |
|                      | - critical                    |                            |
|                      | - high                        |                            |
|                      | - medium                      |                            |
|                      | - low                         |                            |
|                      +-------------------------------+                            |
|                                                                                   |
+==================================================================================+

                                        |
                                        v

+==================================================================================+
|                        STAGE 5: POST-PROCESSING                                   |
+==================================================================================+
|                                                                                   |
|   +-------------------------------------------------------------------------+     |
|   |                    Post-Processing Pipeline (output/)                   |     |
|   +-------------------------------------------------------------------------+     |
|                                     |                                             |
|       +-----------------------------+-----------------------------+               |
|       |                             |                             |               |
|       v                             v                             v               |
|   +---------------+         +---------------+           +---------------+         |
|   | Insight       |         | Insight       |           | Hypothesis    |         |
|   | Deduplicator  |         | Prioritizer   |           | Generator     |         |
|   +---------------+         +---------------+           +---------------+         |
|   | Remove        |         | Sort by:      |           | Generate test |         |
|   | duplicate     |         | - Severity    |           | hypotheses    |         |
|   | insights      |         | - Business    |           | from insights |         |
|   |               |         |   impact      |           |               |         |
|   +---------------+         +---------------+           +---------------+         |
|                                     |                                             |
|                                     v                                             |
|                      +-------------------------------+                            |
|                      |       Score Calculator        |                            |
|                      | - Calculate overall CRO score |                            |
|                      | - Generate score breakdown    |                            |
|                      | - Assign grade (A-F)          |                            |
|                      +-------------------------------+                            |
|                                                                                   |
+==================================================================================+

                                        |
                                        v

+==================================================================================+
|                        STAGE 6: OUTPUT GENERATION                                 |
+==================================================================================+
|                                                                                   |
|   +-------------------------------------------------------------------------+     |
|   |                    Output Module (output/)                              |     |
|   +-------------------------------------------------------------------------+     |
|                                     |                                             |
|       +-----------------------------+-----------------------------+               |
|       |                             |                             |               |
|       v                             v                             v               |
|   +---------------+         +---------------+           +---------------+         |
|   | Console       |         | Markdown      |           | JSON          |         |
|   | Formatter     |         | Reporter      |           | Exporter      |         |
|   +---------------+         +---------------+           +---------------+         |
|   | Real-time     |         | Generate      |           | Generate      |         |
|   | console       |         | .md report    |           | .json file    |         |
|   | output        |         | with insights |           | structured    |         |
|   +---------------+         +---------------+           +---------------+         |
|                                     |                                             |
|                                     v                                             |
|                      +-------------------------------+                            |
|                      |        FileWriter             |                            |
|                      | - Write to output directory   |                            |
|                      | - Create timestamped files    |                            |
|                      +-------------------------------+                            |
|                                     |                                             |
|                                     v                                             |
|                      +-------------------------------+                            |
|                      |    CROAnalysisResult          |                            |
|                      | - url: string                 |                            |
|                      | - businessType: result        |                            |
|                      | - insights: CROInsight[]      |                            |
|                      | - heuristicInsights: []       |                            |
|                      | - hypotheses: Hypothesis[]    |                            |
|                      | - scores: CROScores           |                            |
|                      | - metadata: AnalysisMetadata  |                            |
|                      | - coveragePercent: number     |                            |
|                      | - outputFiles?: paths         |                            |
|                      +-------------------------------+                            |
|                                                                                   |
+==================================================================================+
```

## 11 CRO Analysis Tools (Phase 17)

```
+---------------------------------------------------------------------------------+
|                              CRO ANALYSIS TOOLS (11)                             |
+---------------------------------------------------------------------------------+
|                                                                                  |
|   ANALYSIS TOOLS (6)                                                             |
|   +---------------------------+    +---------------------------+                 |
|   | 1. analyze_ctas           |    | 2. analyze_forms          |                 |
|   | Analyze call-to-action    |    | Analyze form elements     |                 |
|   | buttons for visibility,   |    | for length, labels,       |                 |
|   | clarity, and placement    |    | and user experience       |                 |
|   +---------------------------+    +---------------------------+                 |
|                                                                                  |
|   +---------------------------+    +---------------------------+                 |
|   | 3. detect_trust_signals   |    | 4. assess_value_prop      |                 |
|   | Find trust indicators     |    | Evaluate value            |                 |
|   | (testimonials, badges,    |    | proposition clarity       |                 |
|   | security seals)           |    | and positioning           |                 |
|   +---------------------------+    +---------------------------+                 |
|                                                                                  |
|   +---------------------------+    +---------------------------+                 |
|   | 5. check_navigation       |    | 6. find_friction          |                 |
|   | Analyze navigation        |    | Identify friction         |                 |
|   | complexity and            |    | points that hurt          |                 |
|   | consistency               |    | conversion                |                 |
|   +---------------------------+    +---------------------------+                 |
|                                                                                  |
|   NAVIGATION TOOLS (3)                                                           |
|   +---------------------------+    +---------------------------+                 |
|   | 7. scroll_page            |    | 8. click                  |                 |
|   | Scroll to reveal          |    | Click on elements         |                 |
|   | below-the-fold            |    | to test interactions      |                 |
|   | content                   |    |                           |                 |
|   +---------------------------+    +---------------------------+                 |
|                                                                                  |
|   +---------------------------+                                                  |
|   | 9. go_to_url              |                                                  |
|   | Navigate to a             |                                                  |
|   | different URL             |                                                  |
|   +---------------------------+                                                  |
|                                                                                  |
|   CONTROL TOOLS (2)                                                              |
|   +---------------------------+    +---------------------------+                 |
|   | 10. record_insight        |    | 11. done                  |                 |
|   | LLM records custom        |    | Signal analysis           |                 |
|   | observation               |    | completion                |                 |
|   +---------------------------+    +---------------------------+                 |
|                                                                                  |
+---------------------------------------------------------------------------------+
```

## 10 Heuristic Rules (Phase 18)

```
+---------------------------------------------------------------------------------+
|                           HEURISTIC RULES (H001-H010)                            |
+---------------------------------------------------------------------------------+
|                                                                                  |
|  CTA RULES                                                                       |
|  +-----------------------+    +-----------------------+                          |
|  | H001: Missing Primary |    | H002: CTA Below Fold  |   SEVERITY: critical    |
|  | CTA                   |    | Primary CTA not       |   SEVERITY: high        |
|  | No primary CTA found  |    | visible in viewport   |                          |
|  +-----------------------+    +-----------------------+                          |
|                                                                                  |
|  +-----------------------+    +-----------------------+                          |
|  | H003: Low Contrast    |    | H004: Generic CTA     |   SEVERITY: high        |
|  | CTA                   |    | Text                  |   SEVERITY: medium      |
|  | Poor color contrast   |    | "Click here", "Submit"|                          |
|  +-----------------------+    +-----------------------+                          |
|                                                                                  |
|  FORM RULES                                                                      |
|  +-----------------------+                                                       |
|  | H005: Form Too Long   |                               SEVERITY: medium       |
|  | More than 5 fields    |                                                       |
|  | in a single form      |                                                       |
|  +-----------------------+                                                       |
|                                                                                  |
|  TRUST RULES                                                                     |
|  +-----------------------+                                                       |
|  | H006: Missing Trust   |                               SEVERITY: high         |
|  | Signals               |                                                       |
|  | No badges, reviews,   |                                                       |
|  | or certifications     |                                                       |
|  +-----------------------+                                                       |
|                                                                                  |
|  VALUE PROPOSITION RULES                                                         |
|  +-----------------------+                                                       |
|  | H007: Unclear Value   |                               SEVERITY: critical     |
|  | Proposition           |                                                       |
|  | H1 doesn't clearly    |                                                       |
|  | communicate value     |                                                       |
|  +-----------------------+                                                       |
|                                                                                  |
|  NAVIGATION RULES                                                                |
|  +-----------------------+                                                       |
|  | H008: Poor Navigation |                               SEVERITY: medium       |
|  | Confusing menu        |                                                       |
|  | structure             |                                                       |
|  +-----------------------+                                                       |
|                                                                                  |
|  SOCIAL PROOF RULES                                                              |
|  +-----------------------+                                                       |
|  | H009: Missing Social  |                               SEVERITY: medium       |
|  | Proof                 |                                                       |
|  | No reviews or         |                                                       |
|  | testimonials          |                                                       |
|  +-----------------------+                                                       |
|                                                                                  |
|  FRICTION RULES                                                                  |
|  +-----------------------+                                                       |
|  | H010: Mobile Friction |                               SEVERITY: high         |
|  | Elements causing      |                                                       |
|  | mobile user friction  |                                                       |
|  +-----------------------+                                                       |
|                                                                                  |
+---------------------------------------------------------------------------------+
```

## Coverage System (Phase 19)

```
+---------------------------------------------------------------------------------+
|                          100% PAGE COVERAGE SYSTEM                               |
+---------------------------------------------------------------------------------+
|                                                                                  |
|   SCAN MODES                                                                     |
|   +---------------------------+    +---------------------------+                 |
|   | full_page (default)       |    | above_fold               |                 |
|   | - Auto-scroll entire page |    | - Initial viewport only  |                 |
|   | - 100% coverage required  |    | - No scrolling           |                 |
|   | - DOMMerger combines all  |    | - Faster analysis        |                 |
|   |   segments                |    |                          |                 |
|   +---------------------------+    +---------------------------+                 |
|                                                                                  |
|   +---------------------------+                                                  |
|   | llm_guided               |                                                   |
|   | - LLM decides scrolling  |                                                   |
|   | - Original behavior      |                                                   |
|   | - No enforcement         |                                                   |
|   +---------------------------+                                                  |
|                                                                                  |
|   COVERAGE TRACKING                                                              |
|   +---------------------------------------------------------------------+        |
|   |  CoverageTracker                                                    |        |
|   |  - initialize(pageHeight, viewportHeight)                           |        |
|   |  - markSegmentScanned(scrollY, elementsFound)                       |        |
|   |  - getCoveragePercent() -> 0-100                                    |        |
|   |  - isFullyCovered() -> boolean                                      |        |
|   |  - getCoverageReport() -> string (for LLM context)                  |        |
|   +---------------------------------------------------------------------+        |
|                                                                                  |
|   DOM MERGING                                                                    |
|   +---------------------------------------------------------------------+        |
|   |  DOMMerger                                                          |        |
|   |  - Merge DOM snapshots from multiple scroll positions               |        |
|   |  - Absolute page coordinates                                        |        |
|   |  - Fingerprint-based deduplication                                  |        |
|   |  - Dynamic token filtering                                          |        |
|   +---------------------------------------------------------------------+        |
|                                                                                  |
|   ENFORCEMENT                                                                    |
|   +---------------------------------------------------------------------+        |
|   |  In full_page mode:                                                 |        |
|   |  - Agent CANNOT call 'done' until coverage >= minCoveragePercent    |        |
|   |  - Default minCoveragePercent = 100                                 |        |
|   |  - Dynamic maxSteps based on page segments                          |        |
|   +---------------------------------------------------------------------+        |
|                                                                                  |
+---------------------------------------------------------------------------------+
```

## Unified Agent Flow (CR-001 Architecture)

```
+---------------------------------------------------------------------------------+
|                   UNIFIED CRO AGENT (CR-001 Architecture)                        |
+---------------------------------------------------------------------------------+
|                                                                                  |
|   PHASE 1: DATA COLLECTION                                                       |
|   +---------------------------------------------------------------------+        |
|   |  Tools: scroll_page, click_element, navigate_to_url, capture_viewport|        |
|   |                                                                     |        |
|   |  ┌──────────┐    ┌──────────┐    ┌──────────┐                      |        |
|   |  │ Scroll   │───▶│ Capture  │───▶│ Store    │                      |        |
|   |  │ Page     │    │ Viewport │    │ Snapshot │                      |        |
|   |  └──────────┘    └──────────┘    └──────────┘                      |        |
|   |                                        │                            |        |
|   |                                        ▼                            |        |
|   |                         ┌─────────────────────────────┐            |        |
|   |                         │ ViewportSnapshot[]          │            |        |
|   |                         │ - dom: DOMTree              │            |        |
|   |                         │ - screenshot: Base64        │            |        |
|   |                         │ - scrollPosition: number    │            |        |
|   |                         └─────────────────────────────┘            |        |
|   |                                                                     |        |
|   |  Signal: collection_done → Triggers Phase 2                        |        |
|   +---------------------------------------------------------------------+        |
|                                      │                                           |
|                                      ▼                                           |
|   PHASE 2: ANALYSIS (Category-Based LLM Calls)                                   |
|   +---------------------------------------------------------------------+        |
|   |  Orchestrator: runAnalysis(snapshots, pageType)                     |        |
|   |                                                                     |        |
|   |  For each heuristic category:                                       |        |
|   |  ┌──────────────────────────────────────────────────────────────┐  |        |
|   |  │  Category: Layout & Structure                                 │  |        |
|   |  │  ┌────────────┐   ┌────────────┐   ┌────────────┐           │  |        |
|   |  │  │ DOM Context│ + │ Screenshots│ + │ Heuristics │ → GPT-4o  │  |        |
|   |  │  └────────────┘   └────────────┘   └────────────┘           │  |        |
|   |  │                                                               │  |        |
|   |  │  → HeuristicEvaluation[] (pass/fail/partial for each rule)   │  |        |
|   |  └──────────────────────────────────────────────────────────────┘  |        |
|   |                                                                     |        |
|   |  Categories: Layout, Imagery, Pricing, Description, Specs,          |        |
|   |              Reviews, Selection, CTAs, Mobile, Utility              |        |
|   |                                                                     |        |
|   |  Output: AnalysisResult { evaluations, insights, summary }         |        |
|   +---------------------------------------------------------------------+        |
|                                      │                                           |
|                                      ▼                                           |
|   PHASE 3: OUTPUT GENERATION                                                     |
|   +---------------------------------------------------------------------+        |
|   |  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐              |        |
|   |  │ Console     │   │ Markdown    │   │ JSON        │              |        |
|   |  │ Formatter   │   │ Reporter    │   │ Exporter    │              |        |
|   |  └─────────────┘   └─────────────┘   └─────────────┘              |        |
|   |                                                                     |        |
|   |  CROAnalysisResult:                                                |        |
|   |  - url, pageType, businessType                                     |        |
|   |  - insights (DOM + Vision combined)                                |        |
|   |  - evaluations (per heuristic)                                     |        |
|   |  - hypotheses (A/B test ideas)                                     |        |
|   |  - scores (overall CRO grade)                                      |        |
|   +---------------------------------------------------------------------+        |
|                                                                                  |
|   COST: ~$0.005-0.010/page with gpt-4o-mini                                     |
|                                                                                  |
+---------------------------------------------------------------------------------+
```

## Agent Loop Flow (Legacy - Phase 19)

```
+---------------------------------------------------------------------------------+
|                   AGENT LOOP (with Coverage Enforcement)                         |
+---------------------------------------------------------------------------------+
|                                                                                  |
|   +-----------------+                                                            |
|   |  Initialize     |                                                            |
|   |  Agent State    |                                                            |
|   |  + Coverage     |                                                            |
|   +-----------------+                                                            |
|           |                                                                      |
|           v                                                                      |
|   +-------------------+                                                          |
|   | Get ScanMode      |                                                          |
|   | (full_page/above_ |                                                          |
|   | fold/llm_guided)  |                                                          |
|   +-------------------+                                                          |
|           |                                                                      |
|           v                                                                      |
|   +-------------------+                                                          |
|   |    STEP 1-N       |<------------------------------------------------+        |
|   | (dynamic maxSteps)|                                                 |        |
|   +-------------------+                                                 |        |
|           |                                                             |        |
|           v                                                             |        |
|   +-----------------+                                                   |        |
|   |    OBSERVE      |  Build PageState from current DOM + coverage      |        |
|   |    (DOM State)  |  - domTree: DOMTree                               |        |
|   |                 |  - insights: CROInsight[]                         |        |
|   |                 |  - previousActions: string[]                      |        |
|   |                 |  - coverageReport: string (Phase 19)              |        |
|   +-----------------+                                                   |        |
|           |                                                             |        |
|           v                                                             |        |
|   +-----------------+                                                   |        |
|   |    REASON       |  GPT-4o analyzes state and decides action         |        |
|   |    (GPT-4o)     |  - Receives: system prompt + page state           |        |
|   |                 |  - Coverage context in user message               |        |
|   |                 |  - Returns: tool call (action to take)            |        |
|   |                 |  - Model: gpt-4o, temp: 0.3                        |        |
|   +-----------------+                                                   |        |
|           |                                                             |        |
|           v                                                             |        |
|   +-----------------+                                                   |        |
|   |     ACT         |  Execute the chosen tool                          |        |
|   |   (Tool Exec)   |  - 11 CRO tools available                         |        |
|   |                 |  - Returns: new insights + updated state          |        |
|   |                 |  - Updates coverage tracker                       |        |
|   +-----------------+                                                   |        |
|           |                                                             |        |
|           v                                                             |        |
|   +-------------------+                                                 |        |
|   | Action == 'done'? |                                                 |        |
|   +-------------------+                                                 |        |
|           |                                                             |        |
|          YES                                                            |        |
|           |                                                             |        |
|           v                                                             |        |
|   +-------------------+                                                 |        |
|   | Coverage >= min%? |----NO--> Force continue or scroll ------------->+        |
|   | (full_page mode)  |                                                          |
|   +-------------------+                                                          |
|           |                                                                      |
|          YES (or maxSteps reached)                                               |
|           |                                                                      |
|           v                                                                      |
|   +-----------------+                                                            |
|   |  Return Output  |                                                            |
|   | CROAgentOutput  |                                                            |
|   | + coverage data |                                                            |
|   +-----------------+                                                            |
|                                                                                  |
+---------------------------------------------------------------------------------+
```

## Component Dependency Graph (Updated)

```
                              +-------------------+
                              |     CROAgent      |
                              |  (Orchestrator)   |
                              +-------------------+
                                       |
       +-----------+-----------+-------+-------+-----------+-----------+
       |           |           |               |           |           |
       v           v           v               v           v           v
+-----------+ +-----------+ +-----------+ +-----------+ +-----------+ +---------+
| Browser   | | DOM       | | Coverage  | | Agent     | | Heuristic | | Output  |
| Module    | | Extractor | | Tracker   | | Core      | | Engine    | | Module  |
+-----------+ +-----------+ +-----------+ +-----------+ +-----------+ +---------+
       |           |           |               |           |           |
       v           v           v               v           v           v
+-----------+ +-----------+ +-----------+ +-----------+ +-----------+ +---------+
| Playwright| | CRO       | | Segment   | | GPT-4o    | | 10 Rules  | | File    |
| Browser   | | Classifier| | Tracker   | | (OpenAI)  | | H001-H010 | | Writer  |
+-----------+ +-----------+ +-----------+ +-----------+ +-----------+ +---------+
       |           |                               |
       v           v                               v
+-----------+ +-----------+               +-------------------+
| Cookie    | | DOMMerger |               |   Tool System     |
| Handler   | | (Phase 19)|               |   (11 Tools)      |
+-----------+ +-----------+               +-------------------+
                                                   |
       +-----------+-----------+-----------+-------+-------+-----------+
       |           |           |           |               |           |
       v           v           v           v               v           v
+----------+ +----------+ +----------+ +----------+ +----------+ +----------+
|analyze_  | |analyze_  | |detect_   | |assess_   | |check_    | |find_     |
|ctas      | |forms     | |trust     | |value_prop| |navigation| |friction  |
+----------+ +----------+ +----------+ +----------+ +----------+ +----------+
       |           |           |
       v           v           v
+----------+ +----------+ +----------+ +----------+ +----------+
|scroll_   | |click     | |go_to_url | |record_   | |done      |
|page      | |          | |          | |insight   | |          |
+----------+ +----------+ +----------+ +----------+ +----------+
```

## Configuration Hierarchy (Updated for Phase 19)

```
+---------------------------------------------------------------------------------+
|                          CONFIGURATION HIERARCHY                                 |
+---------------------------------------------------------------------------------+
|                                                                                  |
|   LAYER 1: DEFAULTS (Hardcoded in code)                                          |
|   +---------------------------------------------------------------------+        |
|   | CROAgentOptions:                                                    |        |
|   |   headless=false, timeout=60000, maxSteps=10                        |        |
|   |   outputFormats=['console'], outputDir='./output'                   |        |
|   |   model='gpt-4o', temperature=0.3                                   |        |
|   |   scanMode='full_page', minCoveragePercent=100                      |        |
|   +---------------------------------------------------------------------+        |
|                                      |                                           |
|                                      v                                           |
|   LAYER 2: CONSTRUCTOR (Code-level override)                                     |
|   +---------------------------------------------------------------------+        |
|   | new CROAgent({                                                      |        |
|   |   url: 'https://example.com',                                       |        |
|   |   headless: true,                                                   |        |
|   |   maxSteps: 15,                                                     |        |
|   |   scanMode: 'above_fold',                                           |        |
|   |   outputFormats: ['markdown', 'json']                               |        |
|   | })                                                                  |        |
|   +---------------------------------------------------------------------+        |
|                                      |                                           |
|                                      v                                           |
|   LAYER 3: CLI ARGUMENTS (Runtime override - Highest Priority)                   |
|   +---------------------------------------------------------------------+        |
|   | --headless --verbose --output markdown,json                         |        |
|   | --max-steps 20 --timeout 90000 --output-dir ./reports               |        |
|   | --scan-mode full_page --min-coverage 100                            |        |
|   +---------------------------------------------------------------------+        |
|                                      |                                           |
|                                      v                                           |
|   LAYER 4: ENVIRONMENT (.env file)                                               |
|   +---------------------------------------------------------------------+        |
|   | OPENAI_API_KEY=sk-...  (Required, no default)                       |        |
|   +---------------------------------------------------------------------+        |
|                                      |                                           |
|                                      v                                           |
|   +---------------------------------------------------------------------+        |
|   |                      FINAL MERGED CONFIG                            |        |
|   +---------------------------------------------------------------------+        |
|                                                                                  |
+---------------------------------------------------------------------------------+
```

## Type System Overview (Updated)

```
+---------------------------------------------------------------------------------+
|                              TYPE DEFINITIONS                                    |
+---------------------------------------------------------------------------------+
|                                                                                  |
|   CORE DATA TYPES                        RESULT TYPES                            |
|   +-------------------+                  +------------------------+              |
|   | DOMNode           |                  | CROAgentOutput         |              |
|   | - tagName: string |                  | - insights: []         |              |
|   | - text: string    |                  | - hypotheses: []       |              |
|   | - attributes: {}  |                  | - stepsExecuted: num   |              |
|   | - xpath: string   |                  | - actionHistory: []    |              |
|   | - isVisible: bool |                  +------------------------+              |
|   | - croClass: CROClass                                                         |
|   | - pageY: number   | <-- Phase 19     +------------------------+              |
|   +-------------------+                  | CROAnalysisResult      |              |
|                                          | - url: string          |              |
|   +-------------------+                  | - businessType: result |              |
|   | DOMTree           |                  | - insights: []         |              |
|   | - url: string     |                  | - heuristicInsights: []|              |
|   | - title: string   |                  | - hypotheses: []       |              |
|   | - nodes: []       |                  | - scores: CROScores    |              |
|   | - metadata: {}    |                  | - stepsExecuted: num   |              |
|   | - statistics: {}  |                  | - terminationReason    |              |
|   +-------------------+                  | - coveragePercent      | <-- Phase 19 |
|                                          +------------------------+              |
|   COVERAGE TYPES (Phase 19)                                                      |
|   +-------------------+                  CONFIG TYPES                            |
|   | PageSegment       |                  +------------------------+              |
|   | - index: number   |                  | CROAgentOptions        |              |
|   | - startY: number  |                  | - url: string          |              |
|   | - endY: number    |                  | - headless?: bool      |              |
|   | - scanned: bool   |                  | - timeout?: number     |              |
|   +-------------------+                  | - maxSteps?: number    |              |
|                                          | - verbose?: bool       |              |
|   +-------------------+                  | - scanMode?: ScanMode  | <-- Phase 19 |
|   | CoverageState     |                  | - minCoverage?: number | <-- Phase 19 |
|   | - segments: []    |                  | - outputFormats?: []   |              |
|   | - percent: number |                  | - outputDir?: string   |              |
|   | - isComplete: bool|                  | - model?: string       |              |
|   +-------------------+                  | - temperature?: number |              |
|                                          +------------------------+              |
|   INSIGHT TYPES                                                                  |
|   +-------------------+                  +------------------------+              |
|   | CROInsight        |                  | HeuristicRule          |              |
|   | - id: string      |                  | - id: string           |              |
|   | - type: string    |                  | - name: string         |              |
|   | - severity: Sev   |                  | - evaluate: function   |              |
|   | - category: Cat   |                  | - category: CROClass   |              |
|   | - issue: string   |                  +------------------------+              |
|   | - recommendation  |                                                          |
|   | - evidence: []    |                  +------------------------+              |
|   +-------------------+                  | ToolDefinition         |              |
|                                          | - name: string         |              |
|   +-------------------+                  | - description: string  |              |
|   | Hypothesis        |                  | - parameters: ZodSchema|              |
|   | - id: string      |                  +------------------------+              |
|   | - title: string   |                                                          |
|   | - description: str|                  +------------------------+              |
|   | - expectedImpact  |                  | CROScores              |              |
|   | - relatedInsights |                  | - overall: number      |              |
|   +-------------------+                  | - breakdown: {}        |              |
|                                          | - grade: A-F           |              |
|   ENUMS/UNIONS                           +------------------------+              |
|   +-------------------+                                                          |
|   | CROClassification |                  +------------------------+              |
|   | 'cta' | 'form' |  |                  | ScanMode (Phase 19)    |              |
|   | 'trust' | 'value_ |                  | 'full_page'            |              |
|   | prop' | 'navigation                  | 'above_fold'           |              |
|   | 'custom'          |                  | 'llm_guided'           |              |
|   +-------------------+                  +------------------------+              |
|                                                                                  |
|   +-------------------+                                                          |
|   | Severity          |                                                          |
|   | 'critical' | 'high'                                                          |
|   | 'medium' | 'low'  |                                                          |
|   +-------------------+                                                          |
|                                                                                  |
|   +-------------------+                                                          |
|   | BusinessType      |                                                          |
|   | 'ecommerce'|'saas'|                                                          |
|   | 'banking' |'insur |                                                          |
|   | 'travel'|'media'  |                                                          |
|   | 'other'           |                                                          |
|   +-------------------+                                                          |
|                                                                                  |
+---------------------------------------------------------------------------------+
```

## File Structure Map (Updated)

```
browser-agent/
|
+-- src/
|   |
|   +-- index.ts .................. Main entry point, exports
|   +-- cli.ts .................... Command-line interface
|   |
|   +-- agent/ .................... Agent core module
|   |   +-- index.ts .............. Module exports
|   |   +-- cro-agent.ts .......... Main CROAgent orchestrator
|   |   +-- prompt-builder.ts ..... System/user prompt construction
|   |   +-- message-manager.ts .... Conversation history management
|   |   +-- state-manager.ts ...... PageState management (+ coverage)
|   |   +-- coverage-tracker.ts ... 100% page coverage tracking (Phase 19)
|   |   +-- score-calculator.ts ... CRO score computation
|   |   +-- tools/
|   |       +-- tool-registry.ts .. Tool definitions registration
|   |       +-- tool-executor.ts .. Tool execution logic
|   |       +-- create-cro-registry.ts
|   |       +-- cro/ .............. 11 CRO tools
|   |
|   +-- browser/ .................. Browser automation module
|   |   +-- index.ts .............. Module exports
|   |   +-- browser-manager.ts .... Playwright lifecycle
|   |   +-- page-loader.ts ........ URL navigation
|   |   +-- cookie-handler.ts ..... Cookie consent dismissal
|   |   +-- dom/
|   |       +-- extractor.ts ...... DOM element extraction
|   |       +-- serializer.ts ..... DOM to string for LLM
|   |       +-- build-dom-tree.ts . DOM tree construction (+ absolute coords)
|   |       +-- dom-merger.ts ..... Multi-segment DOM merging (Phase 19)
|   |
|   +-- heuristics/ ............... Heuristic analysis module
|   |   +-- index.ts .............. Module exports & HeuristicEngine
|   |   +-- heuristic-engine.ts ... Rule engine
|   |   +-- business-type-detector.ts Business type detection
|   |   +-- severity-scorer.ts .... Severity scoring
|   |   +-- rules/ ................ Individual heuristic rules
|   |       +-- h001-missing-cta.ts
|   |       +-- h002-cta-below-fold.ts
|   |       +-- h003-low-contrast-cta.ts
|   |       +-- h004-generic-cta-text.ts
|   |       +-- h005-form-too-long.ts
|   |       +-- h006-missing-trust-signals.ts
|   |       +-- h007-unclear-value-prop.ts
|   |       +-- h008-poor-navigation.ts
|   |       +-- h009-missing-social-proof.ts
|   |       +-- h010-mobile-friction.ts
|   |
|   +-- models/ ................... Zod schemas
|   |   +-- index.ts .............. Module exports
|   |   +-- coverage.ts ........... Coverage models (Phase 19)
|   |
|   +-- output/ ................... Output generation module
|   |   +-- index.ts .............. Module exports
|   |   +-- console-formatter.ts .. Console output formatting
|   |   +-- markdown-reporter.ts .. Markdown report generation
|   |   +-- json-exporter.ts ...... JSON export functionality
|   |   +-- file-writer.ts ........ File writing utilities
|   |   +-- hypothesis-generator.ts Hypothesis generation
|   |   +-- insight-deduplicator.ts Duplicate insight removal
|   |   +-- insight-prioritizer.ts  Insight prioritization
|   |
|   +-- prompts/ .................. LLM prompts
|   |   +-- system-cro.md ......... System prompt template (+ coverage rules)
|   |
|   +-- types/ .................... TypeScript type definitions
|   |   +-- index.ts .............. All interfaces & types
|   |
|   +-- utils/ .................... Utility functions
|       +-- index.ts .............. Module exports
|       +-- logger.ts ............. Structured logging
|       +-- validator.ts .......... URL & environment validation
|
+-- tests/ ........................ Test suites (476 tests)
|   +-- unit/ ..................... Unit tests (389)
|   |   +-- coverage-tracker.test.ts (16 tests) - Phase 19
|   |   +-- dom-merger.test.ts (7 tests) - Phase 19
|   |   +-- heuristic-engine.test.ts
|   |   +-- heuristic-rules.test.ts
|   |   +-- output-generation.test.ts
|   +-- integration/ .............. Integration tests (83)
|   |   +-- coverage-enforcement.test.ts (11 tests) - Phase 19
|   |   +-- post-processing.test.ts
|   +-- e2e/ ...................... End-to-end tests (4)
|   |   +-- coverage-workflow.test.ts (4 tests) - Phase 19
|   |   +-- cro-full-workflow.test.ts
|   +-- fixtures/ ................. Test fixtures
|
+-- specs/ ........................ Specification documents
|   +-- 001-browser-agent-core/
|       +-- spec/ ................. Requirements
|       +-- plan/ ................. Implementation plan
|       +-- tasks/ ................ Task definitions
|       +-- quickstart.md ......... Entry point
|       +-- PROJECT-CONTEXT-PROMPT.md LLM context prompt
|
+-- design/ ....................... Architecture diagrams
|   +-- APPLICATION_FLOW.md ....... This file
|   +-- architecture-overview.svg . High-level architecture
|   +-- component-details.svg ..... Component internals
|   +-- configuration-types.svg ... Type definitions
|   +-- data-flow-pipeline.svg .... Data flow stages
|   +-- sequence-diagram.svg ...... Request sequence
|
+-- output/ ....................... Generated analysis reports
+-- dist/ ......................... Compiled JavaScript output
+-- package.json .................. Dependencies & scripts
+-- tsconfig.json ................. TypeScript configuration
+-- vitest.config.ts .............. Test configuration
+-- .env .......................... Environment variables (secrets)
```

## Quick Reference: CLI Commands (Updated for Phase 19)

```
+---------------------------------------------------------------------------------+
|                               CLI USAGE                                          |
+---------------------------------------------------------------------------------+
|                                                                                  |
|  Basic Analysis (default: full_page mode):                                       |
|  $ npm run start -- https://example.com                                          |
|                                                                                  |
|  Scan Modes (Phase 19):                                                          |
|  $ npm run start -- --scan-mode=full_page https://example.com    # 100% coverage |
|  $ npm run start -- --scan-mode=above_fold https://example.com   # First viewport|
|  $ npm run start -- --scan-mode=llm_guided https://example.com   # LLM decides   |
|                                                                                  |
|  Coverage Threshold:                                                             |
|  $ npm run start -- --scan-mode=full_page --min-coverage 80 https://example.com  |
|                                                                                  |
|  With Output Formats:                                                            |
|  $ npm run start -- --output-format markdown https://example.com                 |
|  $ npm run start -- --output-format json https://example.com                     |
|  $ npm run start -- --output-format markdown --output-file report.md https://... |
|                                                                                  |
|  With Options:                                                                   |
|  $ npm run start -- --headless https://example.com                               |
|  $ npm run start -- --verbose https://example.com                                |
|  $ npm run start -- --timeout 90000 https://example.com                          |
|  $ npm run start -- --max-steps 15 https://example.com                           |
|                                                                                  |
|  Combined:                                                                       |
|  $ npm run start -- --headless --verbose --scan-mode=full_page https://site.com  |
|                                                                                  |
|  Help:                                                                           |
|  $ npm run start -- --help                                                       |
|                                                                                  |
+---------------------------------------------------------------------------------+
|  OPTIONS:                                                                        |
|  --headless              Run browser in headless mode (default: visible)         |
|  --verbose, -v           Enable verbose/debug logging                            |
|  --timeout <ms>          Page load timeout in ms (default: 60000)                |
|  --max-steps <n>         Maximum agent loop iterations (default: 10)             |
|  --scan-mode <mode>      full_page | above_fold | llm_guided (default: full_page)|
|  --min-coverage <n>      Minimum coverage % required (default: 100, full_page)   |
|  --output-format <fmt>   Output format: console | markdown | json                |
|  --output-file <path>    Output file path for markdown/json                      |
|  --no-cookie-dismiss     Disable automatic cookie consent dismissal              |
|  --help, -h              Show help information                                   |
+---------------------------------------------------------------------------------+
```

## Phase Summary

```
+---------------------------------------------------------------------------------+
|                              PHASE SUMMARY                                       |
+---------------------------------------------------------------------------------+
|                                                                                  |
|  COMPLETED PHASES (1-19, 21a-d, CR-001)                                          |
|  +---------------------------------------------------------------------+         |
|  | Phase 1-12  | Foundation: Browser, extraction, LangChain, cookies   |         |
|  | Phase 13-15 | CRO models, DOM extraction, tool system               |         |
|  | Phase 16    | Agent core (observe -> reason -> act loop)            |         |
|  | Phase 17    | 11 CRO tools (analysis, navigation, control)          |         |
|  | Phase 18    | Heuristics (10 rules), business type, hypotheses      |         |
|  | Phase 19    | 100% page coverage system                             |         |
|  | Phase 21a-d | Vision core: PageType, knowledge base, analyzer       |         |
|  | CR-001      | Unified agent: merge Vision into CRO Agent            |         |
|  +---------------------------------------------------------------------+         |
|                                                                                  |
|  REMOVED/MERGED (CR-001)                                                         |
|  +---------------------------------------------------------------------+         |
|  | Phase 21e   | Multi-Viewport Vision - REMOVED                       |         |
|  | Phase 21f   | Full-Page Screenshot - REMOVED                        |         |
|  | Phase 21g   | Vision Agent Loop - MERGED into CRO Agent             |         |
|  +---------------------------------------------------------------------+         |
|                                                                                  |
|  PENDING PHASES                                                                  |
|  +---------------------------------------------------------------------+         |
|  | Phase 21h   | Evidence Capture (14 tasks)                           |         |
|  | Phase 21i   | DOM-Screenshot Mapping (17 tasks)                     |         |
|  | Phase 22    | Page Type Knowledge Bases (PLP, Homepage, etc.)       |         |
|  +---------------------------------------------------------------------+         |
|                                                                                  |
|  DEFERRED                                                                        |
|  +---------------------------------------------------------------------+         |
|  | Phase 20    | Hybrid Extraction Pipeline (60 tasks) - backlog       |         |
|  +---------------------------------------------------------------------+         |
|                                                                                  |
|  STATISTICS                                                                      |
|  +---------------------------------------------------------------------+         |
|  | Total Tasks    | 394 complete, ~69 pending                          |         |
|  | Total Tests    | 771+ passing                                        |         |
|  | Modules        | 15+ (browser, dom, agent, vision, heuristics, etc.) |         |
|  | Tools          | Collection tools + Analysis orchestration           |         |
|  | Heuristics     | 35 PDP rules + 10 DOM rules                         |         |
|  +---------------------------------------------------------------------+         |
|                                                                                  |
+---------------------------------------------------------------------------------+
```

## Technology Stack

```
+---------------------------------------------------------------------------------+
|                             TECHNOLOGY STACK                                     |
+---------------------------------------------------------------------------------+
|                                                                                  |
|   Runtime              | Node.js 20+                                             |
|   Language             | TypeScript 5.x                                          |
|   Browser Automation   | Playwright (Chromium)                                   |
|   AI/LLM               | OpenAI GPT-4o via LangChain                             |
|   Schema Validation    | Zod                                                     |
|   Testing              | Vitest                                                  |
|   CLI Framework        | Commander.js                                            |
|   Build Tool           | TypeScript Compiler (tsc)                               |
|                                                                                  |
+---------------------------------------------------------------------------------+
```
