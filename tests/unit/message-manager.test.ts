/**
 * MessageManager Unit Tests
 *
 * Phase 16 (T084): Tests for MessageManager class.
 * Verifies message handling, ordering, and LangChain integration.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { MessageManager } from '../../src/agent/message-manager.js';
import type { CROAgentOutput } from '../../src/models/index.js';

// Mock CROAgentOutput for testing
const createMockOutput = (overrides?: Partial<CROAgentOutput>): CROAgentOutput => ({
  thinking: 'Analyzing the page for CRO issues',
  evaluation_previous_goal: 'N/A - first step',
  memory: 'Found primary CTA above fold',
  next_goal: 'Analyze CTA effectiveness',
  action: {
    name: 'analyze_ctas',
    params: {},
  },
  ...overrides,
});

describe('MessageManager', () => {
  const systemPrompt = 'You are a CRO expert analyst.';
  let manager: MessageManager;

  beforeEach(() => {
    manager = new MessageManager(systemPrompt);
  });

  describe('constructor', () => {
    // Test 1: Creates with system prompt
    it('should create with system message from prompt', () => {
      const sysMsg = manager.getSystemMessage();
      expect(sysMsg).toBeInstanceOf(SystemMessage);
      expect(sysMsg.content).toBe(systemPrompt);
    });

    // Test 2: Starts with empty conversation
    it('should start with empty conversation history', () => {
      expect(manager.getMessageCount()).toBe(0);
      expect(manager.hasMessages()).toBe(false);
    });
  });

  describe('addUserMessage', () => {
    // Test 3: Add user message
    it('should add user message to history', () => {
      manager.addUserMessage('Page state: url=example.com');
      expect(manager.getMessageCount()).toBe(1);
      expect(manager.hasMessages()).toBe(true);
    });

    // Test 4: User message is HumanMessage
    it('should create HumanMessage instance', () => {
      manager.addUserMessage('Test content');
      const messages = manager.getConversationMessages();
      expect(messages[0]).toBeInstanceOf(HumanMessage);
      expect(messages[0].content).toBe('Test content');
    });
  });

  describe('addAssistantMessage', () => {
    // Test 5: Add assistant message from output
    it('should add assistant message from CROAgentOutput', () => {
      const output = createMockOutput();
      manager.addAssistantMessage(output);
      expect(manager.getMessageCount()).toBe(1);
    });

    // Test 6: Assistant message is AIMessage
    it('should create AIMessage instance with JSON content', () => {
      const output = createMockOutput({ thinking: 'Test thinking' });
      manager.addAssistantMessage(output);
      const messages = manager.getConversationMessages();
      expect(messages[0]).toBeInstanceOf(AIMessage);
      expect(messages[0].content).toContain('Test thinking');
    });

    // Test 7: Add raw assistant message
    it('should add raw assistant message string', () => {
      manager.addAssistantRawMessage('{"action": "done"}');
      const messages = manager.getConversationMessages();
      expect(messages[0]).toBeInstanceOf(AIMessage);
      expect(messages[0].content).toBe('{"action": "done"}');
    });
  });

  describe('getMessages', () => {
    // Test 8: Get all messages includes system message
    it('should include system message first', () => {
      manager.addUserMessage('User message');
      const all = manager.getMessages();
      expect(all.length).toBe(2);
      expect(all[0]).toBeInstanceOf(SystemMessage);
      expect(all[1]).toBeInstanceOf(HumanMessage);
    });

    // Test 9: Messages in correct order
    it('should return messages in chronological order (FR-041)', () => {
      manager.addUserMessage('First user');
      manager.addAssistantMessage(createMockOutput());
      manager.addUserMessage('Second user');

      const all = manager.getMessages();
      expect(all.length).toBe(4); // system + 3 conversation
      expect(all[0]).toBeInstanceOf(SystemMessage);
      expect(all[1]).toBeInstanceOf(HumanMessage);
      expect(all[2]).toBeInstanceOf(AIMessage);
      expect(all[3]).toBeInstanceOf(HumanMessage);
    });
  });

  describe('getConversationMessages', () => {
    // Test 10: Get only conversation messages (no system)
    it('should return only conversation messages without system', () => {
      manager.addUserMessage('Test');
      const conv = manager.getConversationMessages();
      expect(conv.length).toBe(1);
      expect(conv[0]).not.toBeInstanceOf(SystemMessage);
    });
  });

  describe('message counts', () => {
    // Test 11: getMessageCount excludes system
    it('should return count excluding system message', () => {
      manager.addUserMessage('One');
      manager.addAssistantMessage(createMockOutput());
      expect(manager.getMessageCount()).toBe(2);
    });

    // Test 12: getTotalMessageCount includes system
    it('should return total count including system message', () => {
      manager.addUserMessage('One');
      expect(manager.getTotalMessageCount()).toBe(2); // system + 1
    });
  });

  describe('getLastMessage', () => {
    // Test 13: Get last message
    it('should return the most recent message', () => {
      manager.addUserMessage('First');
      manager.addAssistantMessage(createMockOutput({ thinking: 'Last' }));

      const last = manager.getLastMessage();
      expect(last).toBeInstanceOf(AIMessage);
      expect(last?.content).toContain('Last');
    });

    // Test 14: Returns undefined when empty
    it('should return undefined when no messages', () => {
      expect(manager.getLastMessage()).toBeUndefined();
    });
  });

  describe('getLastMessages', () => {
    // Test 15: Get last N messages
    it('should return last N messages', () => {
      manager.addUserMessage('One');
      manager.addAssistantMessage(createMockOutput());
      manager.addUserMessage('Three');
      manager.addAssistantMessage(createMockOutput({ thinking: 'Four' }));

      const last2 = manager.getLastMessages(2);
      expect(last2.length).toBe(2);
      expect(last2[0]).toBeInstanceOf(HumanMessage);
      expect(last2[1]).toBeInstanceOf(AIMessage);
    });
  });

  describe('clear', () => {
    // Test 16: Clear removes conversation but keeps system
    it('should clear conversation history but keep system message', () => {
      manager.addUserMessage('Test');
      manager.addAssistantMessage(createMockOutput());
      manager.clear();

      expect(manager.getMessageCount()).toBe(0);
      expect(manager.getMessages().length).toBe(1); // Just system
      expect(manager.getMessages()[0]).toBeInstanceOf(SystemMessage);
    });
  });

  describe('trimToLimit', () => {
    // Test 17: Trim keeps last N messages
    it('should keep only last N messages when trimming', () => {
      for (let i = 0; i < 10; i++) {
        manager.addUserMessage(`Message ${i}`);
      }
      expect(manager.getMessageCount()).toBe(10);

      manager.trimToLimit(4);
      expect(manager.getMessageCount()).toBe(4);

      const messages = manager.getConversationMessages();
      expect(messages[0].content).toBe('Message 6');
      expect(messages[3].content).toBe('Message 9');
    });

    // Test 18: Trim enforces minimum of 2
    it('should enforce minimum of 2 messages when trimming', () => {
      manager.addUserMessage('One');
      manager.addAssistantMessage(createMockOutput());
      manager.addUserMessage('Three');

      manager.trimToLimit(1); // Requested 1, should keep 2
      expect(manager.getMessageCount()).toBe(2);
    });

    // Test 19: Trim does nothing if under limit
    it('should not trim if under limit', () => {
      manager.addUserMessage('One');
      manager.addUserMessage('Two');

      manager.trimToLimit(10);
      expect(manager.getMessageCount()).toBe(2);
    });
  });

  describe('estimateTokenCount', () => {
    // Test 20: Estimate tokens
    it('should estimate token count (chars / 4)', () => {
      // System prompt ~35 chars = ~9 tokens
      // Add 400 char message = ~100 tokens
      manager.addUserMessage('x'.repeat(400));

      const estimate = manager.estimateTokenCount();
      expect(estimate).toBeGreaterThan(100);
      expect(estimate).toBeLessThan(200);
    });
  });

  describe('getMessageTypeSummary', () => {
    // Test 21: Message type summary
    it('should return counts by message type', () => {
      manager.addUserMessage('One');
      manager.addAssistantMessage(createMockOutput());
      manager.addUserMessage('Two');

      const summary = manager.getMessageTypeSummary();
      expect(summary.human).toBe(2);
      expect(summary.ai).toBe(1);
      expect(summary.system).toBe(1);
    });
  });

  describe('snapshot', () => {
    // Test 22: Create snapshot for debugging
    it('should create snapshot of current state', () => {
      manager.addUserMessage('Test message content here');
      manager.addAssistantMessage(createMockOutput());

      const snap = manager.snapshot();
      expect(snap.messageCount).toBe(2);
      expect(snap.messages.length).toBe(2);
      expect(snap.messages[0].type).toBe('human');
      expect(snap.messages[1].type).toBe('ai');
      expect(snap.systemPrompt).toContain('CRO');
    });
  });
});
