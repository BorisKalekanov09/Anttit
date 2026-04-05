import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
import type { PersonalityDef, AnalysisReport, TickMessage, GeminiDecision, EpisodicEntry, ReasoningTrace, RelationshipType, ConversationMessage } from '../types.js';
import { createProvider } from '../lib/providers/factory.js';
import type { ProviderType } from '../lib/model-registry.js';
import { configManager } from '../lib/config-manager.js';

config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function getDefaultModel(modelName?: string) {
  try {
    const activeModels = configManager.getActiveModels();
    const configuredModel = modelName || activeModels?.worldGeneration?.modelId || 'gemini-2.5-flash-lite';
    const { provider: providerType, modelId } = parseModelName(configuredModel);
    
    const apiKey = process.env[`${providerType.toUpperCase()}_API_KEY`] || configManager.getDecryptedKey(providerType);
    if (!apiKey) {
      return genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    }
    
    const provider = createProvider(providerType, { apiKey });
    return provider;
  } catch {
    return genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  }
}

function parseModelName(modelName?: string): { provider: ProviderType; modelId: string } {
  if (!modelName) {
    return { provider: 'google', modelId: 'gemini-2.5-flash-lite' };
  }
  
  if (modelName.includes(':')) {
    const [providerStr, modelId] = modelName.split(':', 2);
    return { provider: providerStr as ProviderType, modelId };
  }
  
  return { provider: 'google', modelId: modelName };
}

function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    const candidate = fenceMatch[1].trim();
    try { JSON.parse(candidate); return candidate; } catch {}
  }

  try { JSON.parse(trimmed); return trimmed; } catch {}

  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '{') {
      for (let j = trimmed.length; j > i; j--) {
        if (trimmed[j] === '}') {
          const candidate = trimmed.slice(i, j + 1);
          try { JSON.parse(candidate); return candidate; } catch {}
        }
      }
    }
  }

  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '[') {
      for (let j = trimmed.length; j > i; j--) {
        if (trimmed[j] === ']') {
          const candidate = trimmed.slice(i, j + 1);
          try { JSON.parse(candidate); return candidate; } catch {}
        }
      }
    }
  }

  return trimmed;
}

export async function generatePersonalities(
  theme: string,
  userDescription: string,
  modelName?: string
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

  try {
    const model = await getDefaultModel(modelName);
    const result = await model.generateContent(prompt);
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
  } catch (error) {
    const errorMsg = String(error);
    const isQuotaError = errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED');
    console.error('[AI] generatePersonalities failed:', errorMsg);
    if (isQuotaError) {
      const err = new Error('API_QUOTA_EXCEEDED');
      (err as any).isQuotaError = true;
      throw err;
    }
    throw error;
  }
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
  personalityName: string,
  modelName?: string
): Promise<string> {
  const eventsText = events.slice(-20).map(e => `- ${e}`).join('\n');
  const prompt = `You are compressing the recent memory of a '${personalityName}' agent.
Recent events:
${eventsText}

Write a 2-3 sentence summary of this agent's recent experience and how it shapes their current outlook.
Be concise. No bullet points.`;

  try {
    const model = await getDefaultModel(modelName);
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    const errorMsg = String(error);
    const isQuotaError = errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED');
    console.error('[AI] compressMemory failed:', errorMsg);
    if (isQuotaError) {
      const err = new Error('API_QUOTA_EXCEEDED');
      (err as any).isQuotaError = true;
      throw err;
    }
    throw error;
  }
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
  value: number,
  modelName?: string
): Promise<string> {
  const prompt = `In a '${theme}' simulation, what does a ${traitName} of ${value}/100 mean for an agent?
One sentence only, concrete and specific.`;

  try {
    const model = await getDefaultModel(modelName);
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    const errorMsg = String(error);
    const isQuotaError = errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED');
    console.error('[AI] traitTooltip failed:', errorMsg);
    if (isQuotaError) {
      const err = new Error('API_QUOTA_EXCEEDED');
      (err as any).isQuotaError = true;
      throw err;
    }
    throw error;
  }
}

export async function generateSeedConfig(
  text: string,
  theme: string,
  availablePersonalities: PersonalityDef[],
  modelName?: string
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

  try {
    const model = await getDefaultModel(modelName);
    const result = await model.generateContent(prompt);
    const responseText = stripMarkdownFences(result.response.text());
    return JSON.parse(responseText);
  } catch (error) {
    const errorMsg = String(error);
    const isQuotaError = errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED');
    console.error('[AI] generateSeedConfig failed:', errorMsg);
    if (isQuotaError) {
      const err = new Error('API_QUOTA_EXCEEDED');
      (err as any).isQuotaError = true;
      throw err;
    }
    throw error;
  }
}

