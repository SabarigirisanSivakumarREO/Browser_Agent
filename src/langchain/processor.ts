/**
 * LangChain Processor
 * Processes extracted data through OpenAI GPT-4o-mini per FR-005, CR-003.
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import type { ProcessingConfig, ProcessingResult, ExtractionResult } from '../types/index.js';
import { createLogger } from '../utils/index.js';

const logger = createLogger('LangChainProcessor');

/**
 * Zod schema for structured LLM response parsing.
 */
const ProcessingResponseSchema = z.object({
  summary: z.string(),
  categories: z.array(z.string()),
  insights: z.array(z.string()),
});

type ProcessingResponse = z.infer<typeof ProcessingResponseSchema>;

/**
 * Processes extracted web data through LangChain/OpenAI.
 * Generates insights, categorizations, and summaries.
 */
export class LangChainProcessor {
  private readonly model: ChatOpenAI;

  /**
   * Creates a new LangChainProcessor instance.
   * @param config - Processing configuration
   */
  constructor(config: ProcessingConfig) {
    // Initialize ChatOpenAI model
    this.model = new ChatOpenAI({
      modelName: config.model,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
    });

    logger.info('LangChain processor initialized', {
      model: config.model,
      maxTokens: config.maxTokens,
    });
  }

  /**
   * Analyzes extracted headings and generates insights.
   * @param extraction - Extraction result containing headings
   * @returns ProcessingResult with summary, categories, and insights
   */
  async analyze(extraction: ExtractionResult): Promise<ProcessingResult> {
    logger.info('Analyzing extraction results', {
      headingCount: extraction.totalCount,
    });

    // Handle empty extraction
    if (extraction.totalCount === 0) {
      logger.warn('No headings to analyze');
      return {
        summary: 'No headings found on this page.',
        categories: [],
        insights: ['The page does not contain any heading elements (h1-h6).'],
      };
    }

    try {
      // Build the prompt with heading data
      const headingsList = extraction.headings
        .map((h) => `[h${h.level}] ${h.text}`)
        .join('\n');

      const systemPrompt = `You are an expert web content analyst. Analyze the heading structure of a web page and provide insights.

Your response must be valid JSON matching this structure:
{
  "summary": "A 1-2 sentence summary of the page's content structure",
  "categories": ["array", "of", "topic", "categories"],
  "insights": ["array", "of", "key", "insights", "about", "the", "content"]
}

Focus on:
- What topics the page covers based on headings
- How well-organized the content appears
- The hierarchy and structure of information
- Any notable patterns or observations`;

      const userPrompt = `Analyze these headings extracted from a web page:

Heading Count by Level:
${Object.entries(extraction.countByLevel)
  .map(([level, count]) => `- h${level}: ${count}`)
  .join('\n')}

Total Headings: ${extraction.totalCount}

Headings (in document order):
${headingsList}

Provide your analysis as JSON.`;

      // Call the model
      const response = await this.model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ]);

      // Extract content from response
      const content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      // Parse and validate response
      const parsed = this.parseResponse(content);

      logger.info('Analysis complete', {
        categoriesCount: parsed.categories.length,
        insightsCount: parsed.insights.length,
      });

      return {
        summary: parsed.summary,
        categories: parsed.categories,
        insights: parsed.insights,
        rawResponse: content,
      };
    } catch (err) {
      logger.errorWithStack('LangChain processing failed', err as Error);

      // Return fallback result on error
      return this.createFallbackResult(extraction, err as Error);
    }
  }

  /**
   * Parses and validates the LLM response.
   * @param content - Raw response content
   * @returns Parsed ProcessingResponse
   */
  private parseResponse(content: string): ProcessingResponse {
    try {
      // Extract JSON from response (may be wrapped in markdown code blocks)
      let jsonStr = content;

      // Remove markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch?.[1]) {
        jsonStr = jsonMatch[1];
      }

      // Parse JSON
      const parsed: unknown = JSON.parse(jsonStr.trim());

      // Validate with Zod
      return ProcessingResponseSchema.parse(parsed);
    } catch (err) {
      logger.warn('Failed to parse LLM response, using fallback', {
        error: (err as Error).message,
      });

      // Return a basic response if parsing fails
      return {
        summary: 'Analysis completed but response parsing failed.',
        categories: ['Unknown'],
        insights: ['Unable to parse detailed insights from the response.'],
      };
    }
  }

  /**
   * Creates a fallback result when LangChain processing fails.
   * @param extraction - Original extraction result
   * @param error - The error that occurred
   * @returns Fallback ProcessingResult with basic statistics
   */
  private createFallbackResult(extraction: ExtractionResult, error: Error): ProcessingResult {
    const levelSummary = Object.entries(extraction.countByLevel)
      .map(([level, count]) => `h${level}: ${count}`)
      .join(', ');

    return {
      summary: `Page contains ${extraction.totalCount} headings (${levelSummary}). LangChain analysis unavailable.`,
      categories: ['Uncategorized'],
      insights: [
        `Total headings: ${extraction.totalCount}`,
        `LangChain processing error: ${error.message}`,
        'Raw extraction data is available above.',
      ],
    };
  }
}
