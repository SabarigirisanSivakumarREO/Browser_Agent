/**
 * Message Manager
 *
 * Phase 16 (T079): Manages LangChain message history for CRO agent conversations.
 * Handles message ordering, trimming, and conversion between formats.
 */

import { HumanMessage, AIMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages';
import type { CROAgentOutput } from '../models/index.js';

/**
 * MessageManager - Manages conversation history for LLM interaction
 *
 * Responsibilities:
 * - Maintain ordered message history (FR-041)
 * - Add user and assistant messages (FR-042)
 * - Provide messages for LLM calls
 * - Trim history to manage token budget
 */
export class MessageManager {
  private messages: BaseMessage[] = [];
  private readonly systemMessage: SystemMessage;

  /**
   * Create a MessageManager with a system prompt
   * @param systemPrompt - The system prompt for the conversation
   */
  constructor(systemPrompt: string) {
    this.systemMessage = new SystemMessage(systemPrompt);
  }

  /**
   * Add a user message (page state + memory context)
   * @param content - The user message content
   */
  addUserMessage(content: string): void {
    this.messages.push(new HumanMessage(content));
  }

  /**
   * Add an assistant message from agent output
   * Serializes the output to JSON for context
   * @param output - The CRO agent output to add
   */
  addAssistantMessage(output: CROAgentOutput): void {
    this.messages.push(new AIMessage(JSON.stringify(output)));
  }

  /**
   * Add a raw assistant message string
   * Used when preserving raw LLM response
   * @param content - Raw response content
   */
  addAssistantRawMessage(content: string): void {
    this.messages.push(new AIMessage(content));
  }

  /**
   * Get all messages for LLM call
   * Includes system message at the start
   * @returns Array of messages with system message first
   */
  getMessages(): BaseMessage[] {
    return [this.systemMessage, ...this.messages];
  }

  /**
   * Get messages without system message
   * Useful for inspection/logging
   * @returns Array of conversation messages only
   */
  getConversationMessages(): BaseMessage[] {
    return [...this.messages];
  }

  /**
   * Get the system message
   * @returns The system message
   */
  getSystemMessage(): SystemMessage {
    return this.systemMessage;
  }

  /**
   * Get message count (excluding system message)
   * @returns Number of conversation messages
   */
  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * Get total message count (including system message)
   * @returns Total number of messages including system
   */
  getTotalMessageCount(): number {
    return this.messages.length + 1;
  }

  /**
   * Check if conversation has any messages
   * @returns true if there are conversation messages
   */
  hasMessages(): boolean {
    return this.messages.length > 0;
  }

  /**
   * Get the last message
   * @returns Last message or undefined if empty
   */
  getLastMessage(): BaseMessage | undefined {
    return this.messages[this.messages.length - 1];
  }

  /**
   * Get the last N messages
   * @param n - Number of messages to retrieve
   * @returns Array of last N messages
   */
  getLastMessages(n: number): BaseMessage[] {
    return this.messages.slice(-n);
  }

  /**
   * Clear conversation history (keeps system message)
   */
  clear(): void {
    this.messages = [];
  }

  /**
   * Trim to limit for token management
   * Keeps system message + last N messages
   * Always preserves at least the last user-assistant pair
   * @param maxMessages - Maximum number of conversation messages to keep
   */
  trimToLimit(maxMessages: number): void {
    if (maxMessages < 2) {
      maxMessages = 2; // Keep at least one exchange
    }

    if (this.messages.length > maxMessages) {
      this.messages = this.messages.slice(-maxMessages);
    }
  }

  /**
   * Estimate token count for all messages
   * Uses rough heuristic: chars / 4
   * @returns Estimated total token count
   */
  estimateTokenCount(): number {
    let totalChars = this.systemMessage.content.length;

    for (const msg of this.messages) {
      if (typeof msg.content === 'string') {
        totalChars += msg.content.length;
      }
    }

    return Math.ceil(totalChars / 4);
  }

  /**
   * Get message types summary (for debugging)
   * @returns Object with counts by message type
   */
  getMessageTypeSummary(): { human: number; ai: number; system: number } {
    let human = 0;
    let ai = 0;

    for (const msg of this.messages) {
      if (msg instanceof HumanMessage) {
        human++;
      } else if (msg instanceof AIMessage) {
        ai++;
      }
    }

    return { human, ai, system: 1 };
  }

  /**
   * Create a snapshot of current state (for testing/debugging)
   */
  snapshot(): {
    systemPrompt: string;
    messageCount: number;
    messages: Array<{ type: string; contentPreview: string }>;
  } {
    return {
      systemPrompt:
        typeof this.systemMessage.content === 'string'
          ? this.systemMessage.content.slice(0, 100) + '...'
          : '[complex content]',
      messageCount: this.messages.length,
      messages: this.messages.map((msg) => ({
        type: msg instanceof HumanMessage ? 'human' : 'ai',
        contentPreview:
          typeof msg.content === 'string' ? msg.content.slice(0, 50) + '...' : '[complex content]',
      })),
    };
  }
}
