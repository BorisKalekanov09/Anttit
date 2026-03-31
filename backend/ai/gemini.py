import os
import json
import asyncio
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))
_model = genai.GenerativeModel("gemini-2.5-flash-lite")


async def generate_personalities(theme: str, user_description: str) -> list[dict]:
    """Generate personality definitions for the given theme."""
    prompt = f"""You are designing agent personalities for a multi-agent simulation.

Theme: {theme}
User's description: {user_description}

Return a JSON array of 3-6 personality types. Each must have:
- name (string): short memorable name like "Skeptic" or "Influencer"  
- description (string): 1-2 sentences describing how this agent behaves in the {theme} scenario
- credulity (int 0-100): how easily they believe/accept new information
- influence (int 0-100): how strongly they affect neighbors
- stubbornness (int 0-100): resistance to changing their state
- activity (int 0-100): how often they initiate interactions
- suggested_percentage (int): fraction of population (all must sum to 100)
- color (string): a vibrant hex color like "#e74c3c"

Return ONLY valid JSON array, no markdown, no explanation."""

    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None, lambda: _model.generate_content(prompt)
    )
    text = response.text.strip()
    # strip possible markdown fences
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    personalities = json.loads(text.strip())
    # Normalize percentages to sum to 100
    total = sum(p["suggested_percentage"] for p in personalities)
    if total != 100:
        for p in personalities:
            p["suggested_percentage"] = round(p["suggested_percentage"] * 100 / total)
        # Fix rounding drift
        diff = 100 - sum(p["suggested_percentage"] for p in personalities)
        personalities[0]["suggested_percentage"] += diff
    return personalities


async def agent_decision(
    agent_id: str,
    personality_name: str,
    personality_desc: str,
    theme: str,
    current_state: str,
    neighbor_states: list[str],
    memory_summary: str,
    traits: dict,
) -> dict:
    """Ask Gemini to decide what action an agent takes this tick."""
    neighbor_summary = ", ".join(neighbor_states[:10]) if neighbor_states else "none"
    prompt = f"""You are agent {agent_id} in a '{theme}' simulation.
Personality: {personality_name} — {personality_desc}
Traits: credulity={traits.get('credulity',50)}, stubbornness={traits.get('stubbornness',50)}
Current state: {current_state}
Neighbors' states: {neighbor_summary}
Memory: {memory_summary or 'No notable history yet.'}

Decide your action this tick. Reply with ONLY a JSON object:
{{"action": "<stay|change>", "new_state": "<valid state name>", "reason": "<one sentence spoken as a quote or inner thought expressing your communication>"}}"""

    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None, lambda: _model.generate_content(prompt)
    )
    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


async def compress_memory(events: list[str], personality_name: str) -> str:
    """Compress a list of recent events into a 2-3 sentence memory summary."""
    events_text = "\n".join(f"- {e}" for e in events[-20:])
    prompt = f"""You are compressing the recent memory of a '{personality_name}' agent.
Recent events:
{events_text}

Write a 2-3 sentence summary of this agent's recent experience and how it shapes their current outlook.
Be concise. No bullet points."""

    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None, lambda: _model.generate_content(prompt)
    )
    return response.text.strip()


async def generate_analysis(
    theme: str,
    personality_names: list[str],
    metrics_history: list[dict],
) -> str:
    """Generate end-of-simulation analysis paragraph."""
    # Summarise metrics history
    total_ticks = len(metrics_history)
    first = metrics_history[0] if metrics_history else {}
    last = metrics_history[-1] if metrics_history else {}
    peak = {}
    for m in metrics_history:
        for k, v in m.get("state_counts", {}).items():
            if isinstance(v, (int, float)):
                peak[k] = max(peak.get(k, 0), v)

    prompt = f"""Analyse this completed multi-agent simulation and write 2-3 paragraphs.

Theme: {theme}
Personality types: {', '.join(personality_names)}
Total ticks: {total_ticks}
Initial state distribution: {json.dumps(first.get('state_counts', {}))}
Final state distribution: {json.dumps(last.get('state_counts', {}))}
Peak values per state: {json.dumps(peak)}

Explain what patterns emerged, why they happened (reference agent personality types), 
and what insight this provides about real-world {theme}. Be engaging and specific."""

    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None, lambda: _model.generate_content(prompt)
    )
    return response.text.strip()


async def trait_tooltip(trait_name: str, theme: str, value: int) -> str:
    """One-sentence contextual tooltip for a trait slider."""
    prompt = f"""In a '{theme}' simulation, what does a {trait_name} of {value}/100 mean for an agent?
One sentence only, concrete and specific."""
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None, lambda: _model.generate_content(prompt)
    )
    return response.text.strip()