export async function generateInjection(
  description: string,
  theme: string,
  currentStateCounts: Record<string, number>,
  availableEventTypes: string[],
  modelName?: string
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
    const model = await getDefaultModel(modelName);
    const result = await model.generateContent(prompt);
    const responseText = stripMarkdownFences(result.response.text());
    return JSON.parse(responseText);
  } catch (error) {
    const errorMsg = String(error);
    const isQuotaError = errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED');
    
    console.error('[AI] generateInjection failed:', errorMsg);
     
    if (isQuotaError) {
      const err = new Error('API_QUOTA_EXCEEDED');
      (err as any).isQuotaError = true;
      throw err;
    }
    
    return {
      eventType: 'rumour_burst',
      payload: { fraction: 0.05 },
      preview: 'Error processing your scenario. Using default rumor spread (5% of agents). Please try again.',
    };
  }
}

// Helper function to generate role-specific personality prompt
function getRolePersonalityContext(
  role: string,
  traits: { credulity?: number; influence?: number; stubbornness?: number; activity?: number } = {}
): string {
  const credulity = traits.credulity ?? 50;
  const influence = traits.influence ?? 50;
  const stubbornness = traits.stubbornness ?? 50;
  const activity = traits.activity ?? 50;

  const roleContextMap: Record<string, string> = {
    'influencer': `You are an INFLUENCER (high influence ${influence}/100). You naturally lead opinion formation. Your posts are confident, compelling, and designed to sway others. You emphasize your perspective strongly and build on agreement. Credulity: ${credulity}/100.`,
    'skeptic': `You are a SKEPTIC (high stubbornness ${stubbornness}/100). You naturally question dominant narratives. Your posts challenge assumptions, highlight inconsistencies, or present contrary evidence. You're thoughtful but not easily swayed. Credulity: ${credulity}/100.`,
    'bot': `You are a BOT ACCOUNT (neutral stance). You share information more objectively than subjectively. Your posts tend to summarize, report, or ask clarifying questions. You're less emotionally invested but highly active (${activity}/100). Stay somewhat detached.`,
    'follower': `You are a FOLLOWER (influence ${influence}/100). You're influenced by what others are saying. Your posts often build on or agree with existing threads, ask questions, or seek consensus. You're thoughtful and engaged but defer to stronger voices.`,
    'default': `You are a DEFAULT agent. Your posts reflect your genuine beliefs without special bias toward influence or skepticism. Credulity: ${credulity}/100, Activity: ${activity}/100.`,
  };

  return roleContextMap[role] || roleContextMap['default'];
}

export async function generateDiscussionPost(
  agentName: string,
  agentState: string,
  agentBeliefs: Array<{ topic: string; weight: number }>,
  recentMemory: string[],
  theme: string,
  modelName?: string,
  role: string = 'default',
  traits: { credulity?: number; influence?: number; stubbornness?: number; activity?: number } = {}
): Promise<{ title: string; content: string; tags: string[] }> {
  const { provider: providerType, modelId } = parseModelName(modelName);
  
  const topBeliefs = agentBeliefs
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map(b => `${b.topic} (strength: ${(b.weight * 100).toFixed(0)}%)`)
    .join(', ');

  const recentContext = recentMemory.slice(-5).join('. ') || 'Just observing the world around me.';
  const roleContext = getRolePersonalityContext(role, traits);

  const prompt = `You are ${agentName}, an agent in a ${theme}-themed multi-agent simulation.

${roleContext}

Your current emotional/mental state: ${agentState}
Your strongest beliefs right now: ${topBeliefs}
Your recent experiences: ${recentContext}

Write ONE authentic discussion post that:
1. Reflects your genuine current state and beliefs (be specific, not generic)
2. Is 1-3 sentences, conversational and genuine
3. Connects your state to your beliefs and experiences
4. Invites others to think or respond
5. Your communication style should match your role (influencer→commanding, skeptic→questioning, follower→collaborative, bot→informational)
6. Never says "Thinking about" or just repeating state names

Examples of GOOD posts:
- "I've been noticing how quickly people shift their perspective. Makes me wonder if we're really that influenced by those around us."
- "The pattern I'm seeing aligns perfectly with my hypothesis. Anyone else observing this shift?"
- "Can't help but feel there's something deeper going on here. The evidence keeps pointing in the same direction."

Examples of BAD posts (avoid these):
- "Thinking about X..."
- "Right, only when..."
- "Interesting perspective..."

Return ONLY this exact JSON (no markdown, no extra text):
{
  "title": "<compelling title, 5-12 words, specific not generic>",
  "content": "<2-3 sentences, authentic and contextual>",
  "tags": ["${agentState.toLowerCase()}", "<belief topic>", "<theme-relevant>"]
}`;

  try {
    // Get API key for the provider
    const apiKey = process.env[`${providerType.toUpperCase()}_API_KEY`] || configManager.getDecryptedKey(providerType);
    if (!apiKey) {
      throw new Error(`No API key found for ${providerType} provider`);
    }
    
    const provider = createProvider(providerType, { apiKey });
    const response = await provider.generateCompletion(prompt, modelId);
    const parsed = JSON.parse(response.content);
    
    return {
      title: parsed.title || `${agentName} shares thoughts on ${agentState}`,
      content: parsed.content || `I've been reflecting on ${agentState.toLowerCase()} and its impact on all of us.`,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [agentState.toLowerCase()],
    };
  } catch (error) {
    const errorMsg = String(error);
    const isQuotaError = errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('rate limit');
    
    console.error(`[${providerType}] generateDiscussionPost failed:`, errorMsg);
    
    if (isQuotaError) {
      const err = new Error('API_QUOTA_EXCEEDED');
      (err as any).isQuotaError = true;
      throw err;
    }
    
    throw error;
  }
}

