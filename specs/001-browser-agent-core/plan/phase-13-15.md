**Navigation**: [Index](./index.md) | [Previous](./dependencies.md) | [Next](./phase-16.md)

## CRO Agent Architecture (Phases 13-18)

### Summary

Evolve Browser Agent from single-pass heading extractor to autonomous CRO analysis agent with iterative analysis loop, tool registry, and hypothesis generation. Based on Browser Use (Python) patterns adapted to Node.js/TypeScript/Playwright.

### New Modules

#### 6. Agent Module (`src/agent/`)

**Responsibility**: Core agent loop, state management, LLM interaction

**Components**:
- `CROAgent`: Main agent with step loop (observe→reason→act)
- `MessageBuilder`: Assembles LLM context from page state and memory
- `OutputParser`: Validates LLM response against Zod schema
- `State`: Agent state management (step count, failures, insights)
- `Memory`: Analysis context (step history, findings)

**Key Interfaces**:
```typescript
interface CROAgentOptions {
  maxSteps: number;           // 10 per CR-010
  actionWaitMs: number;       // 500ms per CR-011
  llmTimeoutMs: number;       // 60000ms per CR-012
  failureLimit: number;       // 3 per CR-014
}

interface AgentState {
  step: number;
  consecutiveFailures: number;
  insights: CROInsight[];
  memory: CROMemory;
  isDone: boolean;
}

interface CROMemory {
  stepHistory: StepRecord[];
  findings: CROInsight[];
  pagesSeen: string[];
  currentFocus: string;
}
```

#### 7. DOM Module (`src/browser/dom/`)

**Responsibility**: DOM extraction, visibility detection, CRO classification

**Components**:
- `DOMExtractor`: Orchestrates DOM extraction via injected script
- `buildCroDomTree.js`: Injected script for DOM traversal and classification
- `Visibility`: Element visibility detection (CSS + viewport + clip)
- `Interactive`: Interactive element detection (tag + ARIA + handlers)
- `Serializer`: DOM to indexed text format for LLM

**Key Interfaces**:
```typescript
interface DOMTree {
  root: DOMNode;
  interactiveCount: number;
  croElementCount: number;
}

interface DOMNode {
  tagName: string;
  xpath: string;
  index?: number;           // Only for visible CRO elements
  text: string;             // Truncated to 100 chars per CR-015
  isInteractive: boolean;
  isVisible: boolean;
  croType: 'cta' | 'form' | 'trust' | 'value_prop' | 'navigation' | null;
  boundingBox?: { x: number; y: number; width: number; height: number };
  children: DOMNode[];
}

interface CROClassification {
  type: 'cta' | 'form' | 'trust' | 'value_prop' | 'navigation';
  confidence: number;
  matchedSelector: string;
}
```

#### 8. Tools Module (`src/agent/tools/`)

**Responsibility**: Tool registration, validation, execution, and CRO-specific analysis

**Design Decision**: Interface-based tools (not abstract class) for simplicity. ToolExecutor owns validation, timing, and error handling. This avoids the complexity of class inheritance while maintaining testability.

**Components**:
- `types.ts`: Tool, ToolContext, ToolDefinitionForLLM interfaces
- `tool-registry.ts`: ToolRegistry class for tool storage and retrieval
- `tool-executor.ts`: ToolExecutor class for validation and execution
- `index.ts`: Module exports

**Directory Structure**:
```
src/agent/tools/
├── index.ts              # Module exports
├── types.ts              # Tool, ToolContext, ToolDefinitionForLLM
├── tool-registry.ts      # ToolRegistry class
└── tool-executor.ts      # ToolExecutor class
```

**Key Interfaces** (src/agent/tools/types.ts):
```typescript
import type { Page } from 'playwright';
import type { ZodSchema } from 'zod';
import type { PageState, CROInsight, CROActionName } from '../../models/index.js';
import type { Logger } from '../../utils/index.js';

/**
 * Context injected into tool execution
 */
export interface ToolContext {
  params: unknown;          // Raw params (validated by executor)
  page: Page;               // Playwright page instance
  state: PageState;         // Current page state with DOM tree
  logger: Logger;           // Scoped logger for tool
}

/**
 * Tool execution result (re-exported from models for convenience)
 */
export { ToolResult } from '../../models/index.js';

/**
 * Tool interface - all CRO tools implement this
 * Design: Interface-based, not abstract class, for simplicity
 */
export interface Tool {
  /** Tool name matching CROActionName */
  readonly name: CROActionName;

  /** Human-readable description for LLM context */
  readonly description: string;

  /** Zod schema for params validation */
  readonly parameters: ZodSchema;

  /**
   * Execute the tool
   * @param context - Injected context with validated params
   * @returns ToolResult with success, insights, optional extracted data
   */
  execute(context: ToolContext): Promise<ToolResult>;
}

/**
 * LLM-friendly tool definition (no execute function)
 * Used by ToolRegistry.getToolDefinitions() for system prompt
 */
export interface ToolDefinitionForLLM {
  name: CROActionName;
  description: string;
  parameters: Record<string, unknown>;  // JSON Schema from Zod
}
```

