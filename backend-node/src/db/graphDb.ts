import { v4 as uuidv4 } from 'uuid';
import type { Relationship, RelationshipType } from '../types.js';

interface StoredRelationship extends Relationship {
  tickCreated: number;
  tickUpdated: number;
}

/**
 * In-memory temporal graph database for agent relationships.
 *
 * Implements the same interface a Neo4j-backed service would expose,
 * making it easy to swap out for Neo4j by implementing the same methods.
 *
 * Relationship decay follows the Know-Evolve pattern:
 *   strength(t) = strength_0 * exp(-λ * Δtick / 24)  where λ = 0.05
 *   → half-life of ~14 ticks of non-reinforcement
 */
export class GraphDB {
  private relationships: Map<string, StoredRelationship> = new Map();
  // edgeIndex: "simId:sourceId:targetId" → relationship id
  private edgeIndex: Map<string, string> = new Map();

  private edgeKey(simId: string, source: string, target: string): string {
    return `${simId}:${source}:${target}`;
  }

  async recordRelationship(
    simId: string,
    sourceAgentId: string,
    targetAgentId: string,
    type: RelationshipType,
    strength: number,
    narrative: string,
    tick: number
  ): Promise<StoredRelationship> {
    const key = this.edgeKey(simId, sourceAgentId, targetAgentId);
    const existingId = this.edgeIndex.get(key);
    const now = new Date().toISOString();
    const clampedStrength = Math.min(1.0, Math.max(0.0, strength));

    if (existingId) {
      const existing = this.relationships.get(existingId)!;
      existing.strength = clampedStrength;
      existing.type = type;
      existing.narrative = narrative;
      existing.updatedAt = now;
      existing.tickUpdated = tick;
      return existing;
    }

    const rel: StoredRelationship = {
      id: uuidv4(),
      simId,
      sourceAgentId,
      targetAgentId,
      type,
      strength: clampedStrength,
      narrative,
      createdAt: now,
      updatedAt: now,
      tickCreated: tick,
      tickUpdated: tick,
    };

    this.relationships.set(rel.id, rel);
    this.edgeIndex.set(key, rel.id);
    return rel;
  }

  getRelationshipsForSim(simId: string): StoredRelationship[] {
    return Array.from(this.relationships.values()).filter(r => r.simId === simId);
  }

  getRelationship(simId: string, source: string, target: string): StoredRelationship | undefined {
    const key = this.edgeKey(simId, source, target);
    const id = this.edgeIndex.get(key);
    return id ? this.relationships.get(id) : undefined;
  }

  /**
   * Apply temporal decay to relationships that haven't been reinforced.
   * Prunes relationships that fall below 0.01 strength.
   */
  applyDecay(simId: string, currentTick: number): void {
    const DECAY_LAMBDA = 0.05;
    const toDelete: string[] = [];

    for (const rel of this.relationships.values()) {
      if (rel.simId !== simId) continue;
      const ticksElapsed = currentTick - rel.tickUpdated;
      if (ticksElapsed <= 0) continue;

      rel.strength = rel.strength * Math.exp(-DECAY_LAMBDA * ticksElapsed / 24);

      if (rel.strength < 0.01) {
        toDelete.push(rel.id);
      }
    }

    for (const id of toDelete) {
      const rel = this.relationships.get(id);
      if (rel) {
        const key = this.edgeKey(rel.simId, rel.sourceAgentId, rel.targetAgentId);
        this.relationships.delete(id);
        this.edgeIndex.delete(key);
      }
    }
  }

  clearSimulation(simId: string): void {
    const toDelete: string[] = [];
    for (const [id, rel] of this.relationships) {
      if (rel.simId === simId) toDelete.push(id);
    }
    for (const id of toDelete) {
      const rel = this.relationships.get(id)!;
      const key = this.edgeKey(rel.simId, rel.sourceAgentId, rel.targetAgentId);
      this.relationships.delete(id);
      this.edgeIndex.delete(key);
    }
  }
}

// Module-level singleton — shared across all simulations
export const graphDb = new GraphDB();
