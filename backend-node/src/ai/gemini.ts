import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
import type { PersonalityDef, AnalysisReport, TickMessage, GeminiDecision, EpisodicEntry, ReasoningTrace } from '../types.js';

config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const defaultModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

function stripMarkdownFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    const parts = cleaned.split('```');
    cleaned = parts[1] || cleaned;
    if (cleaned.startsWith('json')) {
      cleaned = cleaned.slice(4);
    }
  }
  return cleaned.trim();
}

export async function generatePersonalities(
  theme: string,
  userDescription: string
): Promise<PersonalityDef[]> {
  const prompt = `You are designing agent personalities for a multi-agent simulation.

Theme: ${theme}
User's description: ${userDescription}

Return a JSON array of 3-6 personality types. Each must have:
- name (string): short memorable name like "Skeptic" or "Influencer"  
- description (string): 1-2 sentences describing how this agent behaves in the ${theme} scenario
- credulity (int 0-100): how easily they believe/accept new information
- influence (int 0-100): how strongly they affect neighbors
- stubbornness (int 0-100): resistance to changing their state
- activity (int 0-100): how often they initiate interactions
- suggested_percentage (int): fraction of population (all must sum to 100)
- color (string): a vibrant hex color like "#e74c3c"

Return ONLY valid JSON array, no markdown, no explanation.`;

  const result = await defaultModel.generateContent(prompt);
  const text = stripMarkdownFences(result.response.text());
  const personalities: PersonalityDef[] = JSON.parse(text);

  const total = personalities.reduce((sum, p) => sum + p.suggested_percentage, 0);
  if (total !== 100) {
    personalities.forEach(p => {
      p.suggested_percentage = Math.round((p.suggested_percentage * 100) / total);
    });
    const diff = 100 - personalities.reduce((sum, p) => sum + p.suggested_percentage, 0);
    personalities[0].suggested_percentage += diff;
  }

  return personalities;
}

export async function agentDecision(
  agentId: string,
  personalityName: string,
  personalityDesc: string,
  theme: string,
  currentState: string,
  neighborStates: string[],
  memorySummary: string,
  traits: Record<string, number>,
  episodicMemory: EpisodicEntry[],
  emotionalState: number,
  modelName: string
): Promise<GeminiDecision> {
  const model = genAI.getGenerativeModel({ model: modelName });
  const neighborSummary = neighborStates.slice(0, 10).join(', ') || 'none';
  const highImpactMemories = episodicMemory
    .filter(e => e.impact === 'high')
    .slice(-5)
    .map(e => `Tick ${e.tick}: ${e.event} (triggered by ${e.influence})`)
    .join('; ') || 'none';
  const emotionalDesc = emotionalState < -0.3 ? 'fearful/anxious' : 
                        emotionalState > 0.3 ? 'confident/optimistic' : 'neutral';
  
  const prompt = `You are agent ${agentId} in a '${theme}' simulation.
Personality: ${personalityName} — ${personalityDesc}
Traits: credulity=${traits.credulity ?? 50}, stubbornness=${traits.stubbornness ?? 50}
Current state: ${currentState}
Neighbors' states: ${neighborSummary}
Memory: ${memorySummary || 'No notable history yet.'}
Key experiences: ${highImpactMemories}
Emotional state: ${emotionalDesc} (${emotionalState.toFixed(2)})

Decide your action this tick. Reply with ONLY a JSON object:
{
  "action": "<stay|change>",
  "new_state": "<valid state name>",
  "reason": "<one sentence spoken as a quote or inner thought>",
  "confidence": <0.0-1.0>,
  "emotional_shift": <optional number between -0.2 and 0.2>,
  "reasoning_trace": {
    "personality_influence": "<how your personality shapes this decision in one sentence>",
    "memory_influence": "<what past experiences affect this in one sentence>",
    "social_pressure": "<how neighbors influence you in one sentence>",
    "emotional_state_impact": "<how your emotional state affects the decision in one sentence>"
  }
}`;

  const result = await model.generateContent(prompt);
  const text = stripMarkdownFences(result.response.text());
  const parsed = JSON.parse(text);
  // Ensure reasoning_trace fields are strings (Gemini sometimes returns objects)
  if (parsed.reasoning_trace) {
    const rt = parsed.reasoning_trace as Record<string, unknown>;
    const rtTyped: ReasoningTrace = {
      personality_influence: String(rt.personality_influence ?? ''),
      memory_influence: String(rt.memory_influence ?? ''),
      social_pressure: String(rt.social_pressure ?? ''),
      emotional_state_impact: String(rt.emotional_state_impact ?? ''),
    };
    parsed.reasoning_trace = rtTyped;
  }
  return parsed as GeminiDecision;
}

export async function compressMemory(
  events: string[],
  personalityName: string
): Promise<string> {
  const eventsText = events.slice(-20).map(e => `- ${e}`).join('\n');
  const prompt = `You are compressing the recent memory of a '${personalityName}' agent.
Recent events:
${eventsText}

Write a 2-3 sentence summary of this agent's recent experience and how it shapes their current outlook.
Be concise. No bullet points.`;

  const result = await defaultModel.generateContent(prompt);
  return result.response.text().trim();
}

