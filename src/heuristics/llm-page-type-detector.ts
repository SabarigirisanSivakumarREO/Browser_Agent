/**
 * LLM Page Type Detector - Phase 24 (T461-T464)
 *
 * Tier 3 fallback for page type detection using vision LLM.
 * Only invoked when Playwright and heuristic tiers are uncertain (~10% of cases).
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import sharp from 'sharp';
import type { PageType } from '../models/page-type.js';
import { createLogger } from '../utils/index.js';

const logger = createLogger('LLMPageTypeDetector');

/**
 * Configuration for LLM page type detection
 */
export interface LLMDetectionConfig {
  /** Model to use (default: gpt-4o-mini) */
  model: 'gpt-4o' | 'gpt-4o-mini';
  /** Timeout in milliseconds (default: 10000) */
  timeout: number;
  /** Max tokens for response (default: 200) */
  maxTokens: number;
  /** Max image width for resizing (default: 512) */
  imageMaxWidth: number;
  /** Temperature (default: 0.1) */
  temperature: number;
}

const DEFAULT_LLM_CONFIG: LLMDetectionConfig = {
  model: 'gpt-4o-mini',
  timeout: 10000,
  maxTokens: 200,
  imageMaxWidth: 512,
  temperature: 0.1,
};

/**
 * Result from LLM page type detection
 */
export interface LLMDetectionResult {
  /** Detected page type */
  pageType: PageType;
  /** Confidence score 0-1 */
  confidence: number;
  /** Reasoning from LLM */
  reasoning: string;
  /** Detection tier */
  tier: 'llm';
  /** Time taken in milliseconds */
  detectionTimeMs: number;
}

/**
 * LLM-based page type detector.
 * Uses vision model to classify pages that Playwright/heuristics can't handle.
 */
export class LLMPageTypeDetector {
  private config: LLMDetectionConfig;
  private llm: ChatOpenAI;

  constructor(config: Partial<LLMDetectionConfig> = {}) {
    this.config = { ...DEFAULT_LLM_CONFIG, ...config };

    this.llm = new ChatOpenAI({
      model: this.config.model,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
      timeout: this.config.timeout,
    });
  }

