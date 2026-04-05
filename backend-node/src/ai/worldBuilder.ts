import type { BaseProvider } from '../lib/providers/base.js';
import type { PersonalityDef } from '../types.js';

function extractJson(text: string): string {
  const trimmed = text.trim();

  // 1. Try markdown code fences first (handles leading text before the fence too)
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    const candidate = fenceMatch[1].trim();
    try { JSON.parse(candidate); return candidate; } catch {}
  }

  // 2. Try the whole text as-is
  try { JSON.parse(trimmed); return trimmed; } catch {}

  // 3. Walk from each '{' and try to find a valid JSON object
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

  // 4. Walk from each '[' and try to find a valid JSON array
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

export interface WorldConfigRaw {
  topic: string;
  scenario_description: string;
  agent_count: number;
  duration: number;
  key_concepts: string[];
  suggested_theme: string;
}

export async function generateWorldConfig(
  provider: BaseProvider,
  modelId: string,
  topic: string
): Promise<WorldConfigRaw> {
  const prompt = `You are designing a multi-agent simulation world.

User's topic: "${topic}"

Generate a JSON response with:
- topic (string): concise simulation title (max 6 words)
- scenario_description (string): 2-3 sentence narrative
- agent_count (number): between 50-300
- duration (number): 60-240 minutes
- key_concepts (string[]): list of 3-5 central concepts or debate points
- suggested_theme (string): one of "epidemic", "misinformation", "politics", or "cultural" — pick the most fitting

Theme meanings:
- epidemic: biological/social contagion, health behaviors, panic spreading
- misinformation: false information spreading, rumours, belief correction
- politics: political opinion shifts, voting, policy debates, polarization
- cultural: adoption of ideas, trends, cultural movements, social change

Return ONLY valid JSON, no markdown.`;

  try {
    const result = await provider.generateCompletion(prompt, modelId, {
      temperature: 0.7,
      maxTokens: 1200,
    });
    const text = extractJson(result.content);
    return JSON.parse(text);
  } catch (error: unknown) {
    throw error;
  }
}

export async function generatePersonalitiesForWorld(
  provider: BaseProvider,
  modelId: string,
  topic: string,
  concepts: string[]
): Promise<PersonalityDef[]> {
  const prompt = `You are designing agent personalities for a simulation about: "${topic}"

Key debate points: ${concepts.join(', ')}

Generate 5-7 personality archetypes that represent different perspectives on this topic.

Each personality must have:
- name (string): unique short archetype name (e.g., "Progressive Activist", "Conservative Skeptic")
- description (string): how they approach the topic (1-2 sentences)
- credulity (number 0-100): how open they are to new information
- influence (number 0-100): how persuasive they are to others
- stubbornness (number 0-100): resistance to changing views
- activity (number 0-100): how often they engage or speak up
- suggested_percentage (number): integer % of population
- color (string): vibrant hex color like "#ef4444"

Ensure percentages sum to exactly 100.
Return ONLY valid JSON array, no markdown.`;

  try {
    const result = await provider.generateCompletion(prompt, modelId, {
      temperature: 0.8,
      maxTokens: 1500,
    });
    const text = extractJson(result.content);
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
  } catch (error: unknown) {
    throw error;
  }
}

export function getDefaultStateDistribution(suggestedTheme: string): Record<string, number> {
  const defaults: Record<string, Record<string, number>> = {
    epidemic:      { healthy: 0.95, exposed: 0.03, infected: 0.02 },
    misinformation:{ unaware: 0.60, believer: 0.20, skeptic: 0.15, immune: 0.05 },
    politics:      { left: 0.30, center: 0.40, right: 0.30 },
    cultural:      { adopter: 0.10, interested: 0.30, resistant: 0.20, inactive: 0.40 },
  };
  return defaults[suggestedTheme] ?? { default: 1.0 };
}
