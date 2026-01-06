/**
 * Page State Models
 *
 * Defines interfaces for page state snapshots used by the CRO agent.
 * Phase 21d (T314): Added visionAnalysis field for GPT-4o vision results.
 */

import type { DOMTree } from './dom-tree.js';
import type { CROVisionAnalysisResult } from '../heuristics/vision/types.js';

/**
 * Viewport information
 */
export interface ViewportInfo {
  width: number;
  height: number;
  deviceScaleFactor: number;
  isMobile: boolean;
}

/**
 * Scroll position
 */
export interface ScrollPosition {
  x: number;
  y: number;
  maxX: number;    // Max scrollable X
  maxY: number;    // Max scrollable Y
}

/**
 * Complete page state (snapshot at a point in time)
 * Pure data interface - methods go in classes
 */
export interface PageState {
  url: string;
  title: string;
  domTree: DOMTree;
  viewport: ViewportInfo;
  scrollPosition: ScrollPosition;
  timestamp: number;
  screenshotPath?: string;   // If screenshot taken
  screenshotBase64?: string; // Base64 encoded screenshot for vision analysis
  visionAnalysis?: CROVisionAnalysisResult;  // Phase 21d: GPT-4o vision analysis result
}
