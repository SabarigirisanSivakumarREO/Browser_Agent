/**
 * CLI Options Unit Tests - Phase 21l T398
 *
 * Tests for default evidence and annotation options:
 * - saveEvidence defaults to true (Phase 21l)
 * - annotateScreenshots defaults to true (Phase 21l)
 * - Opt-out flags: --no-save-evidence, --no-annotate-screenshots
 * - Legacy flags: --save-evidence, --annotate-screenshots still work
 */

import { describe, it, expect } from 'vitest';

/**
 * CLI argument parser for testing
 * Mirrors the logic in src/cli.ts parseArgs()
 */
function parseCliArgs(args: string[]): {
  vision: boolean;
  saveEvidence: boolean;
  annotateScreenshots: boolean;
  evidenceDir: string;
  urls: string[];
} {
  const urls: string[] = [];
  let vision = false;
  let saveEvidence = true;  // Default: ON (Phase 21l)
  let annotateScreenshots = true;  // Default: ON (Phase 21l)
  let evidenceDir = '';  // Empty = auto-generate with timestamp

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--vision' || arg === '--vision-agent') {
      vision = true;
    } else if (arg === '--save-evidence') {
      // Legacy flag (now default, kept for backward compatibility)
      saveEvidence = true;
    } else if (arg === '--no-save-evidence') {
      // Phase 21l: Opt-out flag
      saveEvidence = false;
    } else if (arg === '--annotate-screenshots') {
      // Legacy flag (now default, kept for backward compatibility)
      annotateScreenshots = true;
    } else if (arg === '--no-annotate-screenshots') {
      // Phase 21l: Opt-out flag
      annotateScreenshots = false;
    } else if (arg === '--evidence-dir' && args[i + 1]) {
      evidenceDir = args[i + 1] ?? './evidence';
      i++;
    } else if (arg?.startsWith('--evidence-dir=')) {
      evidenceDir = arg.split('=')[1] ?? './evidence';
    } else if (arg && !arg.startsWith('-')) {
      urls.push(arg);
    }
  }

  return { vision, saveEvidence, annotateScreenshots, evidenceDir, urls };
}

describe('CLI default options (Phase 21l)', () => {
  describe('Default values', () => {
    it('saveEvidence defaults to true when --vision is used', () => {
      const options = parseCliArgs(['--vision', 'https://example.com']);

      expect(options.vision).toBe(true);
      expect(options.saveEvidence).toBe(true);
    });

    it('annotateScreenshots defaults to true when --vision is used', () => {
      const options = parseCliArgs(['--vision', 'https://example.com']);

      expect(options.vision).toBe(true);
      expect(options.annotateScreenshots).toBe(true);
    });

    it('evidenceDir defaults to empty (auto-generate with timestamp)', () => {
      const options = parseCliArgs(['--vision', 'https://example.com']);

      expect(options.evidenceDir).toBe('');
    });
  });

  describe('Opt-out flags', () => {
    it('--no-save-evidence disables evidence saving', () => {
      const options = parseCliArgs(['--vision', '--no-save-evidence', 'https://example.com']);

      expect(options.vision).toBe(true);
      expect(options.saveEvidence).toBe(false);
    });

    it('--no-annotate-screenshots disables annotation', () => {
      const options = parseCliArgs(['--vision', '--no-annotate-screenshots', 'https://example.com']);

      expect(options.vision).toBe(true);
      expect(options.annotateScreenshots).toBe(false);
    });

    it('both opt-out flags can be used together', () => {
      const options = parseCliArgs([
        '--vision',
        '--no-save-evidence',
        '--no-annotate-screenshots',
        'https://example.com'
      ]);

      expect(options.saveEvidence).toBe(false);
      expect(options.annotateScreenshots).toBe(false);
    });
  });

  describe('Legacy flags (backward compatibility)', () => {
    it('legacy --save-evidence flag still works', () => {
      const options = parseCliArgs(['--vision', '--save-evidence', 'https://example.com']);

      expect(options.saveEvidence).toBe(true);
    });

    it('legacy --annotate-screenshots flag still works', () => {
      const options = parseCliArgs(['--vision', '--annotate-screenshots', 'https://example.com']);

      expect(options.annotateScreenshots).toBe(true);
    });

    it('--vision-agent alias still works', () => {
      const options = parseCliArgs(['--vision-agent', 'https://example.com']);

      expect(options.vision).toBe(true);
      expect(options.saveEvidence).toBe(true);
      expect(options.annotateScreenshots).toBe(true);
    });
  });

  describe('Evidence directory options', () => {
    it('--evidence-dir sets custom directory', () => {
      const options = parseCliArgs(['--vision', '--evidence-dir', './my-reports', 'https://example.com']);

      expect(options.evidenceDir).toBe('./my-reports');
    });

    it('--evidence-dir= syntax works', () => {
      const options = parseCliArgs(['--vision', '--evidence-dir=./custom-dir', 'https://example.com']);

      expect(options.evidenceDir).toBe('./custom-dir');
    });
  });

  describe('URL parsing', () => {
    it('extracts URLs from arguments', () => {
      const options = parseCliArgs(['--vision', 'https://example.com', 'https://other.com']);

      expect(options.urls).toEqual(['https://example.com', 'https://other.com']);
    });

    it('does not include flags as URLs', () => {
      const options = parseCliArgs([
        '--vision',
        '--no-save-evidence',
        'https://example.com'
      ]);

      expect(options.urls).toEqual(['https://example.com']);
    });
  });

  describe('Flag order independence', () => {
    it('flags work regardless of order', () => {
      // URL first
      const options1 = parseCliArgs(['https://example.com', '--vision', '--no-save-evidence']);
      expect(options1.vision).toBe(true);
      expect(options1.saveEvidence).toBe(false);

      // Flags in middle
      const options2 = parseCliArgs(['--vision', 'https://example.com', '--no-annotate-screenshots']);
      expect(options2.annotateScreenshots).toBe(false);
    });

    it('--no-* flags override previous --* flags', () => {
      // First enable, then disable
      const options = parseCliArgs([
        '--vision',
        '--save-evidence',
        '--no-save-evidence',
        'https://example.com'
      ]);

      expect(options.saveEvidence).toBe(false);
    });
  });
});
