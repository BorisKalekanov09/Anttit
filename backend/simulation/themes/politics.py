"""
Political Polarization Theme
States: far_left, left, center, right, far_right
"""
import random

STATES = ["far_left", "left", "center", "right", "far_right"]
INITIAL_STATE = "center"
SEED_STATE = "center"
SEED_FRACTION = 1.0

_SPECTRUM = ["far_left", "left", "center", "right", "far_right"]


def seed_states(agents: dict) -> None:
    ids = list(agents.keys())
    for aid in ids:
        # Start with a normal distribution around center
        idx = int(random.gauss(2, 1.2))
        idx = max(0, min(4, idx))
        agents[aid].state = _SPECTRUM[idx]


def rule_decision(agent, neighbor_states: list[str]) -> tuple[str, str]:
    state = agent.state
    traits = agent.traits()
    current_idx = _SPECTRUM.index(state)

    if not neighbor_states:
        return state, "no neighbors"

    # Compute average neighbor position
    neighbor_idxs = []
    for s in neighbor_states:
        if s in _SPECTRUM:
            neighbor_idxs.append(_SPECTRUM.index(s))
    if not neighbor_idxs:
        return state, "neighbors have unknown states"

    avg_neighbor = sum(neighbor_idxs) / len(neighbor_idxs)
    pull = avg_neighbor - current_idx  # positive = pull right, negative = pull left

    conformity = traits["credulity"] / 100.0
    stubbornness = traits["stubbornness"] / 100.0

    # High conformity pulls toward neighbors; high stubbornness resists
    effective_pull = pull * conformity * (1.0 - stubbornness * 0.7)

    # Echo chamber effect: if most neighbors agree, conformity is amplified
    dominant = max(set(neighbor_states), key=neighbor_states.count)
    if neighbor_states.count(dominant) / len(neighbor_states) > 0.7:
        effective_pull *= 1.5

    if abs(effective_pull) > 0.5 and random.random() < 0.3:
        new_idx = current_idx + (1 if effective_pull > 0 else -1)
        new_idx = max(0, min(4, new_idx))
        new_state = _SPECTRUM[new_idx]
        if new_state != state:
            direction = "right" if effective_pull > 0 else "left"
            return new_state, f"neighbor pressure shifted opinion {direction}"

    return state, "maintained current position"


def is_ambiguous(agent, neighbor_states: list[str]) -> bool:
    if not neighbor_states:
        return False
    idxs = [_SPECTRUM.index(s) for s in neighbor_states if s in _SPECTRUM]
    if not idxs:
        return False
    variance = sum((i - sum(idxs) / len(idxs)) ** 2 for i in idxs) / len(idxs)
    return variance > 1.0  # High variance = ambiguous situation


VALID_STATES = STATES
THEME_NAME = "Political Polarization"
THEME_DESCRIPTION = "Agents shift political opinions as they interact with neighbors in an ideological landscape."
STATE_COLORS = {
    "far_left": "#1d4ed8",
    "left": "#60a5fa",
    "center": "#a855f7",
    "right": "#f97316",
    "far_right": "#b91c1c",
}
