/**
 * Deduplication Fix Tests - Phase 27E (T628, T629)
 */
import { describe, it, expect } from 'vitest';
import { InsightDeduplicator } from '../../src/output/insight-deduplicator.js';
import type { CROInsight } from '../../src/models/index.js';

describe('InsightDeduplicator - Phase 27E Fix (T628)', () => {
  it('should keep insights with different heuristicIds even if element is N/A', () => {
    const dedup = new InsightDeduplicator();

    const insights: CROInsight[] = [
      {
        id: 'vision-PDP-PRICE-001-1',
        category: 'pricing',
        type: 'heuristic_fail',
        severity: 'critical',
        issue: 'Price not visible above fold',
        element: 'N/A',
        recommendation: 'Move price above fold',
        heuristicId: 'PDP-PRICE-001',
        confidence: 0.85,
      },
      {
        id: 'vision-PDP-IMAGERY-001-2',
        category: 'imagery',
        type: 'heuristic_fail',
        severity: 'high',
        issue: 'No zoom functionality',
        element: 'N/A',
        recommendation: 'Add zoom on hover',
        heuristicId: 'PDP-IMAGERY-001',
        confidence: 0.9,
      },
      {
        id: 'vision-PDP-CTA-001-3',
        category: 'cta',
        type: 'heuristic_fail',
        severity: 'critical',
        issue: 'Add to cart button not prominent',
        element: 'N/A',
        recommendation: 'Increase button size and contrast',
        heuristicId: 'PDP-CTA-001',
        confidence: 0.8,
      },
    ];

    const result = dedup.deduplicate(insights);
    // All 3 should be kept — different heuristicIds
    expect(result).toHaveLength(3);
  });

  it('should still deduplicate insights with same heuristicId', () => {
    const dedup = new InsightDeduplicator();

    const insights: CROInsight[] = [
      {
        id: 'vision-PDP-PRICE-001-1',
        category: 'pricing',
        type: 'heuristic_fail',
        severity: 'critical',
        issue: 'Price not visible',
        element: 'N/A',
        recommendation: 'Fix pricing',
        heuristicId: 'PDP-PRICE-001',
        confidence: 0.85,
      },
      {
        id: 'vision-PDP-PRICE-001-2',
        category: 'pricing',
        type: 'heuristic_fail',
        severity: 'critical',
        issue: 'Price issue duplicate',
        element: 'N/A',
        recommendation: 'Fix pricing',
        heuristicId: 'PDP-PRICE-001',
        confidence: 0.7,
      },
    ];

    const result = dedup.deduplicate(insights);
    // Should collapse to 1 — same heuristicId
    expect(result).toHaveLength(1);
    expect(result[0]!.issue).toBe('Price not visible'); // Keeps first
  });

  it('should fall back to type|element key for non-vision insights', () => {
    const dedup = new InsightDeduplicator();

    const insights: CROInsight[] = [
      {
        id: 'legacy-1',
        category: 'cta',
        type: 'missing_cta',
        severity: 'high',
        issue: 'Missing add to cart button',
        element: 'button.add-to-cart',
        recommendation: 'Add CTA',
      },
      {
        id: 'legacy-2',
        category: 'cta',
        type: 'missing_cta',
        severity: 'high',
        issue: 'Missing CTA duplicate',
        element: 'button.add-to-cart',
        recommendation: 'Add CTA',
      },
    ];

    const result = dedup.deduplicate(insights);
    // Same type + element → deduplicated
    expect(result).toHaveLength(1);
  });
});

describe('evaluationsToInsights element field - Phase 27E (T629)', () => {
  it('should populate element from domElementRefs when available', async () => {
    // Import orchestrator to test evaluationsToInsights indirectly via runAnalysis
    const { AnalysisOrchestrator } = await import('../../src/heuristics/analysis-orchestrator.js');

    // Use a minimal orchestrator and test the private method via its output
    // We'll create a tiny evaluation with domElementRefs and check the insight.element
    const orchestrator = new AnalysisOrchestrator({
      parallelAnalysis: false,
    });

    // Access the private method via prototype hack for testing
    const evaluationsToInsights = (orchestrator as any).evaluationsToInsights.bind(orchestrator);

    const evaluations = [
      {
        heuristicId: 'PDP-PRICE-001',
        principle: 'Price should be visible',
        status: 'fail' as const,
        severity: 'critical' as const,
        observation: 'Price not found above fold',
        confidence: 0.9,
        domElementRefs: [
          {
            index: 12,
            elementType: 'span',
            textContent: '£65.00',
          },
        ],
      },
    ];

    const insights = evaluationsToInsights(evaluations);
    expect(insights).toHaveLength(1);
    expect(insights[0]!.element).toBe('span[12] "£65.00"');
  });

  it('should fall back to N/A when no domElementRefs', async () => {
    const { AnalysisOrchestrator } = await import('../../src/heuristics/analysis-orchestrator.js');

    const orchestrator = new AnalysisOrchestrator({
      parallelAnalysis: false,
    });

    const evaluationsToInsights = (orchestrator as any).evaluationsToInsights.bind(orchestrator);

    const evaluations = [
      {
        heuristicId: 'PDP-CTA-001',
        principle: 'CTA should be prominent',
        status: 'fail' as const,
        severity: 'high' as const,
        observation: 'CTA not prominent',
        confidence: 0.8,
        // No domElementRefs
      },
    ];

    const insights = evaluationsToInsights(evaluations);
    expect(insights).toHaveLength(1);
    expect(insights[0]!.element).toBe('N/A');
  });
});
