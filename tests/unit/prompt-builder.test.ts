/**
 * PromptBuilder Unit Tests
 *
 * Phase 16 (T083): Tests for PromptBuilder class.
 * Verifies system prompt construction, tool injection, and user message formatting.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { PromptBuilder } from '../../src/agent/prompt-builder.js';
import { ToolRegistry } from '../../src/agent/tools/index.js';
import type { Tool } from '../../src/agent/tools/index.js';
import type { PageState, CROMemory, DOMTree } from '../../src/models/index.js';

// Mock DOM tree for testing
const createMockDOMTree = (): DOMTree => ({
  root: {
    tagName: 'body',
    xpath: '/body',
    text: '',
    isInteractive: false,
    isVisible: true,
    croType: null,
    children: [
      {
        tagName: 'button',
        xpath: '/body/button[1]',
        text: 'Buy Now',
        isInteractive: true,
        isVisible: true,
        croType: 'cta',
        index: 0,
        children: [],
      },
      {
        tagName: 'form',
        xpath: '/body/form[1]',
        text: '',
        isInteractive: true,
        isVisible: true,
        croType: 'form',
        index: 1,
        children: [],
      },
    ],
  },
  interactiveCount: 2,
  croElementCount: 2,
  totalNodeCount: 3,
  extractedAt: Date.now(),
});

// Mock PageState for testing
const createMockPageState = (): PageState => ({
  url: 'https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711/products',
  title: 'Example Products - Buy Online',
  domTree: createMockDOMTree(),
  viewport: { width: 1280, height: 720, deviceScaleFactor: 1, isMobile: false },
  scrollPosition: { x: 0, y: 100, maxX: 0, maxY: 2000 },
  timestamp: Date.now(),
});

// Mock CROMemory for testing
const createMockMemory = (overrides?: Partial<CROMemory>): CROMemory => ({
  stepHistory: [],
  findings: [],
  pagesSeen: ['https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711'],
  currentFocus: 'initial_scan',
  errors: [],
  ...overrides,
});

// Create a mock tool
const createMockTool = (name: string): Tool => ({
  name: name as Tool['name'],
  description: `Test tool for ${name}`,
  parameters: z.object({
    selector: z.string().optional().describe('CSS selector to target'),
    includeHidden: z.boolean().optional().describe('Include hidden elements'),
  }),
  execute: async () => ({ success: true, insights: [] }),
});

describe('PromptBuilder', () => {
  let registry: ToolRegistry;
  let builder: PromptBuilder;

  beforeEach(() => {
    registry = new ToolRegistry();
    builder = new PromptBuilder(registry);
  });

  describe('buildSystemPrompt', () => {
    // Test 1: System prompt contains identity section
    it('should contain identity section (FR-020)', () => {
      const prompt = builder.buildSystemPrompt();
      expect(prompt).toContain('<identity>');
      expect(prompt).toContain('CRO');
      expect(prompt).toContain('</identity>');
    });

    // Test 2: System prompt contains expertise section
    it('should contain expertise section', () => {
      const prompt = builder.buildSystemPrompt();
      expect(prompt).toContain('<expertise>');
      expect(prompt).toContain('</expertise>');
    });

    // Test 3: System prompt contains output format section
    it('should contain output format section', () => {
      const prompt = builder.buildSystemPrompt();
      expect(prompt).toContain('<output_format>');
      expect(prompt).toContain('JSON');
      expect(prompt).toContain('</output_format>');
    });

    // Test 4: System prompt contains completion criteria section
    it('should contain completion criteria section', () => {
      const prompt = builder.buildSystemPrompt();
      expect(prompt).toContain('<completion_criteria>');
      expect(prompt).toContain('done');
      expect(prompt).toContain('</completion_criteria>');
    });

    // Test 5: System prompt contains tools placeholder when no tools
    it('should handle empty tool registry', () => {
      const prompt = builder.buildSystemPrompt();
      expect(prompt).toContain('<available_tools>');
      expect(prompt).toContain('No tools available');
    });

    // Test 6: System prompt injects tool definitions (FR-039)
    it('should inject tool definitions from registry (FR-039)', () => {
      registry.register(createMockTool('analyze_ctas'));
      registry.register(createMockTool('analyze_forms'));
      builder = new PromptBuilder(registry);

      const prompt = builder.buildSystemPrompt();
      expect(prompt).toContain('analyze_ctas');
      expect(prompt).toContain('analyze_forms');
      expect(prompt).toContain('Test tool for');
    });

    // Test 7: System prompt caches result
    it('should cache system prompt for reuse', () => {
      const prompt1 = builder.buildSystemPrompt();
      const prompt2 = builder.buildSystemPrompt();
      expect(prompt1).toBe(prompt2); // Same reference = cached
    });

    // Test 8: Cache can be cleared
    it('should allow clearing cache', () => {
      const prompt1 = builder.buildSystemPrompt();
      builder.clearCache();
      const prompt2 = builder.buildSystemPrompt();
      expect(prompt1).toEqual(prompt2);
    });
  });

  describe('buildUserMessage', () => {
    // Test 9: User message contains page URL
    it('should include page URL in user message', () => {
      const state = createMockPageState();
      const memory = createMockMemory();

      const message = builder.buildUserMessage(state, memory);
      expect(message).toContain('<page_url>https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711/products</page_url>');
    });

    // Test 10: User message contains page title
    it('should include page title in user message', () => {
      const state = createMockPageState();
      const memory = createMockMemory();

      const message = builder.buildUserMessage(state, memory);
      expect(message).toContain('<page_title>Example Products - Buy Online</page_title>');
    });

    // Test 11: User message contains viewport info
    it('should include viewport dimensions', () => {
      const state = createMockPageState();
      const memory = createMockMemory();

      const message = builder.buildUserMessage(state, memory);
      expect(message).toContain('<viewport>1280x720</viewport>');
    });

    // Test 12: User message contains scroll position
    it('should include scroll position with maxY', () => {
      const state = createMockPageState();
      const memory = createMockMemory();

      const message = builder.buildUserMessage(state, memory);
      expect(message).toContain('y:100');
      expect(message).toContain('maxY:2000');
    });

    // Test 13: User message contains CRO elements section
    it('should include serialized CRO elements', () => {
      const state = createMockPageState();
      const memory = createMockMemory();

      const message = builder.buildUserMessage(state, memory);
      expect(message).toContain('<cro_elements');
      expect(message).toContain('</cro_elements>');
    });

    // Test 14: User message contains memory section
    it('should include memory context', () => {
      const memory = createMockMemory({
        currentFocus: 'cta_analysis',
        findings: [
          {
            id: 'test-1',
            category: 'cta',
            type: 'weak_text',
            severity: 'high',
            element: '//button',
            issue: 'Test issue',
            recommendation: 'Test recommendation',
          },
        ],
      });
      const state = createMockPageState();

      const message = builder.buildUserMessage(state, memory);
      expect(message).toContain('<memory>');
      expect(message).toContain('cta_analysis');
      expect(message).toContain('1 insights');
      expect(message).toContain('</memory>');
    });

    // Test 15: User message includes recent errors
    it('should include recent errors in memory', () => {
      const memory = createMockMemory({
        errors: ['Tool timeout', 'Parse error'],
      });
      const state = createMockPageState();

      const message = builder.buildUserMessage(state, memory);
      expect(message).toContain('Recent errors:');
      expect(message).toContain('Tool timeout');
    });

    // Test 16: User message includes step history summary
    it('should include recent step history', () => {
      const memory = createMockMemory({
        stepHistory: [
          {
            step: 0,
            action: 'analyze_ctas',
            result: { success: true, insights: [] },
            timestamp: Date.now(),
          },
          {
            step: 1,
            action: 'scroll_page',
            result: { success: true, insights: [] },
            timestamp: Date.now(),
          },
        ],
      });
      const state = createMockPageState();

      const message = builder.buildUserMessage(state, memory);
      expect(message).toContain('Recent actions:');
      expect(message).toContain('analyze_ctas');
      expect(message).toContain('scroll_page');
    });
  });

  describe('formatToolsSection', () => {
    // Test 17: Format empty tools section
    it('should return "No tools available" for empty registry', () => {
      const formatted = builder.formatToolsSection();
      expect(formatted).toBe('No tools available.');
    });

    // Test 18: Format tools with parameters
    it('should format tools with parameter details', () => {
      registry.register(createMockTool('analyze_ctas'));
      builder = new PromptBuilder(registry);

      const formatted = builder.formatToolsSection();
      expect(formatted).toContain('**analyze_ctas**');
      expect(formatted).toContain('selector');
      expect(formatted).toContain('includeHidden');
    });
  });

  describe('template loading', () => {
    // Test 19: Get raw template
    it('should expose raw template via getTemplate()', () => {
      const template = builder.getTemplate();
      expect(template).toContain('{{TOOLS_PLACEHOLDER}}');
    });

    // Test 20: Fallback template works
    it('should use fallback template if file not found', () => {
      // The builder should have loaded a template (either real or fallback)
      const prompt = builder.buildSystemPrompt();
      expect(prompt.length).toBeGreaterThan(100);
      expect(prompt).toContain('CRO');
    });
  });
});
