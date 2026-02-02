/**
 * Screenshot Annotator - Phase 21i (T377)
 *
 * Annotates screenshots with bounding boxes and element labels for visual feedback.
 * Uses sharp to composite SVG overlays on screenshot images.
 */

import sharp from 'sharp';
import { createLogger } from '../utils/index.js';
import type { ElementMapping } from '../browser/dom/coordinate-mapper.js';
import type { HeuristicEvaluation, EvaluationStatus } from '../heuristics/vision/types.js';

const logger = createLogger('ScreenshotAnnotator');

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Options for screenshot annotation
 */
export interface AnnotationOptions {
  /** Highlight elements with issues (red for failed, orange for partial) */
  highlightIssues: boolean;
  /** Show element index labels [0], [1], etc. */
  showElementIndexes: boolean;
  /** Show coordinate information */
  showCoordinates: boolean;
  /** Box stroke width in pixels (default: 2) */
  strokeWidth?: number;
  /** Font size for labels in pixels (default: 12) */
  fontSize?: number;
  /** Opacity for highlight boxes (0-1, default: 0.3) */
  fillOpacity?: number;
}

/**
 * Default annotation options
 */
export const DEFAULT_ANNOTATION_OPTIONS: AnnotationOptions = {
  highlightIssues: true,
  showElementIndexes: true,
  showCoordinates: false,
  strokeWidth: 2,
  fontSize: 12,
  fillOpacity: 0.3,
};

/**
 * Result from annotation operation
 */
