export interface GraphNodeData {
  id: string;
}

export interface GraphEdgeData {
  from: string;
  to: string;
  weight?: number;
}

export interface PositionedGraphNode {
  id: string;
  x: number;
  y: number;
}

export function computeGraphLayout(
  nodes: GraphNodeData[],
  edges: GraphEdgeData[],
  width: number,
  height: number,
  iterations: number = 60
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  
  if (nodes.length === 0) return positions;

  // Initialize nodes in a circle
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.35;

  nodes.forEach((node, idx) => {
    const angle = (idx / nodes.length) * 2 * Math.PI;
    positions[node.id] = {
      x: centerX + radius * Math.cos(angle) + (Math.random() - 0.5) * 10,
      y: centerY + radius * Math.sin(angle) + (Math.random() - 0.5) * 10
    };
  });

  const k = Math.sqrt((width * height) / nodes.length) * 0.5; // Optimal distance

  // Simple force-directed relaxation loop
  for (let iter = 0; iter < iterations; iter++) {
    const forces: Record<string, { dx: number; dy: number }> = {};
    nodes.forEach(n => {
      forces[n.id] = { dx: 0, dy: 0 };
    });

    // 1. Repulsion between all node pairs
    for (let i = 0; i < nodes.length; i++) {
      const u = nodes[i].id;
      for (let j = i + 1; j < nodes.length; j++) {
        const v = nodes[j].id;
        const dx = positions[u].x - positions[v].x;
        const dy = positions[u].y - positions[v].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        
        // Repulsive force
        const force = (k * k) / dist;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        forces[u].dx += fx;
        forces[u].dy += fy;
        forces[v].dx -= fx;
        forces[v].dy -= fy;
      }
    }

    // 2. Attraction along edges
    edges.forEach(edge => {
      const u = edge.from;
      const v = edge.to;
      if (!positions[u] || !positions[v]) return;

      const dx = positions[u].x - positions[v].x;
      const dy = positions[u].y - positions[v].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      // Attractive force
      const force = (dist * dist) / k;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      forces[u].dx -= fx;
      forces[u].dy -= fy;
      forces[v].dx += fx;
      forces[v].dy += fy;
    });

    // 3. Apply forces with simple bounds constraint
    nodes.forEach(node => {
      const id = node.id;
      const f = forces[id];
      
      // Limit maximum displacement per iteration
      const limit = 20 / (iter * 0.1 + 1);
      const fDist = Math.sqrt(f.dx * f.dx + f.dy * f.dy) || 1;
      const displacement = Math.min(fDist, limit);

      positions[id].x += (f.dx / fDist) * displacement;
      positions[id].y += (f.dy / fDist) * displacement;

      // Restrict to canvas borders
      const pad = 35;
      positions[id].x = Math.max(pad, Math.min(width - pad, positions[id].x));
      positions[id].y = Math.max(pad, Math.min(height - pad, positions[id].y));
    });
  }

  return positions;
}
