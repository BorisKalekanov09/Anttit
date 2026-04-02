import { SimulationEngine } from './engine.js';
import type { SimulationConfig } from '../types.js';

const simulations: Map<string, SimulationEngine> = new Map();

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const MAX_IDLE_TIME_MS = 30 * 60 * 1000;

interface SimulationEntry {
  engine: SimulationEngine;
  lastAccessed: number;
}

const simulationEntries: Map<string, SimulationEntry> = new Map();

export function getSimulation(simId: string): SimulationEngine | undefined {
  const entry = simulationEntries.get(simId);
  if (entry) {
    entry.lastAccessed = Date.now();
    return entry.engine;
  }
  return undefined;
}

export async function createSimulation(config: SimulationConfig): Promise<SimulationEngine> {
  const engine = new SimulationEngine(config);
  await engine.build();
  
  simulationEntries.set(config.simId, {
    engine,
    lastAccessed: Date.now(),
  });
  
  return engine;
}

export function removeSimulation(simId: string): boolean {
  const entry = simulationEntries.get(simId);
  if (entry) {
    entry.engine.stop();
    simulationEntries.delete(simId);
    return true;
  }
  return false;
}

export function listSimulations(): string[] {
  return Array.from(simulationEntries.keys());
}

export function cleanupIdleSimulations(): number {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [simId, entry] of simulationEntries) {
    if (!entry.engine.running && (now - entry.lastAccessed) > MAX_IDLE_TIME_MS) {
      entry.engine.stop();
      simulationEntries.delete(simId);
      cleaned++;
    }
  }
  
  return cleaned;
}

setInterval(cleanupIdleSimulations, CLEANUP_INTERVAL_MS);

export function getActiveCount(): number {
  return Array.from(simulationEntries.values()).filter(e => e.engine.running).length;
}

export function getTotalCount(): number {
  return simulationEntries.size;
}