export interface AnnotationResult {
  /** Whether annotation was successful */
  success: boolean;
  /** Annotated screenshot as base64 PNG */
  annotatedBase64?: string;
  /** Number of elements annotated */
  elementsAnnotated: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Color palette for annotations
 */
const COLORS = {
  failed: { stroke: '#dc2626', fill: 'rgba(220, 38, 38, 0.2)' },    // Red
  partial: { stroke: '#f97316', fill: 'rgba(249, 115, 22, 0.2)' },  // Orange
  passed: { stroke: '#16a34a', fill: 'rgba(22, 163, 74, 0.2)' },    // Green
  neutral: { stroke: '#6b7280', fill: 'rgba(107, 114, 128, 0.2)' }, // Gray
  label: { bg: '#1f2937', text: '#ffffff' },                         // Dark bg, white text
};

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get evaluation status for an element index
 */
function getElementStatus(
  index: number,
  evaluations: HeuristicEvaluation[]
): EvaluationStatus | null {
  // Find evaluations that reference this element
  for (const evaluation of evaluations) {
    const refs = evaluation.domElementRefs ?? [];
    const hasRef = refs.some((ref) => ref.index === index);
    if (hasRef) {
      return evaluation.status;
    }
  }
  return null;
}

/**
 * Get color based on evaluation status
 */
function getColorForStatus(status: EvaluationStatus | null): { stroke: string; fill: string } {
  switch (status) {
    case 'fail':
      return COLORS.failed;
    case 'partial':
      return COLORS.partial;
    case 'pass':
      return COLORS.passed;
    default:
      return COLORS.neutral;
  }
}

/**
 * Escape special XML characters for SVG
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build SVG rectangle element for bounding box
 */
function buildBoundingBoxSvg(
  element: ElementMapping,
  color: { stroke: string; fill: string },
  options: AnnotationOptions
): string {
  const { x, y, width, height } = element.screenshotCoords;
  const strokeWidth = options.strokeWidth ?? 2;

  // Skip elements that are not visible or have invalid dimensions
  if (!element.screenshotCoords.isVisible || width <= 0 || height <= 0) {
    return '';
  }

  // Clamp coordinates to visible area (don't draw outside viewport)
  const clampedY = Math.max(0, y);
  const clampedHeight = Math.min(height, height + y - clampedY);

  if (clampedHeight <= 0) {
    return '';
  }

  return `<rect x="${x}" y="${clampedY}" width="${width}" height="${clampedHeight}"
    fill="${color.fill}" stroke="${color.stroke}" stroke-width="${strokeWidth}" />`;
}

/**
 * Build SVG label element for element index
 */
function buildIndexLabelSvg(
  element: ElementMapping,
  options: AnnotationOptions
): string {
  const { x, y, isVisible } = element.screenshotCoords;
  const fontSize = options.fontSize ?? 12;
  const padding = 4;
  const labelText = `[${element.index}]`;
  const labelWidth = labelText.length * (fontSize * 0.7) + padding * 2;
  const labelHeight = fontSize + padding * 2;

  if (!isVisible) {
    return '';
  }

  // Position label above the element, or inside if near top edge
  const labelY = y > labelHeight + 5 ? y - labelHeight - 2 : y + 2;
  const labelX = x;

  return `
    <rect x="${labelX}" y="${labelY}" width="${labelWidth}" height="${labelHeight}"
      fill="${COLORS.label.bg}" rx="3" ry="3" />
    <text x="${labelX + padding}" y="${labelY + labelHeight - padding - 2}"
      fill="${COLORS.label.text}" font-family="monospace" font-size="${fontSize}" font-weight="bold">
      ${escapeXml(labelText)}
    </text>`;
}

/**
 * Build SVG coordinate label
 */
function buildCoordLabelSvg(
  element: ElementMapping,
  options: AnnotationOptions
): string {
  const { x, y, width, height, isVisible } = element.screenshotCoords;
  const fontSize = (options.fontSize ?? 12) - 2;

  if (!isVisible) {
    return '';
  }

  const coordText = `(${Math.round(x)}, ${Math.round(y)}) ${Math.round(width)}x${Math.round(height)}`;
  const labelY = y + height + fontSize + 4;
  const labelX = x;

  return `
    <text x="${labelX}" y="${labelY}"
      fill="${COLORS.label.bg}" font-family="monospace" font-size="${fontSize}"
      stroke="#ffffff" stroke-width="2" paint-order="stroke">
      ${escapeXml(coordText)}
    </text>`;
}

/**
 * Build complete SVG overlay
 */
function buildSvgOverlay(
  width: number,
  height: number,
  elements: ElementMapping[],
  evaluations: HeuristicEvaluation[],
  options: AnnotationOptions
): string {
  const svgParts: string[] = [];

  // Sort elements by area (largest first) so smaller elements render on top
  const sortedElements = [...elements].sort((a, b) => {
    const areaA = a.screenshotCoords.width * a.screenshotCoords.height;
    const areaB = b.screenshotCoords.width * b.screenshotCoords.height;
    return areaB - areaA;
  });

  for (const element of sortedElements) {
    const status = getElementStatus(element.index, evaluations);
    const color = getColorForStatus(status);

    // Draw bounding box if highlighting issues or if element has status
    if (options.highlightIssues && (status === 'fail' || status === 'partial')) {
      svgParts.push(buildBoundingBoxSvg(element, color, options));
    } else if (!options.highlightIssues) {
      // Draw all boxes with neutral color when not highlighting issues
      svgParts.push(buildBoundingBoxSvg(element, COLORS.neutral, options));
    }

    // Draw index label
    if (options.showElementIndexes) {
      svgParts.push(buildIndexLabelSvg(element, options));
    }

    // Draw coordinate label
    if (options.showCoordinates) {
      svgParts.push(buildCoordLabelSvg(element, options));
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    ${svgParts.join('\n')}
  </svg>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Annotate a screenshot with element bounding boxes and labels
 *
 * @param screenshotBase64 - Base64 encoded PNG screenshot
 * @param visibleElements - Element mappings for visible elements
 * @param evaluations - Heuristic evaluations for color coding
 * @param options - Annotation options
 * @returns Annotation result with annotated screenshot
 */
export async function annotateScreenshot(
  screenshotBase64: string,
  visibleElements: ElementMapping[],
  evaluations: HeuristicEvaluation[],
  options: Partial<AnnotationOptions> = {}
): Promise<AnnotationResult> {
  const opts: AnnotationOptions = { ...DEFAULT_ANNOTATION_OPTIONS, ...options };

  try {
    // Decode base64 to buffer
    const imageBuffer = Buffer.from(screenshotBase64, 'base64');

    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width ?? 1280;
    const height = metadata.height ?? 720;

    // Filter to only visible elements
    const visibleOnly = visibleElements.filter((e) => e.screenshotCoords.isVisible);

    // Build SVG overlay
    const svgOverlay = buildSvgOverlay(width, height, visibleOnly, evaluations, opts);
    const svgBuffer = Buffer.from(svgOverlay);

    // Composite SVG on top of screenshot
    const annotatedBuffer = await sharp(imageBuffer)
      .composite([{ input: svgBuffer, top: 0, left: 0 }])
      .png()
      .toBuffer();

    // Convert back to base64
    const annotatedBase64 = annotatedBuffer.toString('base64');

    logger.debug('Screenshot annotated', {
      elementsAnnotated: visibleOnly.length,
      imageSize: `${width}x${height}`,
    });

    return {
      success: true,
      annotatedBase64,
      elementsAnnotated: visibleOnly.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to annotate screenshot', { error: message });

    return {
      success: false,
      elementsAnnotated: 0,
      error: `Failed to annotate screenshot: ${message}`,
    };
  }
}

/**
 * Screenshot Annotator class for object-oriented usage
 */
export class ScreenshotAnnotator {
  private options: AnnotationOptions;

  constructor(options: Partial<AnnotationOptions> = {}) {
    this.options = { ...DEFAULT_ANNOTATION_OPTIONS, ...options };
  }

  /**
   * Annotate a screenshot
   */
  async annotate(
    screenshotBase64: string,
    visibleElements: ElementMapping[],
    evaluations: HeuristicEvaluation[]
  ): Promise<AnnotationResult> {
    return annotateScreenshot(screenshotBase64, visibleElements, evaluations, this.options);
  }

  /**
   * Get current options
   */
  getOptions(): AnnotationOptions {
    return { ...this.options };
  }

  /**
   * Update options
   */
  setOptions(options: Partial<AnnotationOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Factory function to create a ScreenshotAnnotator
 */
export function createScreenshotAnnotator(
  options?: Partial<AnnotationOptions>
): ScreenshotAnnotator {
  return new ScreenshotAnnotator(options);
}
