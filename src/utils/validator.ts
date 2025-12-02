/**
 * URL Validator
 * Validates and normalizes URLs per FR-001.
 */

import type { ValidationResult } from '../types/index.js';

/**
 * Validates a URL string and returns a normalized version if valid.
 * @param url - The URL string to validate
 * @returns ValidationResult with valid status and normalized URL or error
 */
export function validateUrl(url: string): ValidationResult {
  // Check for empty or whitespace-only input
  if (!url || url.trim().length === 0) {
    return {
      valid: false,
      error: 'URL cannot be empty',
    };
  }

  const trimmedUrl = url.trim();

  try {
    // Attempt to parse the URL
    const parsedUrl = new URL(trimmedUrl);

    // Validate protocol (only http and https allowed)
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return {
        valid: false,
        error: `Invalid protocol: ${parsedUrl.protocol}. Only http: and https: are supported.`,
      };
    }

    // Validate hostname exists
    if (!parsedUrl.hostname || parsedUrl.hostname.length === 0) {
      return {
        valid: false,
        error: 'URL must have a valid hostname',
      };
    }

    // Return normalized URL (removes trailing slashes inconsistency, etc.)
    return {
      valid: true,
      normalizedUrl: parsedUrl.href,
    };
  } catch (err) {
    // URL constructor throws TypeError for invalid URLs
    return {
      valid: false,
      error: `Invalid URL format: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

/**
 * Checks if the OPENAI_API_KEY environment variable is set.
 * @returns true if the API key is configured
 */
export function isApiKeyConfigured(): boolean {
  const apiKey = process.env['OPENAI_API_KEY'];
  return typeof apiKey === 'string' && apiKey.length > 0;
}

/**
 * Validates that required environment variables are set.
 * @returns ValidationResult indicating if environment is properly configured
 */
export function validateEnvironment(): ValidationResult {
  if (!isApiKeyConfigured()) {
    return {
      valid: false,
      error:
        'OPENAI_API_KEY environment variable is not set. Please set your OpenAI API key before running the agent.',
    };
  }

  return {
    valid: true,
  };
}
