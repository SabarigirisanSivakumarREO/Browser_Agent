/**
 * Vision Message Manager - Phase 21g (T345)
 *
 * Manages message history for the vision agent, including support
 * for multimodal messages with images.
 */

import type { VisionAgentMessage, MessageContent, ImageContent, TextContent } from './types.js';
import { createLogger } from '../../utils/index.js';

const logger = createLogger('VisionMessageManager');

/**
 * Maximum messages to keep in history to manage context window
 * Keep low to avoid accumulating multiple large image messages
 */
const MAX_HISTORY_LENGTH = 6;

/**
 * Manages vision agent message history
 */
export class VisionMessageManager {
  private messages: VisionAgentMessage[] = [];
  private systemPrompt: string = '';

  /**
   * Set the system prompt (only set once)
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
    logger.debug('System prompt set', { length: prompt.length });
  }

  /**
   * Get the system prompt
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  /**
   * Add a user message with text only
   */
  addUserMessage(text: string): void {
    this.messages.push({
      role: 'user',
      content: text,
    });
    this.trimHistory();
  }

  /**
   * Add a user message with text and image
   * Uses 'low' detail to reduce token usage:
   * - Low detail: ~85 tokens (fixed)
   * - High detail: can be 500K+ tokens depending on image size
   */
  addUserMessageWithImage(text: string, imageBase64: string): void {
    const content: MessageContent[] = [
      { type: 'text', text },
      {
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${imageBase64}`,
          detail: 'low',  // Low detail = ~85 tokens, high = can be 500K+
        },
      },
    ];

    this.messages.push({
      role: 'user',
      content,
    });
    this.trimHistory();

    logger.debug('User message with image added', {
      textLength: text.length,
      imageSize: imageBase64.length,
    });
  }

  /**
   * Add an assistant message (tool calls or response)
   */
  addAssistantMessage(content: string): void {
    this.messages.push({
      role: 'assistant',
      content,
    });
    this.trimHistory();
  }

  /**
   * Add a tool result as a user message
   * Uses a clean summary to avoid bloating context with large data
   */
  addToolResult(toolName: string, result: unknown): void {
    let resultText: string;

    if (typeof result === 'string') {
      resultText = result;
    } else if (typeof result === 'object' && result !== null) {
      // Check if result has a 'message' field (clean summary)
      const r = result as Record<string, unknown>;
      if (typeof r.message === 'string') {
        resultText = r.message;
      } else {
        // Create a sanitized copy without large data fields
        const sanitized = { ...r };
        // Remove fields that could contain large data
        delete sanitized.snapshot;
        delete sanitized._validatedEvaluations;
        delete sanitized.base64;
        delete sanitized.screenshot;
        delete sanitized.dom;
        resultText = JSON.stringify(sanitized, null, 2);
      }
    } else {
      resultText = String(result);
    }

    this.messages.push({
      role: 'user',
      content: `Tool result for ${toolName}:\n${resultText}`,
    });
    this.trimHistory();
  }

  /**
   * Get all messages for API call
   */
  getMessages(): VisionAgentMessage[] {
    return [...this.messages];
  }

  /**
   * Get messages formatted for OpenAI API
   * Only includes the MOST RECENT image to avoid context explosion
   * Older images are stripped to text-only
   */
  getMessagesForAPI(): Array<{
    role: 'system' | 'user' | 'assistant';
    content: string | Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }>;
  }> {
    const apiMessages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string | Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }>;
    }> = [];

    // Add system prompt first
    if (this.systemPrompt) {
      apiMessages.push({
        role: 'system',
        content: this.systemPrompt,
      });
    }

    // Find the index of the last message with an image
    let lastImageIndex = -1;
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const msg = this.messages[i]!;  // Non-null assertion, array bounds checked
      if (typeof msg.content !== 'string') {
        for (const c of msg.content) {
          if (c.type === 'image_url') {
            lastImageIndex = i;
            break;
          }
        }
        if (lastImageIndex >= 0) break;
      }
    }

    // Add conversation messages, stripping images from all but the last one
    this.messages.forEach((msg, i) => {
      const isLastImageMessage = (i === lastImageIndex);

      if (typeof msg.content === 'string') {
        apiMessages.push({
          role: msg.role,
          content: msg.content,
        });
      } else {
        // Multimodal content - only include image if this is the last image message
        const processedContent = msg.content
          .map(c => {
            if (c.type === 'text') {
              return { type: 'text', text: (c as TextContent).text };
            } else if (isLastImageMessage) {
              // Only include image for the most recent message with an image
              const img = c as ImageContent;
              return {
                type: 'image_url',
                image_url: {
                  url: img.image_url.url,
                  detail: img.image_url.detail,
                },
              };
            } else {
              // Strip image from older messages, replace with placeholder text
              return { type: 'text', text: '[Previous screenshot - see latest image below]' };
            }
          });

        apiMessages.push({
          role: msg.role,
          content: processedContent,
        });
      }
    });

    return apiMessages;
  }

  /**
   * Get message count
   */
  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * Estimate total tokens in messages
   */
  estimateTotalTokens(): number {
    let total = Math.ceil(this.systemPrompt.length / 4);

    for (const msg of this.messages) {
      if (typeof msg.content === 'string') {
        total += Math.ceil(msg.content.length / 4);
      } else {
        for (const c of msg.content) {
          if (c.type === 'text') {
            total += Math.ceil((c as TextContent).text.length / 4);
          } else {
            // Images are counted differently by OpenAI
            // Low detail: ~85 tokens (fixed)
            total += 85;
          }
        }
      }
    }

    return total;
  }

  /**
   * Clear all messages (but keep system prompt)
   */
  clear(): void {
    this.messages = [];
    logger.debug('Message history cleared');
  }

  /**
   * Trim history to max length, keeping system prompt and recent messages
   */
  private trimHistory(): void {
    if (this.messages.length > MAX_HISTORY_LENGTH) {
      // Keep the most recent messages
      const removed = this.messages.length - MAX_HISTORY_LENGTH;
      this.messages = this.messages.slice(removed);
      logger.debug('Message history trimmed', { removed, remaining: this.messages.length });
    }
  }

  /**
   * Get a summary of the conversation for debugging
   */
  getSummary(): { messageCount: number; estimatedTokens: number; hasImages: boolean } {
    let hasImages = false;
    for (const msg of this.messages) {
      if (typeof msg.content !== 'string') {
        for (const c of msg.content) {
          if (c.type === 'image_url') {
            hasImages = true;
            break;
          }
        }
        if (hasImages) break;
      }
    }

    return {
      messageCount: this.messages.length,
      estimatedTokens: this.estimateTotalTokens(),
      hasImages,
    };
  }
}
