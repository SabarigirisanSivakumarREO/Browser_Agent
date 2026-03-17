/**
 * Output Module Exports - Phase 18d
 */

export {
  CROElementFormatter,
  type CROExtractionResult,
} from './cro-element-formatter.js';
export {
  ToolResultFormatter,
  type ToolExecutionResult,
} from './tool-result-formatter.js';
export {
  AgentProgressFormatter,
  type AgentProgressFormatterOptions,
} from './agent-progress-formatter.js';

// Phase 18d: Output Generation
export {
  HypothesisGenerator,
  type HypothesisGeneratorOptions,
} from './hypothesis-generator.js';
export {
  InsightDeduplicator,
  type InsightDeduplicatorOptions,
} from './insight-deduplicator.js';
export {
  InsightPrioritizer,
  type InsightPrioritizerOptions,
} from './insight-prioritizer.js';
export {
  MarkdownReporter,
  type MarkdownReporterOptions,
  type CROScores,
  type CROReportInput,
} from './markdown-reporter.js';
export {
  JSONExporter,
  type JSONExporterOptions,
  type CROExportData,
} from './json-exporter.js';

// Phase 18-CLI: File Writer
export {
  FileWriter,
  type FileWriteResult,
  type FileWriterOptions,
} from './file-writer.js';

// Phase 21h: Screenshot Writer (T358)
export {
  ScreenshotWriter,
  createScreenshotWriter,
  DEFAULT_SCREENSHOT_WRITE_OPTIONS,
  type ScreenshotWriteOptions,
  type ScreenshotWriteResult,
  type AllViewportsWriteResult,
  type ViewportScreenshotData,
} from './screenshot-writer.js';

// Phase 21i: Screenshot Annotator (T377)
export {
  ScreenshotAnnotator,
  createScreenshotAnnotator,
  annotateScreenshot,
  DEFAULT_ANNOTATION_OPTIONS,
  type AnnotationOptions,
  type AnnotationResult,
  // Phase 25d: Fold Line Annotation (T489-T491)
  annotateFoldLine,
  type FoldLineOptions,
  type FoldLineResult,
} from './screenshot-annotator.js';

// Phase 23: LLM Input Writer (T400)
export {
  LLMInputWriter,
  createLLMInputWriter,
  DEFAULT_LLM_INPUT_CONFIG,
  type LLMInputData,
  type LLMInputWriterConfig,
  type LLMInputWriteResult,
} from './llm-input-writer.js';

// Phase 25e: Tiled Screenshot Mode (T493-T498)
export {
  captureTiledScreenshots,
  tilesToSnapshots,
  DEFAULT_TILED_CONFIG,
  type TiledScreenshotConfig,
  type ScreenshotTile,
  type TiledScreenshotResult,
} from './tiled-screenshot.js';

// Phase 25g: Evidence Packager (T510)
export {
  buildEvidencePackage,
  writeEvidenceJson,
  type BuildEvidenceInput,
} from './evidence-packager.js';