export async function generateAnalysis(
  theme: string,
  personalityNames: string[],
  metricsHistory: TickMessage[],
  modelName: string,
  seedText?: string
): Promise<AnalysisReport> {
  const analysisModel = genAI.getGenerativeModel({ model: modelName });
  const totalTicks = metricsHistory.length;
  const first = metricsHistory[0] || {};
  const last = metricsHistory[metricsHistory.length - 1] || {};
  
  const peak: Record<string, number> = {};
  for (const m of metricsHistory) {
    for (const [k, v] of Object.entries(m.state_counts || {})) {
      if (typeof v === 'number') {
        peak[k] = Math.max(peak[k] || 0, v);
      }
    }
  }

  const seedContext = seedText 
    ? `\nThis simulation was seeded from a real-world scenario: "${seedText}". Compare the simulation outcome to this real-world precedent.`
    : '';

  const prompt = `Analyze this completed multi-agent simulation and return a structured JSON report.

Theme: ${theme}
Personality types: ${personalityNames.join(', ')}
Total ticks: ${totalTicks}
Initial state distribution: ${JSON.stringify(first.state_counts || {})}
Final state distribution: ${JSON.stringify(last.state_counts || {})}
Peak values per state: ${JSON.stringify(peak)}${seedContext}

Return a JSON object with this exact structure:
{
  "summary": "2-3 sentence executive summary of what happened",
  "timeline": "Key turning points with tick numbers referenced",
  "personalities": {"PersonalityName": "Analysis of how this personality type behaved", ...},
  "realWorldParallel": "Metaphor or analogy to real-world events",
  "recommendations": ["Actionable insight 1", "Actionable insight 2", "Actionable insight 3"]
}

Return ONLY valid JSON, no markdown.`;

  try {
    const result = await analysisModel.generateContent(prompt);
    const text = stripMarkdownFences(result.response.text());
    return JSON.parse(text);
  } catch (error) {
    const errorMsg = String(error);
    const isQuotaError = errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED');
    
    console.error('[Gemini Error] generateAnalysis failed:', errorMsg);
    
    // Return safe fallback report
    return {
      summary: isQuotaError 
        ? 'Analysis unavailable: API quota exceeded. The simulation ran successfully, but detailed analysis could not be generated at this time.'
        : 'Analysis unavailable: An error occurred during AI analysis. The simulation completed, but results could not be processed.',
      timeline: 'Simulation ran for ' + totalTicks + ' ticks with state distributions tracked throughout.',
      personalities: Object.fromEntries(personalityNames.map(name => [name, 'Data collected but analysis unavailable.'])),
      realWorldParallel: 'Unable to generate real-world parallel analysis at this time.',
      recommendations: [
        'Review the raw simulation metrics in the timeline view.',
        'Check the API status if quota errors persist.',
        'Try again later if this is a temporary service issue.'
      ],
    };
  }
}

export async function traitTooltip(
  traitName: string,
  theme: string,
  value: number
): Promise<string> {
  const prompt = `In a '${theme}' simulation, what does a ${traitName} of ${value}/100 mean for an agent?
One sentence only, concrete and specific.`;

  const result = await defaultModel.generateContent(prompt);
  return result.response.text().trim();
}

export async function generateSeedConfig(
  text: string,
  theme: string,
  availablePersonalities: PersonalityDef[]
): Promise<{
  agent_count: number;
  initial_state_distribution: Record<string, number>;
  personality_mix: Record<string, number>;
  seed_fraction: number;
}> {
  const personalityNames = availablePersonalities.map(p => p.name);
  
  const prompt = `You are translating a real-world scenario description into simulation parameters.

Scenario: "${text}"
Theme: ${theme}
Available personality types: ${personalityNames.join(', ')}

Based on this real-world scenario, suggest simulation parameters. Return a JSON object:
{
  "agent_count": <number between 50-500 based on scenario scale>,
  "initial_state_distribution": {"state_name": <percentage>, ...},
  "personality_mix": {"PersonalityName": <percentage>, ...},
  "seed_fraction": <0.01-0.3 indicating how concentrated the initial "outbreak" is>
}

Return ONLY valid JSON, no markdown.`;

  const result = await defaultModel.generateContent(prompt);
  const responseText = stripMarkdownFences(result.response.text());
  return JSON.parse(responseText);
}

export async function generateInjection(
  description: string,
  theme: string,
  currentStateCounts: Record<string, number>,
  availableEventTypes: string[]
): Promise<{
  eventType: string;
  payload: Record<string, unknown>;
  preview: string;
}> {
  const prompt = `You are translating a natural language event description into a simulation injection.

User's description: "${description}"
Theme: ${theme}
Current state distribution: ${JSON.stringify(currentStateCounts)}
Available event types: ${availableEventTypes.join(', ')}

Available event types and their meanings:
- rumour_burst: Seed a percentage of agents with the spreading state
- reset_random: Randomize some agents' states
- authority_speaks: Simulate official announcement, raises skepticism/resistance
- viral_moment: Sudden exponential spread in a random cluster
- network_split: Remove edges between agent clusters (create echo chambers)
- mass_recovery: Trigger recovery in a cluster

Return a JSON object:
{
  "eventType": "<one of the available event types>",
  "payload": {<event-specific parameters>},
  "preview": "<human-readable description of what will happen>"
}

Return ONLY valid JSON, no markdown.`;

  try {
    const result = await defaultModel.generateContent(prompt);
    const responseText = stripMarkdownFences(result.response.text());
    return JSON.parse(responseText);
  } catch (error) {
    const errorMsg = String(error);
    const isQuotaError = errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED');
    
    console.error('[Gemini Error] generateInjection failed:', errorMsg);
    
    return {
      eventType: 'rumour_burst',
      payload: { fraction: 0.05 },
      preview: isQuotaError
        ? 'API quota exceeded. Using default rumor spread (5% of agents). Describe another scenario to continue.'
        : 'Error processing your scenario. Using default rumor spread (5% of agents). Please try again.',
    };
  }
}
