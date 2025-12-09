/**
 * Output Module Exports - Phase 18d
 */

export { ResultFormatter } from './formatter.js';
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
