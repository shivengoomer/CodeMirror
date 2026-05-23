export interface TreeNodeData {
  id: string | number;
  val: string | number;
  left: TreeNodeData | null;
  right: TreeNodeData | null;
  isDummy?: boolean;
}

export interface PositionedNode {
  id: string | number;
  val: string | number;
  x: number;
  y: number;
  isDummy?: boolean;
}

export interface PositionedEdge {
  from: string | number;
  to: string | number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  label?: string;
}

/**
 * Computes positions for a binary tree.
 * A neat level-order or recursive algorithm that prevents overlaps.
 */
export function computeTreeLayout(
  root: TreeNodeData | null,
  width: number,
  height: number
): { nodes: PositionedNode[]; edges: PositionedEdge[] } {
  const nodes: PositionedNode[] = [];
  const edges: PositionedEdge[] = [];

  if (!root) return { nodes, edges };

  // Calculate layout coordinates
  // We can assign positions recursively using standard tree boundaries.
  // We specify initial dimensions: Y starts at 60 and increases by 60-80 per level.
  // X is centered and branches left/right.
  const levels: Record<number, number[]> = {};
  
  function getDepth(node: TreeNodeData | null): number {
    if (!node) return 0;
    return 1 + Math.max(getDepth(node.left), getDepth(node.right));
  }

  const maxDepth = getDepth(root);
  const horizontalSpacing = Math.max(40, width / Math.pow(2, Math.min(maxDepth, 4)));

  function layoutNode(
    node: TreeNodeData,
    x: number,
    y: number,
    level: number,
    parentX?: number,
    parentY?: number,
    parentId?: string | number,
    edgeLabel?: string
  ) {
    nodes.push({
      id: node.id,
      val: node.val,
      x,
      y,
      isDummy: node.isDummy
    });

    if (parentId !== undefined && parentX !== undefined && parentY !== undefined) {
      edges.push({
        from: parentId,
        to: node.id,
        fromX: parentX,
        fromY: parentY,
        toX: x,
        toY: y,
        label: edgeLabel
      });
    }

    const nextY = y + 80;
    const offset = horizontalSpacing * Math.pow(1.6, Math.max(0, maxDepth - level - 2));

    if (node.left) {
      layoutNode(node.left, x - offset, nextY, level + 1, x, y, node.id, "L");
    } else if (level < maxDepth - 1) {
      // Create a dummy node to show null branches
      const dummyId = `null-L-${node.id}`;
      nodes.push({ id: dummyId, val: "Ø", x: x - offset / 1.5, y: nextY, isDummy: true });
      edges.push({
        from: node.id,
        to: dummyId,
        fromX: x,
        fromY: y,
        toX: x - offset / 1.5,
        toY: nextY,
        label: "L"
      });
    }

    if (node.right) {
      layoutNode(node.right, x + offset, nextY, level + 1, x, y, node.id, "R");
    } else if (level < maxDepth - 1) {
      // Create a dummy node to show null branches
      const dummyId = `null-R-${node.id}`;
      nodes.push({ id: dummyId, val: "Ø", x: x + offset / 1.5, y: nextY, isDummy: true });
      edges.push({
        from: node.id,
        to: dummyId,
        fromX: x,
        fromY: y,
        toX: x + offset / 1.5,
        toY: nextY,
        label: "R"
      });
    }
  }

  layoutNode(root, width / 2, 60, 0);

  return { nodes, edges };
}
