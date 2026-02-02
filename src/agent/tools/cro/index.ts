/**
 * CRO Tools Module Exports
 *
 * Phase 15b: CRO-specific analysis tools.
 * Phase 17a: Navigation tools (scroll, click, go_to_url).
 * Phase 17b: Analysis tools (forms, trust, value_prop, navigation, friction).
 * Phase 17c: Control tools (record_insight, done).
 * CR-001-B: Collection tools (capture_viewport, collection_done).
 */

// Analysis tools (Phase 15b)
export { analyzeCTAsTool, AnalyzeCTAsParamsSchema, type AnalyzeCTAsParams } from './analyze-ctas.js';

// Navigation tools (Phase 17a)
export { scrollPageTool, ScrollPageParamsSchema, type ScrollPageParams } from './scroll-tool.js';
export { clickTool, ClickParamsSchema, type ClickParams } from './click-tool.js';
export { goToUrlTool, GoToUrlParamsSchema, type GoToUrlParams } from './go-to-url-tool.js';

// Analysis tools (Phase 17b)
export { analyzeFormsTool, AnalyzeFormsParamsSchema, type AnalyzeFormsParams } from './analyze-forms-tool.js';
export { analyzeTrustTool, AnalyzeTrustParamsSchema, type AnalyzeTrustParams } from './analyze-trust-tool.js';
export { analyzeValuePropTool, AnalyzeValuePropParamsSchema, type AnalyzeValuePropParams } from './analyze-value-prop-tool.js';
export { checkNavigationTool, CheckNavigationParamsSchema, type CheckNavigationParams } from './check-navigation-tool.js';
export { findFrictionTool, FindFrictionParamsSchema, type FindFrictionParams } from './find-friction-tool.js';

// Collection tools (CR-001-B)
export { captureViewportTool, CaptureViewportParamsSchema, type CaptureViewportParams, type CaptureViewportResult } from './capture-viewport-tool.js';
export { collectionDoneTool, CollectionDoneParamsSchema, type CollectionDoneParams } from './collection-done-tool.js';

// Control tools (Phase 17c)
export { recordInsightTool, RecordInsightParamsSchema, type RecordInsightParams } from './record-insight-tool.js';
export { doneTool, DoneParamsSchema, type DoneParams } from './done-tool.js';
