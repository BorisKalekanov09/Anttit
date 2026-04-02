import Graph from 'graphology';

export type TopologyType = 'small_world' | 'scale_free' | 'random' | 'grid';

export function buildGraph(topology: TopologyType, n: number): Graph {
  const G = new Graph();
  
  for (let i = 0; i < n; i++) {
    G.addNode(String(i));
  }

  switch (topology) {
    case 'random':
      buildRandomGraph(G, n);
      break;
    case 'small_world':
      buildSmallWorldGraph(G, n);
      break;
    case 'scale_free':
      buildScaleFreeGraph(G, n);
      break;
    case 'grid':
      buildGridGraph(G, n);
      break;
    default:
      buildSmallWorldGraph(G, n);
  }

  return G;
}

function buildRandomGraph(G: Graph, n: number): void {
  const p = Math.min(0.1, 6 / n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.random() < p) {
        G.addEdge(String(i), String(j));
      }
    }
  }
}

function buildSmallWorldGraph(G: Graph, n: number): void {
  const k = Math.min(6, n - 1);
  const rewireProb = 0.3;
  
  for (let i = 0; i < n; i++) {
    for (let offset = 1; offset <= Math.floor(k / 2); offset++) {
      const j = (i + offset) % n;
      if (!G.hasEdge(String(i), String(j))) {
        G.addEdge(String(i), String(j));
      }
    }
  }
  
  const edges = G.edges();
  for (const edgeKey of edges) {
    if (Math.random() < rewireProb) {
      const source = G.source(edgeKey);
      const target = G.target(edgeKey);
      
      let newTarget: string;
      let attempts = 0;
      do {
        newTarget = String(Math.floor(Math.random() * n));
        attempts++;
      } while (
        (newTarget === source || G.hasEdge(source, newTarget)) && 
        attempts < 100
      );
      
      if (attempts < 100 && newTarget !== target) {
        G.dropEdge(edgeKey);
        if (!G.hasEdge(source, newTarget)) {
          G.addEdge(source, newTarget);
        }
      }
    }
  }
}

function buildScaleFreeGraph(G: Graph, n: number): void {
  const m = Math.min(3, n - 1);
  
  for (let i = 0; i < m; i++) {
    for (let j = i + 1; j < m; j++) {
      if (!G.hasEdge(String(i), String(j))) {
        G.addEdge(String(i), String(j));
      }
    }
  }
  
  for (let i = m; i < n; i++) {
    const degrees: number[] = [];
    let totalDegree = 0;
    
    for (let j = 0; j < i; j++) {
      const deg = G.degree(String(j)) || 1;
      degrees.push(deg);
      totalDegree += deg;
    }
    
    const targets = new Set<number>();
    while (targets.size < Math.min(m, i)) {
      let r = Math.random() * totalDegree;
      for (let j = 0; j < i; j++) {
        r -= degrees[j];
        if (r <= 0) {
          targets.add(j);
          break;
        }
      }
    }
    
    for (const t of targets) {
      if (!G.hasEdge(String(i), String(t))) {
        G.addEdge(String(i), String(t));
      }
    }
  }
}

function buildGridGraph(G: Graph, n: number): void {
  const side = Math.floor(Math.sqrt(n));
  
  for (let row = 0; row < side; row++) {
    for (let col = 0; col < side; col++) {
      const idx = row * side + col;
      
      if (col < side - 1) {
        const rightIdx = row * side + (col + 1);
        if (!G.hasEdge(String(idx), String(rightIdx))) {
          G.addEdge(String(idx), String(rightIdx));
        }
      }
      
      if (row < side - 1) {
        const downIdx = (row + 1) * side + col;
        if (!G.hasEdge(String(idx), String(downIdx))) {
          G.addEdge(String(idx), String(downIdx));
        }
      }
    }
  }
}

export function computePositions(
  G: Graph,
  topology: TopologyType
): Record<string, [number, number]> {
  const positions: Record<string, [number, number]> = {};
  const nodes = G.nodes();
  const n = nodes.length;

  if (topology === 'grid') {
    const side = Math.floor(Math.sqrt(n));
    for (const node of nodes) {
      const idx = parseInt(node, 10);
      const row = Math.floor(idx / side);
      const col = idx % side;
      positions[node] = [
        Math.round((col / Math.max(side - 1, 1)) * 10000) / 10000,
        Math.round((row / Math.max(side - 1, 1)) * 10000) / 10000,
      ];
    }
    return positions;
  }

  const pos: Record<string, { x: number; y: number }> = {};
  for (const node of nodes) {
    pos[node] = { x: Math.random(), y: Math.random() };
  }

  const iterations = 50;
  const k = 1.5 / Math.sqrt(n);
  const temperature = 0.1;

  for (let iter = 0; iter < iterations; iter++) {
    const displacement: Record<string, { x: number; y: number }> = {};
    for (const node of nodes) {
      displacement[node] = { x: 0, y: 0 };
    }

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const u = nodes[i];
        const v = nodes[j];
        const dx = pos[u].x - pos[v].x;
        const dy = pos[u].y - pos[v].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        
        const repulsion = (k * k) / dist;
        const fx = (dx / dist) * repulsion;
        const fy = (dy / dist) * repulsion;
        
        displacement[u].x += fx;
        displacement[u].y += fy;
        displacement[v].x -= fx;
        displacement[v].y -= fy;
      }
    }

    G.forEachEdge((edge, attrs, source, target) => {
      const dx = pos[source].x - pos[target].x;
      const dy = pos[source].y - pos[target].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      
      const attraction = (dist * dist) / k;
      const fx = (dx / dist) * attraction;
      const fy = (dy / dist) * attraction;
      
      displacement[source].x -= fx;
      displacement[source].y -= fy;
      displacement[target].x += fx;
      displacement[target].y += fy;
    });

    const t = temperature * (1 - iter / iterations);
    for (const node of nodes) {
      const dx = displacement[node].x;
      const dy = displacement[node].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const limitedDist = Math.min(dist, t);
      pos[node].x += (dx / dist) * limitedDist;
      pos[node].y += (dy / dist) * limitedDist;
    }
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, pos[node].x);
    maxX = Math.max(maxX, pos[node].x);
    minY = Math.min(minY, pos[node].y);
    maxY = Math.max(maxY, pos[node].y);
  }
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  for (const node of nodes) {
    positions[node] = [
      Math.round(((pos[node].x - minX) / rangeX) * 10000) / 10000,
      Math.round(((pos[node].y - minY) / rangeY) * 10000) / 10000,
    ];
  }

  return positions;
}

export function getEdgeList(G: Graph): [number, number][] {
  const edges: [number, number][] = [];
  G.forEachEdge((edge, attrs, source, target) => {
    edges.push([parseInt(source, 10), parseInt(target, 10)]);
  });
  return edges;
}
