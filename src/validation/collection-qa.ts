/**
 * Collection QA - Phase 25i (T539-T540)
 *
 * LLM-based quality assurance for viewport collection.
 * Only invoked when cheap validator flags issues.
 *
 * Uses thumbnails (480px width) instead of full screenshots
 * to minimize token cost while still enabling visual inspection.
 */

import { ChatOpenAI } from '@langchain/openai';
import sharp from 'sharp';
import type { ViewportValidatorSignals } from '../types/index.js';
import { createLogger } from '../utils/index.js';

const logger = createLogger('CollectionQA');

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of LLM QA analysis
 */
export interface LLMQAResult {
  /** Whether the collection is valid overall */
  valid: boolean;

  /** Viewports that should be rechecked with extended timeouts */
  recheck: Array<{
    /** Viewport index to recheck */
    index: number;
    /** Reason for rechecking */
    reason: string;
    /** Hint for how to improve capture (e.g., "wait longer", "scroll adjustment") */
    hint: string;
  }>;

  /** Additional notes from LLM analysis */
  notes?: string;

  /** Raw LLM response for debugging */
  rawResponse?: string;

  /** Time taken for analysis in ms */
  analysisTimeMs: number;
}

/**
 * Summary of viewport for LLM prompt
 */
export interface ViewportSummary {
  /** Viewport index */
  index: number;
  /** Scroll position */
  scrollY: number;
  /** DOM element count */
  elementCount: number;
  /** Issues detected by cheap validator */
  issues: string[];
  /** Image statistics */
  imageStats: {
    total: number;
    loaded: number;
    pending: number;
    failed: number;
  };
}

/**
 * Configuration for LLM QA
 */
