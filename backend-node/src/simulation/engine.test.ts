import { describe, it, expect } from 'vitest';
import { SimulationEngine } from './engine.js';
import type { SimulationConfig } from '../types.js';

describe('SimulationEngine', () => {
  it('should create a SimulationEngine instance', () => {
    const config: SimulationConfig = {
      theme: 'rumor',
      agent_count: 10,
      topology: 'small_world',
      tick_rate: 0.5,
      personalities: [],
      seed: 'test',
    };
    
    const engine = new SimulationEngine(config);
    expect(engine).toBeDefined();
    expect(engine.config).toEqual(config);
  });

  it('should have a tick method', () => {
    const config: SimulationConfig = {
      theme: 'rumor',
      agent_count: 10,
      topology: 'small_world',
      tick_rate: 0.5,
      personalities: [],
      seed: 'test',
    };
    
    const engine = new SimulationEngine(config);
    expect(typeof engine.tick).toBeDefined();
    expect(engine.agents).toBeDefined();
  });
});
