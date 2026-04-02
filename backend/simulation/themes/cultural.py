"""
Cultural Trends Theme
States: traditional, curious, early_adopter, trendy, burned_out
"""
import random

STATES = ["traditional", "curious", "early_adopter", "trendy", "burned_out"]
INITIAL_STATE = "traditional"
SEED_STATE = "early_adopter"
SEED_FRACTION = 0.05


def seed_states(agents: dict) -> None:
    ids = list(agents.keys())
    random.shuffle(ids)
    seed_count = max(1, int(len(ids) * SEED_FRACTION))
    for i, aid in enumerate(ids):
        agents[aid].state = SEED_STATE if i < seed_count else INITIAL_STATE


def rule_decision(agent, neighbor_states: list[str]) -> tuple[str, str]:
    state = agent.state
    traits = agent.traits()
    credulity = traits["credulity"] / 100.0
    stubbornness = traits["stubbornness"] / 100.0
    activity = traits["activity"] / 100.0

    trendy_count = neighbor_states.count("trendy") + neighbor_states.count("early_adopter")
    total = len(neighbor_states) or 1
    trend_pressure = trendy_count / total

    if state == "traditional":
        if random.random() < trend_pressure * credulity * 0.4:
            return "curious", "noticed trend in social circle"
        return "traditional", "uninterested in trends"

    elif state == "curious":
        if random.random() < trend_pressure * credulity * 0.5:
            return "early_adopter", "decided to try the trend"
        if random.random() < stubbornness * 0.1:
            return "traditional", "reverted to traditional ways"
        return "curious", "still considering"

    elif state == "early_adopter":
        if trend_pressure > 0.5 and random.random() < activity * 0.3:
            return "trendy", "trend went mainstream"
        return "early_adopter", "still on cutting edge"

    elif state == "trendy":
        if random.random() < 0.05 + (1 - stubbornness) * 0.05:
            return "burned_out", "trend fatigue set in"
        return "trendy", "enjoying the trend"

    elif state == "burned_out":
        if random.random() < stubbornness * 0.03:
            return "traditional", "returned to roots"
        return "burned_out", "exhausted by constant trends"

    return state, "no change"


def is_ambiguous(agent, neighbor_states: list[str]) -> bool:
    if not neighbor_states or agent.state not in ("curious", "traditional"):
        return False
    trendy = neighbor_states.count("trendy") + neighbor_states.count("early_adopter")
    pressure = trendy / len(neighbor_states)
    return 0.3 <= pressure <= 0.6


VALID_STATES = STATES
THEME_NAME = "Cultural Trends"
THEME_DESCRIPTION = "Agents adopt, spread, or abandon cultural trends as they diffuse through social networks."
STATE_COLORS = {
    "traditional": "#78716c",
    "curious": "#a3e635",
    "early_adopter": "#06b6d4",
    "trendy": "#ec4899",
    "burned_out": "#6b7280",
}