/**
 * Simulates a multi-turn conversation between two agents.
 * Returns the message log, the influence impact, the derived relationship type,
 * and an optional state change recommendation for either agent.
 */
export async function simulateConversation(
  agentAId: string,
  agentAName: string,
  agentAState: string,
  agentADesc: string,
  agentATraits: { credulity?: number; influence?: number; stubbornness?: number },
  agentBId: string,
  agentBName: string,
  agentBState: string,
  agentBDesc: string,
  agentBTraits: { credulity?: number; influence?: number; stubbornness?: number },
  theme: string,
  validStates: string[],
  modelName?: string
): Promise<{
  messages: ConversationMessage[];
  influenceImpact: number;
  derivedRelationshipType: RelationshipType;
  stateChange?: { agentId: string; fromState: string; newState: string; reason: string };
}> {
  const { provider: providerType, modelId } = parseModelName(modelName);
  const statesStr = validStates.join(', ');

  const prompt = `You are simulating a direct conversation between two agents in a "${theme}" simulation.

Agent A: ${agentAName} (state: ${agentAState})
  - Description: ${agentADesc}
  - Credulity: ${agentATraits.credulity ?? 50}/100, Stubbornness: ${agentATraits.stubbornness ?? 50}/100, Influence: ${agentATraits.influence ?? 50}/100

Agent B: ${agentBName} (state: ${agentBState})
  - Description: ${agentBDesc}
  - Credulity: ${agentBTraits.credulity ?? 50}/100, Stubbornness: ${agentBTraits.stubbornness ?? 50}/100, Influence: ${agentBTraits.influence ?? 50}/100

Simulate a 3-4 turn realistic conversation. Each message must reflect the agent's personality and current state.
Valid states for this theme: ${statesStr}

Then decide:
- influenceImpact: 0.0-1.0 (how strongly did this conversation affect beliefs?)
- derivedRelationshipType: one of INFLUENCES, DISAGREES_WITH, SUPPORTS, RELATES_TO
- stateChange: if the conversation would logically cause one agent to change state, include it

Return ONLY this JSON (no markdown):
{
  "messages": [
    {"agentId": "${agentAId}", "agentName": "${agentAName}", "content": "...", "turn": 1},
    {"agentId": "${agentBId}", "agentName": "${agentBName}", "content": "...", "turn": 2},
    {"agentId": "${agentAId}", "agentName": "${agentAName}", "content": "...", "turn": 3},
    {"agentId": "${agentBId}", "agentName": "${agentBName}", "content": "...", "turn": 4}
  ],
  "influenceImpact": <0.0-1.0>,
  "derivedRelationshipType": "<INFLUENCES|DISAGREES_WITH|SUPPORTS|RELATES_TO>",
  "stateChange": {
    "agentId": "<agentAId or agentBId>",
    "fromState": "<current state>",
    "newState": "<valid state from the list>",
    "reason": "<one sentence why>"
  }
}

Only include stateChange if the conversation genuinely warrants it. Omit the field entirely if no state change occurs.`;

  try {
    const apiKey = process.env[`${providerType.toUpperCase()}_API_KEY`] || configManager.getDecryptedKey(providerType);
    if (!apiKey) throw new Error(`No API key for ${providerType}`);

    const provider = createProvider(providerType, { apiKey });
    const response = await provider.generateCompletion(prompt, modelId);
    const parsed = JSON.parse(stripMarkdownFences(response.content));

    const validRelTypes: RelationshipType[] = ['INFLUENCES', 'DISAGREES_WITH', 'SUPPORTS', 'RELATES_TO'];
    const relType: RelationshipType = validRelTypes.includes(parsed.derivedRelationshipType)
      ? parsed.derivedRelationshipType
      : 'RELATES_TO';

    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      influenceImpact: typeof parsed.influenceImpact === 'number'
        ? Math.min(1, Math.max(0, parsed.influenceImpact))
        : 0.3,
      derivedRelationshipType: relType,
      stateChange: parsed.stateChange && validStates.includes(parsed.stateChange.newState)
        ? parsed.stateChange
        : undefined,
    };
  } catch (error) {
    const errorMsg = String(error);
    const isQuotaError = errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('rate limit');
    console.error(`[${providerType}] simulateConversation failed:`, errorMsg);
    if (isQuotaError) {
      const err = new Error('API_QUOTA_EXCEEDED');
      (err as any).isQuotaError = true;
      throw err;
    }
    // Fallback: simple two-message exchange
    return {
      messages: [
        { agentId: agentAId, agentName: agentAName, content: `I've been thinking about ${agentAState} lately.`, turn: 1 },
        { agentId: agentBId, agentName: agentBName, content: `Interesting. From my perspective of ${agentBState}, I see it differently.`, turn: 2 },
      ],
      influenceImpact: 0.1,
      derivedRelationshipType: agentAState === agentBState ? 'SUPPORTS' : 'RELATES_TO',
    };
  }
}

