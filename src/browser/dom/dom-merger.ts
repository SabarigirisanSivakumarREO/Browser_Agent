/**
 * DOM Merger - Combines multiple DOM snapshots from different scroll positions
 *
 * Phase 19b: Multi-segment DOM merging for 100% page coverage.
 * Deduplicates elements by xpath when they appear in multiple snapshots.
 */

import type { DOMTree, DOMNode } from '../../models/index.js';

/**
 * DOMMerger - Merges DOM snapshots from multiple scroll positions
 *
 * When scanning a full page, we extract DOM at each scroll position.
 * Elements near segment boundaries appear in multiple snapshots.
 * This class merges them into a single complete DOM tree.
 */
export class DOMMerger {
  /**
   * Merge multiple DOM snapshots into a single complete tree
   *
   * @param snapshots Array of DOMTree objects from different scroll positions
   * @returns Merged DOMTree with deduplicated elements
   * @throws Error if snapshots array is empty
   */
  merge(snapshots: DOMTree[]): DOMTree {
    if (snapshots.length === 0) {
      throw new Error('No snapshots to merge');
    }

    if (snapshots.length === 1) {
      return snapshots[0]!;
    }

    // Deep clone the first snapshot as base
    const firstSnapshot = snapshots[0]!;
    const base = this.deepClone(firstSnapshot);

    // Collect xpaths from base tree
    const seenXPaths = new Set<string>();
    this.collectXPaths(base.root, seenXPaths);

    // Merge additional snapshots
    for (let i = 1; i < snapshots.length; i++) {
      const snapshot = snapshots[i]!;
      this.mergeSnapshot(base, snapshot, seenXPaths);
    }

    // Recalculate counts and reindex
    base.totalNodeCount = this.countNodes(base.root);
    base.croElementCount = this.countCROElements(base.root);
    base.interactiveCount = this.countInteractive(base.root);
    this.reindex(base.root);

    // Update timestamp to latest
    base.extractedAt = Date.now();

    return base;
  }

  /**
   * Deep clone a DOMTree
   */
  private deepClone(tree: DOMTree): DOMTree {
    return {
      root: this.cloneNode(tree.root),
      interactiveCount: tree.interactiveCount,
      croElementCount: tree.croElementCount,
      totalNodeCount: tree.totalNodeCount,
      extractedAt: tree.extractedAt,
    };
  }

  /**
   * Deep clone a DOMNode and its children
   */
  private cloneNode(node: DOMNode): DOMNode {
    return {
      tagName: node.tagName,
      xpath: node.xpath,
      index: node.index,
      text: node.text,
      isInteractive: node.isInteractive,
      isVisible: node.isVisible,
      croType: node.croType,
      croClassification: node.croClassification
        ? { ...node.croClassification }
        : undefined,
      boundingBox: node.boundingBox ? { ...node.boundingBox } : undefined,
      attributes: node.attributes ? { ...node.attributes } : undefined,
      children: node.children.map((child) => this.cloneNode(child)),
    };
  }

  /**
   * Collect all xpaths from a node tree
   */
  private collectXPaths(node: DOMNode, xpaths: Set<string>): void {
    if (node.xpath) {
      xpaths.add(node.xpath);
    }
    for (const child of node.children) {
      this.collectXPaths(child, xpaths);
    }
  }

  /**
   * Merge a snapshot into the base tree
   */
  private mergeSnapshot(
    base: DOMTree,
    snapshot: DOMTree,
    seenXPaths: Set<string>
  ): void {
    this.mergeNodes(base.root, snapshot.root, seenXPaths);
  }

  /**
   * Recursively merge nodes, adding new nodes not seen before
   */
  private mergeNodes(
    baseNode: DOMNode,
    sourceNode: DOMNode,
    seenXPaths: Set<string>
  ): void {
    // Try to match and merge children
    for (const sourceChild of sourceNode.children) {
      // Check if this xpath was already seen
      if (seenXPaths.has(sourceChild.xpath)) {
        // Find matching child in base and recurse
        const matchingBaseChild = baseNode.children.find(
          (c) => c.xpath === sourceChild.xpath
        );
        if (matchingBaseChild) {
          this.mergeNodes(matchingBaseChild, sourceChild, seenXPaths);
        }
        continue;
      }

      // New element - add it to base
      seenXPaths.add(sourceChild.xpath);
      const clonedChild = this.cloneNode(sourceChild);
      this.collectXPaths(clonedChild, seenXPaths);

      // Insert in document order based on Y position
      this.insertInOrder(baseNode.children, clonedChild);
    }
  }

  /**
   * Insert a node in document order based on bounding box Y position
   */
  private insertInOrder(children: DOMNode[], newNode: DOMNode): void {
    const newY = newNode.boundingBox?.y ?? Infinity;

    // Find insertion point
    let insertIndex = children.length;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const childY = child?.boundingBox?.y ?? Infinity;
      if (newY < childY) {
        insertIndex = i;
        break;
      }
    }

    children.splice(insertIndex, 0, newNode);
  }

  /**
   * Count total nodes in tree
   */
  private countNodes(node: DOMNode): number {
    let count = 1;
    for (const child of node.children) {
      count += this.countNodes(child);
    }
    return count;
  }

  /**
   * Count CRO elements in tree
   */
  private countCROElements(node: DOMNode): number {
    let count = node.croType ? 1 : 0;
    for (const child of node.children) {
      count += this.countCROElements(child);
    }
    return count;
  }

  /**
   * Count interactive elements in tree
   */
  private countInteractive(node: DOMNode): number {
    let count = node.isInteractive ? 1 : 0;
    for (const child of node.children) {
      count += this.countInteractive(child);
    }
    return count;
  }

  /**
   * Reindex all indexed elements sequentially
   */
  private reindex(node: DOMNode): void {
    let currentIndex = 0;

    const reindexNode = (n: DOMNode): void => {
      // Only reindex visible CRO or interactive elements that had an index
      if (n.isVisible && (n.croType || n.isInteractive)) {
        n.index = currentIndex++;
      } else {
        delete n.index;
      }

      for (const child of n.children) {
        reindexNode(child);
      }
    };

    reindexNode(node);
  }
}
