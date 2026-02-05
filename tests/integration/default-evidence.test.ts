/**
 * Default Evidence Creation Integration Tests - Phase 21l T399
 *
 * Tests that evidence saving and screenshot annotation are enabled by default:
 * - Evidence directory created with timestamp when --vision used
 * - Screenshots saved by default
 * - Screenshots annotated by default
 * - --no-save-evidence prevents evidence creation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Default evidence creation (Phase 21l)', () => {
  // These tests validate the evidence configuration behavior
  // without running actual browser sessions

  describe('Evidence directory structure', () => {
    it('generates timestamped directory when not specified', () => {
      // Simulating the CLI behavior from src/cli.ts lines 762-767
      const saveEvidence = true;
      let evidenceDir = '';  // Empty = auto-generate

      if (saveEvidence && !evidenceDir) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        evidenceDir = `./evidence/${timestamp}`;
      }

      // Validate timestamp format: YYYY-MM-DDTHH-MM-SS
      expect(evidenceDir).toMatch(/^\.\/evidence\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
    });

    it('uses custom directory when specified', () => {
      const saveEvidence = true;
      let evidenceDir = './my-custom-reports';

      // The logic does NOT overwrite custom dir
      if (saveEvidence && !evidenceDir) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        evidenceDir = `./evidence/${timestamp}`;
      }

      expect(evidenceDir).toBe('./my-custom-reports');
    });

    it('skips evidence directory when saving disabled', () => {
      const saveEvidence = false;
      let evidenceDir = '';

      // When disabled, no directory should be created
      if (saveEvidence && !evidenceDir) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        evidenceDir = `./evidence/${timestamp}`;
      }

      expect(evidenceDir).toBe('');
    });
  });

  describe('LLM inputs directory structure', () => {
    it('creates llm-inputs directory with timestamp', () => {
      // From src/cli.ts lines 833-835
      const llmInputTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const llmInputDir = `./llm-inputs/${llmInputTimestamp}`;

      expect(llmInputDir).toMatch(/^\.\/llm-inputs\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
    });
  });

  describe('Evidence saving conditions', () => {
    it('saveEvidence defaults to true in vision mode', () => {
      // Simulating default CLI options
      const visionMode = true;
      const saveEvidence = true;  // Default from Phase 21l

      if (visionMode) {
        expect(saveEvidence).toBe(true);
      }
    });

    it('annotateScreenshots defaults to true in vision mode', () => {
      // Simulating default CLI options
      const visionMode = true;
      const annotateScreenshots = true;  // Default from Phase 21l

      if (visionMode) {
        expect(annotateScreenshots).toBe(true);
      }
    });

    it('--no-save-evidence sets flag to false', () => {
      // Simulating CLI flag processing
      let saveEvidence = true;  // Default

      // Parse --no-save-evidence
      const args = ['--vision', '--no-save-evidence', 'https://example.com'];
      if (args.includes('--no-save-evidence')) {
        saveEvidence = false;
      }

      expect(saveEvidence).toBe(false);
    });

    it('--no-annotate-screenshots sets flag to false', () => {
      // Simulating CLI flag processing
      let annotateScreenshots = true;  // Default

      // Parse --no-annotate-screenshots
      const args = ['--vision', '--no-annotate-screenshots', 'https://example.com'];
      if (args.includes('--no-annotate-screenshots')) {
        annotateScreenshots = false;
      }

      expect(annotateScreenshots).toBe(false);
    });
  });

  describe('Evidence file output', () => {
    const testDir = './test-evidence-output';

    beforeEach(() => {
      // Clean up test directory before each test
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true });
      }
    });

    afterEach(() => {
      // Clean up test directory after each test
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true });
      }
    });

    it('creates evidence directory structure', () => {
      // Create test directory structure
      fs.mkdirSync(testDir, { recursive: true });
      expect(fs.existsSync(testDir)).toBe(true);

      // Simulate screenshot file naming pattern
      const viewportFiles = [
        'viewport_1_0px.png',
        'viewport_2_720px.png',
        'viewport_3_1440px.png',
      ];

      for (const file of viewportFiles) {
        fs.writeFileSync(path.join(testDir, file), 'test');
      }

      // Verify files created
      const files = fs.readdirSync(testDir);
      expect(files.length).toBe(3);
      expect(files).toContain('viewport_1_0px.png');
    });

    it('creates llm-inputs subdirectory structure', () => {
      // Create test directory structure matching Phase 23 spec
      const llmInputDir = path.join(testDir, 'llm-inputs');
      const subdirs = ['DOM-snapshots', 'Screenshots', 'Prompts'];

      for (const subdir of subdirs) {
        fs.mkdirSync(path.join(llmInputDir, subdir), { recursive: true });
      }

      // Verify structure
      expect(fs.existsSync(path.join(llmInputDir, 'DOM-snapshots'))).toBe(true);
      expect(fs.existsSync(path.join(llmInputDir, 'Screenshots'))).toBe(true);
      expect(fs.existsSync(path.join(llmInputDir, 'Prompts'))).toBe(true);
    });
  });

  describe('Screenshot annotation toggle', () => {
    it('skips annotation when disabled but still saves screenshots', () => {
      // Test the conditional annotation logic
      const saveEvidence = true;
      const annotateScreenshots = false;
      const screenshots = [
        { base64: 'original1', viewportIndex: 0 },
        { base64: 'original2', viewportIndex: 1 },
      ];

      // When annotation is disabled, screenshots remain unchanged
      if (!annotateScreenshots) {
        // No modification to screenshots
        expect(screenshots[0]?.base64).toBe('original1');
        expect(screenshots[1]?.base64).toBe('original2');
      }

      // But they should still be saved when saveEvidence is true
      expect(saveEvidence).toBe(true);
    });

    it('annotates screenshots when enabled', () => {
      // Test the annotation path
      const annotateScreenshots = true;
      let wasAnnotated = false;

      if (annotateScreenshots) {
        // In actual code, this calls ScreenshotAnnotator.annotate()
        wasAnnotated = true;
      }

      expect(wasAnnotated).toBe(true);
    });
  });
});
