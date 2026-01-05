/**
 * Unit tests for CRO Agent models (Phase 13b).
 */

import { describe, it, expect } from 'vitest';
import {
  CROAgentOutputSchema,
  parseAgentOutput,
  createInitialMemory,
  createInitialState,
  DEFAULT_CRO_OPTIONS,
  type CROMemory,
  type AgentState,
  type CROAgentOptions,
  type StepRecord,
  type CROAgentOutput,
} from '../../src/models/index.js';

describe('CROAgentOutputSchema', () => {
  describe('valid outputs', () => {
    it('should accept a valid agent output with all required fields', () => {
      const output = {
        thinking: 'Analyzing the page for CTA elements to identify conversion optimization opportunities.',
        evaluation_previous_goal: 'Successfully loaded the page and extracted DOM elements.',
        memory: 'Found 3 CTAs: primary button in hero, secondary in nav, footer signup.',
        next_goal: 'Analyze CTA text clarity and placement above the fold.',
        action: {
          name: 'analyze_ctas',
        },
      };

      const result = CROAgentOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('should accept output with action params', () => {
      const output = {
        thinking: 'Need to scroll down to see more content below the fold.',
        evaluation_previous_goal: 'Completed CTA analysis, found issues with vague button text.',
        memory: 'Primary CTA says "Click Here" - needs more specific action text.',
        next_goal: 'Check for additional CTAs below the fold.',
        action: {
          name: 'scroll_page',
          params: { direction: 'down', amount: 'page' },
        },
      };

      const result = CROAgentOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('should accept done action with reason', () => {
      const output = {
        thinking: 'Completed full page analysis. Found 5 critical issues to address.',
        evaluation_previous_goal: 'Successfully analyzed all CRO elements on the page.',
        memory: 'Critical: vague CTAs, missing trust signals, form with 8 fields.',
        next_goal: 'Analysis complete, generating final report.',
        action: {
          name: 'done',
          params: { reason: 'Completed comprehensive CRO analysis' },
        },
      };

      const result = CROAgentOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('should accept all valid action names', () => {
      const actionNames = [
        'analyze_ctas',
        'analyze_forms',
        'detect_trust_signals',
        'assess_value_prop',
        'check_navigation',
        'find_friction',
        'scroll_page',
        'go_to_url',
        'done',
      ] as const;

      for (const name of actionNames) {
        const output = {
          thinking: `Testing ${name} action`,
          evaluation_previous_goal: 'Previous step completed',
          memory: 'Test memory content',
          next_goal: `Execute ${name}`,
          action: { name },
        };

        const result = CROAgentOutputSchema.safeParse(output);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('invalid outputs', () => {
    it('should reject output with invalid action name', () => {
      const output = {
        thinking: 'Testing invalid action',
        evaluation_previous_goal: 'Previous step completed',
        memory: 'Test memory',
        next_goal: 'Execute invalid action',
        action: {
          name: 'invalid_action',
        },
      };

      const result = CROAgentOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should reject output with missing thinking field', () => {
      const output = {
        evaluation_previous_goal: 'Previous step completed',
        memory: 'Test memory',
        next_goal: 'Next goal',
        action: { name: 'analyze_ctas' },
      };

      const result = CROAgentOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should reject output with missing action field', () => {
      const output = {
        thinking: 'Test thinking',
        evaluation_previous_goal: 'Previous step completed',
        memory: 'Test memory',
        next_goal: 'Next goal',
      };

      const result = CROAgentOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should reject output with missing action name', () => {
      const output = {
        thinking: 'Test thinking',
        evaluation_previous_goal: 'Previous step completed',
        memory: 'Test memory',
        next_goal: 'Next goal',
        action: {
          params: { key: 'value' },
        },
      };

      const result = CROAgentOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });
  });
});

describe('parseAgentOutput', () => {
  describe('valid JSON parsing', () => {
    it('should parse valid JSON string', () => {
      const json = JSON.stringify({
        thinking: 'Analyzing page',
        evaluation_previous_goal: 'Success',
        memory: 'Found CTAs',
        next_goal: 'Analyze forms',
        action: { name: 'analyze_forms' },
      });

      const result = parseAgentOutput(json);
      expect(result.success).toBe(true);
      expect(result.output?.action.name).toBe('analyze_forms');
    });

    it('should extract JSON from markdown code block', () => {
      const response = `Here's my analysis:

\`\`\`json
{
  "thinking": "Analyzing page structure",
  "evaluation_previous_goal": "Loaded successfully",
  "memory": "Page has clear hero section",
  "next_goal": "Check CTAs",
  "action": { "name": "analyze_ctas" }
}
\`\`\`

This will help identify CTA issues.`;

      const result = parseAgentOutput(response);
      expect(result.success).toBe(true);
      expect(result.output?.action.name).toBe('analyze_ctas');
    });

    it('should extract JSON from code block without json label', () => {
      const response = `\`\`\`
{
  "thinking": "Testing",
  "evaluation_previous_goal": "Done",
  "memory": "Memory",
  "next_goal": "Goal",
  "action": { "name": "done" }
}
\`\`\``;

      const result = parseAgentOutput(response);
      expect(result.success).toBe(true);
      expect(result.output?.action.name).toBe('done');
    });
  });

  describe('invalid JSON handling', () => {
    it('should return error for invalid JSON', () => {
      const response = 'This is not valid JSON at all';

      const result = parseAgentOutput(response);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error for valid JSON with invalid schema', () => {
      const json = JSON.stringify({
        thinking: 'Test',
        action: { name: 'invalid_action_name' },
      });

      const result = parseAgentOutput(json);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error for empty string', () => {
      const result = parseAgentOutput('');
      expect(result.success).toBe(false);
    });

    it('should return error for empty code block', () => {
      const response = '```json\n```';
      const result = parseAgentOutput(response);
      expect(result.success).toBe(false);
    });
  });
});

describe('createInitialMemory', () => {
  it('should return empty collections', () => {
    const memory: CROMemory = createInitialMemory();

    expect(memory.stepHistory).toEqual([]);
    expect(memory.findings).toEqual([]);
    expect(memory.pagesSeen).toEqual([]);
    expect(memory.errors).toEqual([]);
  });

  it('should set initial focus to initial_scan', () => {
    const memory = createInitialMemory();
    expect(memory.currentFocus).toBe('initial_scan');
  });

  it('should return new object each time', () => {
    const memory1 = createInitialMemory();
    const memory2 = createInitialMemory();

    expect(memory1).not.toBe(memory2);
    memory1.stepHistory.push({} as StepRecord);
    expect(memory2.stepHistory.length).toBe(0);
  });
});

describe('createInitialState', () => {
  it('should return correct default values', () => {
    const state: AgentState = createInitialState();

    expect(state.step).toBe(0);
    expect(state.consecutiveFailures).toBe(0);
    expect(state.totalFailures).toBe(0);
    expect(state.insights).toEqual([]);
    expect(state.isDone).toBe(false);
    expect(state.doneReason).toBeUndefined();
    expect(state.lastActionTime).toBeUndefined();
  });

  it('should set startTime to current timestamp', () => {
    const before = Date.now();
    const state = createInitialState();
    const after = Date.now();

    expect(state.startTime).toBeGreaterThanOrEqual(before);
    expect(state.startTime).toBeLessThanOrEqual(after);
  });

  it('should include initialized memory', () => {
    const state = createInitialState();

    expect(state.memory).toBeDefined();
    expect(state.memory.stepHistory).toEqual([]);
    expect(state.memory.currentFocus).toBe('initial_scan');
  });

  it('should return new object each time', () => {
    const state1 = createInitialState();
    const state2 = createInitialState();

    expect(state1).not.toBe(state2);
    expect(state1.memory).not.toBe(state2.memory);
  });
});

describe('DEFAULT_CRO_OPTIONS', () => {
  it('should match CR-010: maxSteps = 10', () => {
    expect(DEFAULT_CRO_OPTIONS.maxSteps).toBe(10);
  });

  it('should match CR-011: actionWaitMs = 500', () => {
    expect(DEFAULT_CRO_OPTIONS.actionWaitMs).toBe(500);
  });

  it('should match CR-012: llmTimeoutMs = 60000', () => {
    expect(DEFAULT_CRO_OPTIONS.llmTimeoutMs).toBe(60000);
  });

  it('should match CR-013: tokenBudgetWarning = 0.6', () => {
    expect(DEFAULT_CRO_OPTIONS.tokenBudgetWarning).toBe(0.6);
  });

  it('should match CR-014: failureLimit = 3', () => {
    expect(DEFAULT_CRO_OPTIONS.failureLimit).toBe(3);
  });

  it('should match CR-015: textTruncateLength = 100', () => {
    expect(DEFAULT_CRO_OPTIONS.textTruncateLength).toBe(100);
  });

  it('should have all required option keys', () => {
    const options: CROAgentOptions = DEFAULT_CRO_OPTIONS;
    const keys = Object.keys(options);

    expect(keys).toContain('maxSteps');
    expect(keys).toContain('actionWaitMs');
    expect(keys).toContain('llmTimeoutMs');
    expect(keys).toContain('failureLimit');
    expect(keys).toContain('tokenBudgetWarning');
    expect(keys).toContain('textTruncateLength');
    expect(keys).toContain('scanMode'); // Phase 19e
    expect(keys.length).toBe(7);
  });

  it('should have scanMode = full_page as default (Phase 19e)', () => {
    expect(DEFAULT_CRO_OPTIONS.scanMode).toBe('full_page');
  });
});

describe('Type exports compile correctly', () => {
  it('should allow creating StepRecord objects', () => {
    const step: StepRecord = {
      step: 1,
      action: 'analyze_ctas',
      params: { target: 'hero' },
      result: {
        success: true,
        insights: [],
        executionTimeMs: 150,
      },
      thinking: 'Analyzing CTAs in hero section',
      timestamp: Date.now(),
    };

    expect(step.step).toBe(1);
    expect(step.action).toBe('analyze_ctas');
  });

  it('should allow creating CROMemory objects', () => {
    const memory: CROMemory = {
      stepHistory: [],
      findings: [],
      pagesSeen: ['https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy'],
      currentFocus: 'cta_analysis',
      errors: [],
    };

    expect(memory.pagesSeen).toContain('https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy');
  });

  it('should allow creating AgentState objects', () => {
    const state: AgentState = {
      step: 5,
      consecutiveFailures: 1,
      totalFailures: 2,
      insights: [],
      memory: createInitialMemory(),
      isDone: false,
      startTime: Date.now(),
      lastActionTime: Date.now(),
    };

    expect(state.step).toBe(5);
    expect(state.isDone).toBe(false);
  });

  it('should allow creating CROAgentOutput objects', () => {
    const output: CROAgentOutput = {
      thinking: 'Analysis reasoning',
      evaluation_previous_goal: 'Previous goal assessment',
      memory: 'Key findings',
      next_goal: 'Next analysis step',
      action: {
        name: 'analyze_ctas',
        params: { scope: 'above_fold' },
      },
    };

    expect(output.action.name).toBe('analyze_ctas');
  });
});
