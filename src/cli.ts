#!/usr/bin/env node
/**
 * Browser Agent CLI
 * Command-line interface for the browser automation agent.
 */

import { config } from 'dotenv';
import { BrowserAgent } from './index.js';
import { BrowserManager, PageLoader } from './browser/index.js';
import { CookieConsentHandler } from './browser/cookie-handler.js';
import { DOMExtractor } from './browser/dom/index.js';
import { CROElementFormatter, type CROExtractionResult } from './output/index.js';
import type { WaitUntilStrategy } from './types/index.js';

// Load environment variables from .env file
config();

const VALID_WAIT_STRATEGIES: WaitUntilStrategy[] = ['load', 'domcontentloaded', 'networkidle'];

/**
 * Parses command-line arguments.
 */
function parseArgs(): {
  urls: string[];
  headless: boolean;
  timeout: number;
  waitUntil: WaitUntilStrategy;
  postLoadWait: number;
  dismissCookieConsent: boolean;
  croExtract: boolean;
  verbose: boolean;
  help: boolean;
} {
  const args = process.argv.slice(2);
  const urls: string[] = [];
  let headless = false;
  let timeout = 60000;
  let waitUntil: WaitUntilStrategy = 'load';
  let postLoadWait = 5000;
  let dismissCookieConsent = true; // Default: enabled
  let croExtract = false;
  let verbose = false;
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--headless') {
      headless = true;
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (arg === '--cro-extract') {
      croExtract = true;
    } else if (arg === '--timeout' && args[i + 1]) {
      timeout = parseInt(args[i + 1] ?? '60000', 10);
      i++; // Skip next arg
    } else if (arg === '--wait-until' && args[i + 1]) {
      const strategy = args[i + 1] as WaitUntilStrategy;
      if (VALID_WAIT_STRATEGIES.includes(strategy)) {
        waitUntil = strategy;
      } else {
        console.error(`Invalid wait strategy: ${strategy}`);
        console.error(`Valid options: ${VALID_WAIT_STRATEGIES.join(', ')}`);
        process.exit(1);
      }
      i++; // Skip next arg
    } else if (arg === '--post-load-wait' && args[i + 1]) {
      postLoadWait = parseInt(args[i + 1] ?? '5000', 10);
      i++; // Skip next arg
    } else if (arg === '--no-cookie-dismiss') {
      dismissCookieConsent = false;
    } else if (arg && !arg.startsWith('-')) {
      urls.push(arg);
    }
  }

  return { urls, headless, timeout, waitUntil, postLoadWait, dismissCookieConsent, croExtract, verbose, help };
}

/**
 * Prints help message.
 */
function printHelp(): void {
  console.log(`
Browser Agent - Web scraping with LangChain AI analysis

USAGE:
  npm run start -- [OPTIONS] <urls...>

ARGUMENTS:
  <urls...>           One or more URLs to process

OPTIONS:
  --headless            Run browser in headless mode (default: visible)
  --timeout <ms>        Page load timeout in milliseconds (default: 60000)
  --wait-until <str>    Page load wait strategy (default: load)
                        - load: Wait for load event (balanced, recommended)
                        - domcontentloaded: Wait for DOM ready (fastest)
                        - networkidle: Wait for no network activity (may timeout)
  --post-load-wait <ms> Wait time for JS rendering after load (default: 5000)
                        Set to 0 to disable hybrid waiting
  --no-cookie-dismiss   Disable automatic cookie consent dismissal (default: enabled)
  --cro-extract         Extract CRO elements (CTAs, forms, trust signals, etc.)
                        Skips LangChain processing, shows DOM extraction results
  --verbose, -v         Enable verbose logging
  --help, -h            Show this help message

ENVIRONMENT:
  OPENAI_API_KEY      Required for default mode. Your OpenAI API key for LangChain.
                      Not required when using --cro-extract.

EXAMPLES:
  # Process a single URL (default: heading extraction + LangChain)
  npm run start -- https://example.com

  # Extract CRO elements (no LangChain required)
  npm run start -- --cro-extract https://www.carwale.com

  # Process multiple URLs
  npm run start -- https://example.com https://github.com

  # Process in headless mode with verbose logging
  npm run start -- --headless --verbose https://example.com

  # Set custom timeout (2 minutes)
  npm run start -- --timeout 120000 https://example.com

  # Use networkidle for JS-heavy SPAs
  npm run start -- --wait-until networkidle https://spa-site.com

  # Use domcontentloaded for fast static sites
  npm run start -- --wait-until domcontentloaded https://static-site.com
`);
}