  /**
   * Detect page type using vision LLM
   * @param screenshot - Screenshot buffer (PNG/JPEG)
   * @param url - Page URL for context
   * @param title - Page title for context
   */
  async detect(screenshot: Buffer, url: string, title: string): Promise<LLMDetectionResult> {
    const startTime = Date.now();
    logger.info(`Starting LLM page type detection for: ${url}`);

    try {
      // Resize image for efficiency
      const resizedImage = await this.resizeImage(screenshot);
      const base64Image = resizedImage.toString('base64');

      // Build messages
      const systemMessage = new SystemMessage(this.buildSystemPrompt());
      const humanMessage = new HumanMessage({
        content: [
          {
            type: 'text',
            text: this.buildUserPrompt(url, title),
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`,
              detail: 'low', // Use low detail for faster processing
            },
          },
        ],
      });

      // Make LLM call
      const response = await this.llm.invoke([systemMessage, humanMessage]);
      const content = typeof response.content === 'string' ? response.content : '';

      // Parse response
      const result = this.parseResponse(content);
      const detectionTimeMs = Date.now() - startTime;

      logger.info(
        `LLM detection complete: ${result.pageType} (confidence: ${result.confidence.toFixed(2)}, time: ${detectionTimeMs}ms)`
      );

      return {
        ...result,
        tier: 'llm',
        detectionTimeMs,
      };
    } catch (error) {
      const detectionTimeMs = Date.now() - startTime;
      logger.error('LLM page type detection failed', { error, url });

      // Return low-confidence 'other' on failure
      return {
        pageType: 'other',
        confidence: 0.3,
        reasoning: `LLM detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        tier: 'llm',
        detectionTimeMs,
      };
    }
  }

  /**
   * Build system prompt for page type detection
   */
  private buildSystemPrompt(): string {
    return `You are an expert at classifying e-commerce web pages. Analyze the screenshot and classify the page type.

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "pageType": "<type>",
  "confidence": <0.0-1.0>,
  "reasoning": "<brief explanation>"
}

Page types (pick ONE):
- "pdp" - Product Detail Page: Shows a single product with price, add to cart button, images, variants
- "plp" - Product Listing Page: Grid/list of multiple products, filters, category navigation
- "homepage" - Homepage: Hero banner, featured products, navigation to categories
- "cart" - Cart/Basket: Line items, subtotal, checkout button, quantity selectors
- "checkout" - Checkout: Address form, payment form, shipping options, order summary
- "account" - Account/Login: Sign in form, registration, account settings, order history
- "other" - Other: Any page that doesn't fit above categories

Key signals to look for:
- PDP: Single product focus, "Add to Cart"/"Buy Now" button, price, size/color selectors
- PLP: Multiple product cards in grid, filters sidebar, sort dropdown
- Cart: Multiple line items with quantities, subtotal, "Checkout" button
- Checkout: Form fields for address/payment, shipping options

Be decisive. If uncertain, use your best judgment based on the dominant visual elements.`;
  }

  /**
   * Build user prompt with URL and title context
   */
  private buildUserPrompt(url: string, title: string): string {
    return `Classify this e-commerce page:

URL: ${url}
Title: ${title || 'Unknown'}

Analyze the screenshot and respond with JSON only.`;
  }

  /**
   * Resize image for efficient LLM processing
   */
  private async resizeImage(screenshot: Buffer): Promise<Buffer> {
    try {
      return await sharp(screenshot)
        .resize(this.config.imageMaxWidth, null, { withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
    } catch (error) {
      logger.warn('Image resize failed, using original', { error });
      return screenshot;
    }
  }

  /**
   * Parse LLM response to extract page type and confidence
   */
  private parseResponse(content: string): Omit<LLMDetectionResult, 'tier' | 'detectionTimeMs'> {
    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate page type
      const validTypes: PageType[] = ['pdp', 'plp', 'homepage', 'cart', 'checkout', 'account', 'other'];
      const pageType: PageType = validTypes.includes(parsed.pageType?.toLowerCase())
        ? (parsed.pageType.toLowerCase() as PageType)
        : 'other';

      // Validate confidence
      const confidence =
        typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.5;

      // Get reasoning
      const reasoning =
        typeof parsed.reasoning === 'string'
          ? parsed.reasoning
          : 'No reasoning provided';

      return { pageType, confidence, reasoning };
    } catch (error) {
      logger.warn('Failed to parse LLM response', { content, error });

      // Attempt basic text parsing as fallback
      const lowerContent = content.toLowerCase();
      let pageType: PageType = 'other';

      if (lowerContent.includes('pdp') || lowerContent.includes('product detail')) {
        pageType = 'pdp';
      } else if (lowerContent.includes('plp') || lowerContent.includes('product listing')) {
        pageType = 'plp';
      } else if (lowerContent.includes('cart') || lowerContent.includes('basket')) {
        pageType = 'cart';
      } else if (lowerContent.includes('checkout')) {
        pageType = 'checkout';
      } else if (lowerContent.includes('homepage') || lowerContent.includes('home page')) {
        pageType = 'homepage';
      } else if (lowerContent.includes('account') || lowerContent.includes('login')) {
        pageType = 'account';
      }

      return {
        pageType,
        confidence: 0.4,
        reasoning: `Parsed from text: ${content.slice(0, 100)}...`,
      };
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): LLMDetectionConfig {
    return { ...this.config };
  }
}

/**
 * Create a new LLM page type detector
 */
export function createLLMPageTypeDetector(config?: Partial<LLMDetectionConfig>): LLMPageTypeDetector {
  return new LLMPageTypeDetector(config);
}
