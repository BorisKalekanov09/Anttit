import { describe, it, expect } from 'vitest';
import { SimulationEngine } from './engine.js';
import type { SimulationConfig } from '../types.js';

describe('SimulationEngine', () => {
  it('should create a SimulationEngine instance', () => {
    const config: SimulationConfig = {
      theme: 'rumor',
      agentCount: 10,
      topology: 'small_world',
      tickRate: 0.5,
      personalities: [],
      simId: 'test-sim',
      modelName: 'gemini-2.0-flash-lite',
      aiAgentsPerTick: 5,
      seedText: 'test',
    };
    
    const engine = new SimulationEngine(config);
    expect(engine).toBeDefined();
    expect(engine.config).toEqual(config);
  });

  it('should have a tick method', () => {
    const config: SimulationConfig = {
      theme: 'rumor',
      agentCount: 10,
      topology: 'small_world',
      tickRate: 0.5,
      personalities: [],
      simId: 'test-sim',
      modelName: 'gemini-2.0-flash-lite',
      aiAgentsPerTick: 5,
      seedText: 'test',
    };
    
    const engine = new SimulationEngine(config);
    expect(typeof engine.tick).toBeDefined();
    expect(engine.agents).toBeDefined();
  });
});