/**
 * Process URL with CRO element extraction
 */
async function processCROExtraction(
  url: string,
  options: {
    headless: boolean;
    timeout: number;
    waitUntil: WaitUntilStrategy;
    postLoadWait: number;
    dismissCookieConsent: boolean;
    verbose: boolean;
  }
): Promise<CROExtractionResult> {
  const browserManager = new BrowserManager({
    headless: options.headless,
    timeout: options.timeout,
    browserType: 'chromium',
    waitUntil: options.waitUntil,
    postLoadWait: options.postLoadWait,
    dismissCookieConsent: options.dismissCookieConsent,
  });

  const startTime = Date.now();

  try {
    await browserManager.launch();
    const page = browserManager.getPage();

    // Load page
    const loader = new PageLoader(page, {
      timeout: options.timeout,
      waitUntil: options.waitUntil,
      postLoadWait: options.postLoadWait,
    });

    if (options.verbose) {
      console.log(`Loading: ${url}`);
    }

    const loadResult = await loader.load(url);

    if (!loadResult.success) {
      return {
        url,
        success: false,
        error: loadResult.error || 'Failed to load page',
        loadTimeMs: loadResult.loadTimeMs,
      };
    }

    // Dismiss cookie consent if enabled
    if (options.dismissCookieConsent) {
      const cookieHandler = new CookieConsentHandler();
      await cookieHandler.dismiss(page);
    }

    // Extract DOM
    if (options.verbose) {
      console.log('Extracting CRO elements...');
    }

    const extractor = new DOMExtractor();
    const domTree = await extractor.extract(page);

    return {
      url,
      success: true,
      domTree,
      loadTimeMs: Date.now() - startTime,
    };

  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    return {
      url,
      success: false,
      error,
      loadTimeMs: Date.now() - startTime,
    };

  } finally {
    await browserManager.close();
  }
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const { urls, headless, timeout, waitUntil, postLoadWait, dismissCookieConsent, croExtract, verbose, help } = parseArgs();

  // Show help if requested or no URLs provided
  if (help || urls.length === 0) {
    printHelp();
    process.exit(help ? 0 : 1);
  }

  // CRO Extraction mode
  if (croExtract) {
    const formatter = new CROElementFormatter();

    for (const url of urls) {
      console.log(`\nProcessing: ${url}\n`);

      const result = await processCROExtraction(url, {
        headless,
        timeout,
        waitUntil,
        postLoadWait,
        dismissCookieConsent,
        verbose,
      });

      console.log(formatter.format(result));

      if (!result.success) {
        process.exit(1);
      }
    }

    process.exit(0);
  }

  // Default mode: BrowserAgent with LangChain
  const agent = new BrowserAgent({
    browser: {
      headless,
      timeout,
      waitUntil,
      postLoadWait,
      dismissCookieConsent,
      browserType: 'chromium',
    },
    verbose,
  });

  try {
    // Validate environment
    agent.validateEnvironment();

    // Process URLs
    if (urls.length === 1) {
      // Single URL processing
      const url = urls[0];
      if (!url) {
        console.error('No URL provided');
        process.exit(1);
      }

      console.log(`Processing: ${url}\n`);
      const result = await agent.processUrl(url);
      console.log(agent.formatResult(result));

      process.exit(result.success ? 0 : 1);
    } else {
      // Batch processing
      console.log(`Processing ${urls.length} URLs...\n`);
      const batch = await agent.processBatch(urls);
      console.log(agent.formatBatch(batch));

      process.exit(batch.failureCount === 0 ? 0 : 1);
    }
  } catch (err) {
    const error = err as Error;
    console.error(`\nFATAL ERROR: ${error.message}`);

    if (verbose && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  } finally {
    // Always clean up browser resources
    await agent.close();
  }
}

// Run main function
main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