export async function generateCommentText(
  agentName: string,
  agentState: string,
  agentBeliefs: Array<{ topic: string; weight: number }>,
  postTitle: string,
  postContent: string,
  postAuthor: string,
  theme: string,
  modelName?: string,
  role: string = 'default',
  traits: { credulity?: number; influence?: number; stubbornness?: number; activity?: number } = {}
): Promise<string> {
  const { provider: providerType, modelId } = parseModelName(modelName);
  
  const topBeliefs = agentBeliefs
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map(b => `${b.topic}`)
    .join(', ');

  const roleContext = getRolePersonalityContext(role, traits);

  const prompt = `You are ${agentName}, an agent in a ${theme}-themed simulation. Your current state: ${agentState}. Your beliefs: ${topBeliefs}.

${roleContext}

Someone just posted: "${postTitle}" - "${postContent}"

Write a SHORT, GENUINE comment (1-2 sentences max) that:
1. Shows you actually read and understood their post
2. Reflects YOUR beliefs and perspective on what they said
3. Either agrees, disagrees thoughtfully, or adds new insight
4. Is conversational, NOT generic ("Interesting perspective..." is forbidden)
5. Your tone should match your role:
   - Influencer: Lead or redirect the conversation, build on strong agreement
   - Skeptic: Question assumptions, highlight what they might be missing
   - Follower: Ask questions, build on their ideas, seek common ground
   - Bot: Provide relevant information or clarification
   - Default: Balanced perspective reflecting your beliefs

Examples of GOOD comments:
- "That's a fair point, but I think you're missing how X actually influences Y."
- "Exactly! This validates what I've been observing too."
- "I'd challenge that - the evidence I'm seeing points in the opposite direction."
- "You're onto something. Have you considered how this connects to Z?"

Return ONLY the comment text, nothing else. 1-2 sentences. No quotes.`;

  try {
    const apiKey = process.env[`${providerType.toUpperCase()}_API_KEY`] || configManager.getDecryptedKey(providerType);
    if (!apiKey) {
      throw new Error(`No API key found for ${providerType} provider`);
    }
    
    const provider = createProvider(providerType, {
      apiKey,
    });
    
    const response = await provider.generateCompletion(prompt, modelId);
    const responseText = response.content.trim();
    
    if (responseText.length < 10) {
      throw new Error('Comment too short');
    }
    
    return responseText;
  } catch (error) {
    const errorMsg = String(error);
    const isQuotaError = errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('rate limit');
    
    console.error(`[${providerType}] generateCommentText failed:`, errorMsg);
    
    if (isQuotaError) {
      const err = new Error('API_QUOTA_EXCEEDED');
      (err as any).isQuotaError = true;
      throw err;
    }
    
    throw error;
  }
}
