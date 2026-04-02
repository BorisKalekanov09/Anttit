import networkx as nx
import random
import math


def build_graph(topology: str, n: int) -> nx.Graph:
    """Build a NetworkX graph for the given topology and agent count."""
    if topology == "random":
        p = min(0.1, 6 / n) if n > 1 else 0.5
        G = nx.erdos_renyi_graph(n, p, seed=42)
    elif topology == "small_world":
        k = min(6, n - 1)
        G = nx.watts_strogatz_graph(n, k, 0.3, seed=42)
    elif topology == "scale_free":
        m = min(3, n - 1)
        G = nx.barabasi_albert_graph(n, m, seed=42)
    elif topology == "grid":
        side = math.isqrt(n)
        G = nx.grid_2d_graph(side, side)
        mapping = {node: i for i, node in enumerate(G.nodes())}
        G = nx.relabel_nodes(G, mapping)
        # Pad remaining nodes as isolated
        for i in range(side * side, n):
            G.add_node(i)
    else:
        G = nx.watts_strogatz_graph(n, 4, 0.3, seed=42)

    # Ensure all nodes 0..n-1 exist
    for i in range(n):
        if i not in G:
            G.add_node(i)

    return G


def compute_positions(G: nx.Graph, topology: str) -> dict:
    """Pre-compute 2D positions for visualization (normalized 0-1)."""
    if topology == "grid":
        side = math.isqrt(len(G.nodes()))
        pos = {}
        for node in G.nodes():
            pos[node] = (
                (node % side) / max(side - 1, 1),
                (node // side) / max(side - 1, 1),
            )
    else:
        pos = nx.spring_layout(G, seed=42, k=1.5 / (len(G.nodes()) ** 0.5))
        # Normalize to 0-1
        xs = [v[0] for v in pos.values()]
        ys = [v[1] for v in pos.values()]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        rng_x = max_x - min_x or 1
        rng_y = max_y - min_y or 1
        pos = {
            k: ((v[0] - min_x) / rng_x, (v[1] - min_y) / rng_y)
            for k, v in pos.items()
        }
    return {str(k): [round(v[0], 4), round(v[1], 4)] for k, v in pos.items()}