**ToolRegistry** (src/agent/tools/tool-registry.ts):
```typescript
import type { Tool, ToolDefinitionForLLM } from './types.js';
import type { CROActionName } from '../../models/index.js';
import { createLogger } from '../../utils/index.js';
import { zodToJsonSchema } from 'zod-to-json-schema';  // Optional, for LLM

export class ToolRegistry {
  private tools: Map<CROActionName, Tool> = new Map();
  private logger = createLogger('ToolRegistry');

  /**
   * Register a tool. Throws if duplicate name.
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
    this.logger.debug(`Registered tool: ${tool.name}`);
  }

  /**
   * Get tool by name. Returns undefined if not found.
   */
  get(name: CROActionName): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if tool exists
   */
  has(name: CROActionName): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool definitions for LLM system prompt
   * Returns name + description only (no execute function)
   */
  getToolDefinitions(): ToolDefinitionForLLM[] {
    return this.getAll().map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: this.schemaToJson(tool.parameters),
    }));
  }

  /**
   * Convert Zod schema to JSON Schema for LLM
   */
  private schemaToJson(schema: ZodSchema): Record<string, unknown> {
    try {
      return zodToJsonSchema(schema) as Record<string, unknown>;
    } catch {
      return { type: 'object' };  // Fallback
    }
  }

  /**
   * Clear all tools (for testing)
   */
  clear(): void {
    this.tools.clear();
  }
}
```

**ToolExecutor** (src/agent/tools/tool-executor.ts):
```typescript
import type { Tool, ToolContext } from './types.js';
import type { ToolResult, CROActionName, PageState } from '../../models/index.js';
import type { Page } from 'playwright';
import type { ToolRegistry } from './tool-registry.js';
import { createLogger, Logger } from '../../utils/index.js';

export interface ExecutionContext {
  page: Page;
  state: PageState;
}

export class ToolExecutor {
  private logger = createLogger('ToolExecutor');

  constructor(private registry: ToolRegistry) {}

  /**
   * Execute a tool by name with params
   *
   * Flow:
   * 1. Look up tool in registry
   * 2. Validate params against tool.parameters schema
   * 3. Execute tool with injected context
   * 4. Track execution time
   * 5. Handle errors gracefully
   *
   * @returns ToolResult - always returns, never throws
   */
  async execute(
    name: CROActionName,
    params: unknown,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const start = Date.now();
    const toolLogger = createLogger(`Tool:${name}`);

    // Step 1: Look up tool
    const tool = this.registry.get(name);
    if (!tool) {
      this.logger.warn(`Unknown tool: ${name}`);
      return {
        success: false,
        insights: [],
        error: `Unknown tool: ${name}`,
        executionTimeMs: Date.now() - start,
      };
    }

    // Step 2: Validate params
    const validation = tool.parameters.safeParse(params);
    if (!validation.success) {
      const errorMsg = this.formatZodError(validation.error);
      this.logger.warn(`Validation failed for ${name}: ${errorMsg}`);
      return {
        success: false,
        insights: [],
        error: `Invalid params for ${name}: ${errorMsg}`,
        executionTimeMs: Date.now() - start,
      };
    }

    // Step 3: Execute with injected context
    this.logger.info(`Executing tool: ${name}`, { params: validation.data });

    try {
      const toolContext: ToolContext = {
        params: validation.data,
        page: context.page,
        state: context.state,
        logger: toolLogger,
      };

      const result = await tool.execute(toolContext);
      result.executionTimeMs = Date.now() - start;

      this.logger.info(`Tool completed: ${name}`, {
        success: result.success,
        insightCount: result.insights.length,
        durationMs: result.executionTimeMs,
      });

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Tool execution failed: ${name}`, { error: errorMsg });

      return {
        success: false,
        insights: [],
        error: `Tool execution failed: ${errorMsg}`,
        executionTimeMs: Date.now() - start,
      };
    }
  }

  /**
   * Format Zod error for user-friendly message
   */
  private formatZodError(error: z.ZodError): string {
    return error.errors
      .map(e => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
  }
}
```

**Module Exports** (src/agent/tools/index.ts):
```typescript
export type { Tool, ToolContext, ToolDefinitionForLLM } from './types.js';
export { ToolRegistry } from './tool-registry.ts';
export { ToolExecutor, type ExecutionContext } from './tool-executor.js';
```

**CRO Tool Implementation Pattern** (for Phase 17):
```typescript
// Example: src/agent/tools/cro/analyze-cta-tool.ts
import { z } from 'zod';
import type { Tool, ToolContext, ToolResult } from '../types.js';

const AnalyzeCTAParams = z.object({
  focusIndex: z.number().optional().describe('Specific element index to analyze'),
  includeSecondary: z.boolean().default(true).describe('Include secondary CTAs'),
});