export interface LLMQAConfig {
  /** Model to use (default: 'gpt-4o-mini') */
  model: 'gpt-4o' | 'gpt-4o-mini';
  /** Thumbnail width in pixels (default: 480) */
  thumbnailWidth: number;
  /** Maximum viewports to send to LLM (default: 5) */
  maxViewportsToAnalyze: number;
  /** Timeout for LLM call in ms (default: 30000) */
  timeoutMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Default Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_LLM_QA_CONFIG: LLMQAConfig = {
  model: 'gpt-4o-mini',
  thumbnailWidth: 480,
  maxViewportsToAnalyze: 5,
  timeoutMs: 30000,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Thumbnail Generation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a thumbnail from a full screenshot.
 * Resizes to specified width while maintaining aspect ratio.
 *
 * @param screenshot - Full screenshot buffer (PNG or JPEG)
 * @param width - Target width in pixels (default: 480)
 * @returns Thumbnail buffer (JPEG)
 */
export async function generateThumbnail(
  screenshot: Buffer,
  width: number = 480
): Promise<Buffer> {
  try {
    return await sharp(screenshot)
      .resize(width, null, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 60 })
      .toBuffer();
  } catch (error) {
    logger.warn('Failed to generate thumbnail, using original', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return screenshot;
  }
}

/**
 * Generate thumbnails for multiple screenshots
 */
export async function generateThumbnails(
  screenshots: Buffer[],
  width: number = 480
): Promise<Buffer[]> {
  const thumbnails: Buffer[] = [];
  for (const screenshot of screenshots) {
    const thumbnail = await generateThumbnail(screenshot, width);
    thumbnails.push(thumbnail);
  }
  return thumbnails;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LLM QA Function
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run LLM-based QA on flagged viewports.
 *
 * This function:
 * 1. Generates thumbnails from screenshots
 * 2. Builds a prompt with viewport summaries and issues
 * 3. Sends to LLM for analysis
 * 4. Parses response to determine which viewports need rechecking
 *
 * @param summaries - Viewport summaries with detected issues
 * @param flags - Global flags from cheap validator
 * @param screenshots - Raw screenshot buffers (will be thumbnailed)
 * @param config - LLM QA configuration
 * @returns QA result with recheck instructions
 */
export async function runLLMQA(
  summaries: ViewportSummary[],
  flags: string[],
  screenshots: Buffer[],
  config: Partial<LLMQAConfig> = {}
): Promise<LLMQAResult> {
  const startTime = Date.now();
  const fullConfig: LLMQAConfig = { ...DEFAULT_LLM_QA_CONFIG, ...config };

  logger.debug('Running LLM QA', {
    viewportCount: summaries.length,
    flagCount: flags.length,
    model: fullConfig.model,
  });

  try {
    // Generate thumbnails for visual analysis
    const thumbnails = await generateThumbnails(
      screenshots.slice(0, fullConfig.maxViewportsToAnalyze),
      fullConfig.thumbnailWidth
    );

    // Build prompt
    const prompt = buildQAPrompt(
      summaries.slice(0, fullConfig.maxViewportsToAnalyze),
      flags
    );

    // Call LLM
    const llm = new ChatOpenAI({
      modelName: fullConfig.model,
      temperature: 0,
      timeout: fullConfig.timeoutMs,
    });

    // Build message with images
    const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      { type: 'text', text: prompt },
    ];

    // Add thumbnails as images
    for (const thumbnail of thumbnails) {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${thumbnail.toString('base64')}`,
        },
      });
    }

    const response = await llm.invoke([
      {
        role: 'user',
        content,
      },
    ]);

    const responseText = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    // Parse LLM response
    const result = parseQAResponse(responseText);

    const analysisTimeMs = Date.now() - startTime;

    logger.debug('LLM QA complete', {
      valid: result.valid,
      recheckCount: result.recheck.length,
      analysisTimeMs,
    });

    return {
      ...result,
      rawResponse: responseText,
      analysisTimeMs,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('LLM QA failed', { error: errorMsg });

    return {
      valid: false,
      recheck: summaries
        .filter((s) => s.issues.length > 0)
        .map((s) => ({
          index: s.index,
          reason: 'LLM QA failed, rechecking all flagged viewports',
          hint: 'extended_timeout',
        })),
      notes: `LLM QA error: ${errorMsg}`,
      analysisTimeMs: Date.now() - startTime,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Prompt Building
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build QA prompt for LLM analysis
 */
function buildQAPrompt(summaries: ViewportSummary[], flags: string[]): string {
  const viewportDetails = summaries.map((s) => {
    const issueList = s.issues.length > 0
      ? `Issues: ${s.issues.join(', ')}`
      : 'No issues detected';

    return `
Viewport ${s.index}:
- Scroll: ${s.scrollY}px
- Elements: ${s.elementCount}
- Images: ${s.imageStats.loaded}/${s.imageStats.total} loaded, ${s.imageStats.pending} pending, ${s.imageStats.failed} failed
- ${issueList}`;
  }).join('\n');

  const flagList = flags.length > 0
    ? `Global Flags:\n${flags.map((f) => `- ${f}`).join('\n')}`
    : 'No global flags.';

  return `You are a QA analyst for a web page capture system. Analyze the captured viewport screenshots and their metadata to determine if the capture is valid.

## Viewport Data
${viewportDetails}

${flagList}

## Your Task
1. Look at each viewport screenshot (attached images in order)
2. Check if the page content appears fully loaded
3. Identify any viewports with:
   - Loading spinners or skeleton UI
   - Blank/placeholder images
   - Missing content that should be visible
   - Overlay popups blocking content
   - Scroll position issues

## Response Format
Respond with ONLY a JSON object (no markdown, no explanation):
{
  "valid": true/false,
  "recheck": [
    { "index": 0, "reason": "reason for recheck", "hint": "wait_longer|scroll_adjust|refresh" }
  ],
  "notes": "optional notes about the capture quality"
}

Rules:
- "valid" should be true if the capture is acceptable overall
- Include viewport indices in "recheck" only if they clearly need recapturing
- "hint" should be one of: "wait_longer", "scroll_adjust", "refresh"
- Keep "notes" brief (1-2 sentences max)

Analyze now:`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Response Parsing
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse LLM QA response
 */
function parseQAResponse(responseText: string): Omit<LLMQAResult, 'rawResponse' | 'analysisTimeMs'> {
  try {
    // Try to extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate structure
    const valid = typeof parsed.valid === 'boolean' ? parsed.valid : true;
    const notes = typeof parsed.notes === 'string' ? parsed.notes : undefined;

    // Parse recheck array
    const recheck: LLMQAResult['recheck'] = [];
    if (Array.isArray(parsed.recheck)) {
      for (const item of parsed.recheck) {
        if (typeof item.index === 'number') {
          recheck.push({
            index: item.index,
            reason: typeof item.reason === 'string' ? item.reason : 'Needs verification',
            hint: typeof item.hint === 'string' ? item.hint : 'wait_longer',
          });
        }
      }
    }

    return { valid, recheck, notes };
  } catch (error) {
    logger.warn('Failed to parse LLM QA response', {
      error: error instanceof Error ? error.message : 'Unknown',
      responsePreview: responseText.slice(0, 200),
    });

    // Default to valid with no rechecks on parse failure
    return {
      valid: true,
      recheck: [],
      notes: 'Failed to parse LLM response, assuming valid',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create viewport summaries from signals
 */
export function createViewportSummaries(
  signals: ViewportValidatorSignals[],
  elementCounts: number[],
  issues: string[][]
): ViewportSummary[] {
  return signals.map((signal, i) => ({
    index: signal.viewportIndex,
    scrollY: 0, // Caller should provide actual scroll positions
    elementCount: elementCounts[i] || 0,
    issues: issues[i] || [],
    imageStats: {
      total: signal.totalImages,
      loaded: signal.loadedImages,
      pending: signal.lazyPendingCount,
      failed: signal.failedImages,
    },
  }));
}

/**
 * Determine if LLM QA should be skipped based on cost considerations
 */
export function shouldSkipLLMQA(
  recheckCount: number,
  totalViewports: number,
  qualityScore: number
): boolean {
  // Skip if quality is good enough
  if (qualityScore >= 85 && recheckCount === 0) {
    return true;
  }

  // Skip if too many viewports would need checking (likely a systemic issue)
  if (recheckCount > totalViewports * 0.5) {
    logger.debug('Skipping LLM QA - too many viewports flagged', {
      recheckCount,
      totalViewports,
    });
    return true;
  }

  return false;
}
