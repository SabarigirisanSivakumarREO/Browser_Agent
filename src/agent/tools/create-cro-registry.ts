/**
 * CRO Tool Registry Factory
 *
 * Phase 15b: Creates a ToolRegistry pre-configured with CRO analysis tools.
 * Phase 17a: Added navigation tools (scroll, click, go_to_url).
 * Phase 17b: Added analysis tools (forms, trust, value_prop, navigation, friction).
 * Phase 17c: Added control tools (record_insight, done).
 * CR-001-B: Added collection tools (capture_viewport, collection_done).
 */

import { ToolRegistry } from './tool-registry.js';
import {
  // Phase 15b
  analyzeCTAsTool,
  // Phase 17a - Navigation tools
  scrollPageTool,
  clickTool,
  goToUrlTool,
  // Phase 17b - Analysis tools
  analyzeFormsTool,
  analyzeTrustTool,
  analyzeValuePropTool,
  checkNavigationTool,
  findFrictionTool,
  // CR-001-B - Collection tools
  captureViewportTool,
  collectionDoneTool,
  // Phase 17c - Control tools
  recordInsightTool,
  doneTool,
} from './cro/index.js';

/**
 * Create a ToolRegistry with all CRO tools registered
 *
 * Tools registered (13 total):
 * - Analysis (6): analyze_ctas, analyze_forms, detect_trust_signals, assess_value_prop, check_navigation, find_friction
 * - Navigation (3): scroll_page, click, go_to_url
 * - Collection (2): capture_viewport, collection_done (CR-001-B)
 * - Control (2): record_insight, done
 */
export function createCRORegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // Phase 15b - CTA analysis
  registry.register(analyzeCTAsTool);

  // Phase 17a - Navigation tools
  registry.register(scrollPageTool);
  registry.register(clickTool);
  registry.register(goToUrlTool);

  // Phase 17b - Analysis tools
  registry.register(analyzeFormsTool);
  registry.register(analyzeTrustTool);
  registry.register(analyzeValuePropTool);
  registry.register(checkNavigationTool);
  registry.register(findFrictionTool);

  // CR-001-B - Collection tools
  registry.register(captureViewportTool);
  registry.register(collectionDoneTool);

  // Phase 17c - Control tools
  registry.register(recordInsightTool);
  registry.register(doneTool);

  return registry;
}