export const analyzeCTATool: Tool = {
  name: 'analyze_ctas',
  description: 'Analyze call-to-action buttons for text clarity, placement, prominence, and conversion potential',
  parameters: AnalyzeCTAParams,

  async execute(context: ToolContext): Promise<ToolResult> {
    const { params, state, logger } = context;
    const typedParams = params as z.infer<typeof AnalyzeCTAParams>;

    logger.debug('Analyzing CTAs', typedParams);

    // Implementation here...
    const insights = [];

    return {
      success: true,
      insights,
      extracted: { ctaCount: 0 },  // Raw data for debugging
    };
  },
};
```

**ToolResult** (already in models, enhanced):
```typescript
interface ToolResult {
  success: boolean;
  insights: CROInsight[];
  extracted?: unknown;        // Raw data for debugging
  error?: string;             // Error message if !success
  executionTimeMs?: number;   // Set by ToolExecutor
}

interface CROInsight {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  element: string;            // XPath
  issue: string;
  recommendation: string;
  evidence?: {
    text?: string;
    screenshot?: string;
    styles?: Record<string, string>;
  };
}
```

#### 9. Analysis Module (`src/analysis/`)

**Responsibility**: Heuristics, business type detection, severity scoring

**Components**:
- `HeuristicEngine`: 10 initial rule-based checks
- `BusinessTypeDetector`: Detect ecommerce/saas/banking/etc.
- `SeverityScorer`: Weight insights by business type

**Key Interfaces**:
```typescript
interface HeuristicRule {
  id: string;
  name: string;
  check: (state: PageState) => CROInsight | null;
  businessTypes?: BusinessType[];  // Apply only to these types
}

type BusinessType = 'ecommerce' | 'saas' | 'banking' | 'insurance' | 'travel' | 'media' | 'other';

interface ScoreResult {
  overall: number;
  byCategory: Record<string, number>;
  criticalCount: number;
  highCount: number;
}
```

#### 10. Models Module (`src/models/`)

**Responsibility**: TypeScript interfaces and Zod schemas

**Components**:
- `PageState`: Current page state for LLM context
- `DOMTree`: DOM tree structure
- `CROInsight`: Individual finding
- `AgentOutput`: Zod schema for LLM response
- `Hypothesis`: A/B test specification

**Key Zod Schema**:
```typescript
const CROAgentOutputSchema = z.object({
  thinking: z.string().describe('Analysis reasoning'),
  evaluation_previous_goal: z.string().describe('Assessment of last action'),
  memory: z.string().describe('Key findings to remember'),
  next_goal: z.string().describe('Next analysis focus'),
  action: z.object({
    name: z.enum(['analyze_ctas', 'analyze_forms', 'detect_trust_signals',
                  'assess_value_prop', 'check_navigation', 'find_friction',
                  'scroll_page', 'done']),
    params: z.record(z.any()).optional()
  })
});
```

#### 11. Output Module (Extended - `src/output/`)

**Responsibility**: Hypothesis generation, report formatting

**New Components**:
- `HypothesisGenerator`: Transform insights to A/B test specs
- `MarkdownReporter`: Generate structured reports
- `JSONExporter`: Export full analysis as JSON

**Key Interfaces**:
```typescript
interface Hypothesis {
  id: string;
  title: string;
  hypothesis: string;         // "If X then Y because Z"
  controlDescription: string;
  treatmentDescription: string;
  primaryMetric: string;
  expectedImpact: 'low' | 'medium' | 'high';
  priority: number;
  relatedInsights: string[];  // CROInsight IDs
}

interface CROReport {
  url: string;
  businessType: BusinessType;
  executiveSummary: string;
  criticalIssues: CROInsight[];
  highPriorityIssues: CROInsight[];
  mediumPriorityIssues: CROInsight[];
  lowPriorityIssues: CROInsight[];
  recommendedTests: Hypothesis[];
  analysisSteps: number;
  timestamp: string;
}
```

#### 12. Prompts Module (`src/prompts/`)

**Responsibility**: System prompts for CRO analysis

**Files**:
- `system-cro.md`: Main CRO agent system prompt

**Prompt Structure**:
```markdown
<identity>
You are a CRO (Conversion Rate Optimization) expert analyst.
</identity>

<expertise>
- UX friction detection
- CTA optimization
- Form analysis
- Trust signal assessment
- Value proposition clarity
- Navigation usability
</expertise>

<input_format>
- page_url: Current page URL
- page_title: Page title
- cro_elements: Indexed list of CRO-relevant elements
- memory: Previous findings and analysis context
</input_format>

<output_format>
JSON matching CROAgentOutputSchema
</output_format>

<available_tools>
[List of tools with descriptions]
</available_tools>

<completion_criteria>
Call done when:
- All CRO aspects analyzed (CTAs, forms, trust, value prop, navigation)
- No new elements after scrolling
- Critical friction points identified

Do NOT call done if:
- Only analyzed above-the-fold
- Haven't checked forms (if present)
</completion_criteria>
```
