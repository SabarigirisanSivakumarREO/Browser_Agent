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

// Shared utilities (Phase 31, Phase 34)
export { findElementByIndex, coerceBoolean, waitForPossibleNavigation } from './tool-utils.js';

// Browser interaction tools — P0 (Phase 31b)
export { typeTextTool, TypeTextParamsSchema, type TypeTextParams } from './type-text-tool.js';
export { pressKeyTool, PressKeyParamsSchema, type PressKeyParams } from './press-key-tool.js';
export { selectOptionTool, SelectOptionParamsSchema, type SelectOptionParams } from './select-option-tool.js';
export { extractTextTool, ExtractTextParamsSchema, type ExtractTextParams } from './extract-text-tool.js';

// Browser interaction tools — P1 (Phase 31c)
export { hoverTool, HoverParamsSchema, type HoverParams } from './hover-tool.js';
export { goBackTool, GoBackParamsSchema, type GoBackParams } from './go-back-tool.js';
export { waitForTool, WaitForParamsSchema, type WaitForParams } from './wait-for-tool.js';
export { dismissBlockerTool, DismissBlockerParamsSchema, type DismissBlockerParams } from './dismiss-blocker-tool.js';

// Browser interaction tools — P2 (Phase 31d)
export { switchTabTool, SwitchTabParamsSchema, type SwitchTabParams } from './switch-tab-tool.js';
export { uploadFileTool, UploadFileParamsSchema, type UploadFileParams } from './upload-file-tool.js';
export { executeJsTool, ExecuteJsParamsSchema, type ExecuteJsParams } from './execute-js-tool.js';

// Browser interaction tools — P3 (Phase 31e)
export { dragAndDropTool, DragAndDropParamsSchema, type DragAndDropParams } from './drag-and-drop-tool.js';
export { getAxTreeTool, GetAxTreeParamsSchema, type GetAxTreeParams } from './get-ax-tree-tool.js';
