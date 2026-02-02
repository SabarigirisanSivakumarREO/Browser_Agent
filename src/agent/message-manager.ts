/**
 * Message Manager
 *
 * Phase 16 (T079): Manages LangChain message history for CRO agent conversations.
 * T512: Added image support for unified vision integration.
 * Handles message ordering, trimming, and conversion between formats.
 */

import { HumanMessage, AIMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages';
import type { CROAgentOutput } from '../models/index.js';

/**
 * Image content for multimodal messages
 * T512: Support for vision-enabled analysis
 */
export interface ImageContent {
  type: 'image_url';
  image_url: {
    url: string;  // Base64 data URL or HTTP URL
    detail?: 'low' | 'high' | 'auto';  // Low detail = ~85 tokens
  };
}

/**
 * Text content for multimodal messages
 */
export interface TextContent {
  type: 'text';
  text: string;
}

/**
 * Content that can be in a message (text or image)
 */
export type MessageContent = TextContent | ImageContent;

/**
 * Estimated tokens per image at low detail
 * OpenAI charges ~85 tokens for low detail images
 */
const IMAGE_TOKENS_LOW_DETAIL = 85;

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
  /** T512: Track image count for token estimation */
  private imageCount = 0;

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
   * T512: Add a user message with a single image
   * Used for analysis phase with vision context
   *
   * @param text - Text content of the message
   * @param imageBase64 - Base64 encoded image data (without data URL prefix)
   * @param detail - Image detail level ('low' = ~85 tokens, 'high' = more detailed)
   */
  addUserMessageWithImage(text: string, imageBase64: string, detail: 'low' | 'high' = 'low'): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = [
      { type: 'text', text },
      {
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${imageBase64}`,
          detail,
        },
      },
    ];

    this.messages.push(new HumanMessage({ content }));
    this.imageCount++;
  }

  /**
   * T512: Add a user message with multiple images
   * Used for analysis phase when analyzing multiple viewport snapshots
   *
   * @param text - Text content of the message
   * @param images - Array of base64 encoded images (without data URL prefix)
   * @param detail - Image detail level for all images
   */
  addUserMessageWithImages(text: string, images: string[], detail: 'low' | 'high' = 'low'): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = [{ type: 'text', text }];

    for (const imageBase64 of images) {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${imageBase64}`,
          detail,
        },
      });
    }

    this.messages.push(new HumanMessage({ content }));
    this.imageCount += images.length;
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
    this.imageCount = 0;
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
   * Uses rough heuristic: chars / 4 for text, ~85 per image (low detail)
   * T512: Added image token estimation
   * @returns Estimated total token count
   */
  estimateTokenCount(): number {
    let totalChars = 0;
    let imageTokens = 0;

    // System message
    if (typeof this.systemMessage.content === 'string') {
      totalChars += this.systemMessage.content.length;
    }

    // Conversation messages
    for (const msg of this.messages) {
      if (typeof msg.content === 'string') {
        totalChars += msg.content.length;
      } else if (Array.isArray(msg.content)) {
        // Multimodal content - cast to any[] to handle LangChain's complex types
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contentArray = msg.content as any[];
        for (const contentItem of contentArray) {
          if (typeof contentItem === 'string') {
            totalChars += contentItem.length;
          } else if (contentItem && typeof contentItem === 'object' && 'type' in contentItem) {
            if (contentItem.type === 'text' && contentItem.text) {
              totalChars += String(contentItem.text).length;
            } else if (contentItem.type === 'image_url') {
              imageTokens += IMAGE_TOKENS_LOW_DETAIL;
            }
          }
        }
      }
    }

    return Math.ceil(totalChars / 4) + imageTokens;
  }

  /**
   * Get message types summary (for debugging)
   * T512: Added image count
   * @returns Object with counts by message type
   */
  getMessageTypeSummary(): { human: number; ai: number; system: number; images: number } {
    let human = 0;
    let ai = 0;

    for (const msg of this.messages) {
      if (msg instanceof HumanMessage) {
        human++;
      } else if (msg instanceof AIMessage) {
        ai++;
      }
    }

    return { human, ai, system: 1, images: this.imageCount };
  }

  /**
   * T512: Check if conversation includes any images
   * @returns true if any messages contain images
   */
  hasImages(): boolean {
    return this.imageCount > 0;
  }

  /**
   * T512: Get the number of images in the conversation
   * @returns Number of images added
   */
  getImageCount(): number {
    return this.imageCount;
  }

  /**
   * Create a snapshot of current state (for testing/debugging)
   * T512: Added imageCount to snapshot
   */
  snapshot(): {
    systemPrompt: string;
    messageCount: number;
    imageCount: number;
    messages: Array<{ type: string; contentPreview: string; hasImage: boolean }>;
  } {
    return {
      systemPrompt:
        typeof this.systemMessage.content === 'string'
          ? this.systemMessage.content.slice(0, 100) + '...'
          : '[complex content]',
      messageCount: this.messages.length,
      imageCount: this.imageCount,
      messages: this.messages.map((msg) => {
        const hasImage = typeof msg.content !== 'string' &&
          Array.isArray(msg.content) &&
          msg.content.some((c) => typeof c === 'object' && 'type' in c && c.type === 'image_url');

        return {
          type: msg instanceof HumanMessage ? 'human' : 'ai',
          contentPreview:
            typeof msg.content === 'string' ? msg.content.slice(0, 50) + '...' : '[complex content]',
          hasImage,
        };
      }),
    };
  }
}
