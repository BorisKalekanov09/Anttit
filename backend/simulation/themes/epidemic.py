"""
Epidemic Theme
States: healthy → exposed → infected → recovered → dead
"""
import random

STATES = ["healthy", "exposed", "infected", "recovered", "dead"]
INITIAL_STATE = "healthy"
SEED_STATE = "infected"
SEED_FRACTION = 0.03

TRANSMISSION_RATE = 0.4
INCUBATION_TICKS = 3
RECOVERY_RATE = 0.08
DEATH_RATE = 0.01


def seed_states(agents: dict) -> None:
    ids = list(agents.keys())
    random.shuffle(ids)
    seed_count = max(1, int(len(ids) * SEED_FRACTION))
    for i, aid in enumerate(ids):
        agents[aid].state = SEED_STATE if i < seed_count else INITIAL_STATE


def rule_decision(agent, neighbor_states: list[str]) -> tuple[str, str]:
    state = agent.state
    traits = agent.traits()

    if state == "healthy":
        infected_neighbors = neighbor_states.count("infected") + neighbor_states.count("exposed")
        total = len(neighbor_states) or 1
        pressure = infected_neighbors / total
        immune_factor = 1.0 - traits["stubbornness"] / 200.0
        if random.random() < pressure * TRANSMISSION_RATE * immune_factor:
            return "exposed", f"contacted infected neighbor (pressure {pressure:.0%})"
        return "healthy", "avoided infection"

    elif state == "exposed":
        credulity_factor = traits["credulity"] / 100.0
        if random.random() < (0.2 + credulity_factor * 0.1):
            return "infected", "incubation period ended — symptomatic"
        return "exposed", "still incubating"

    elif state == "infected":
        if random.random() < DEATH_RATE:
            return "dead", "succumbed to illness"
        if random.random() < RECOVERY_RATE:
            return "recovered", "immune system prevailed"
        return "infected", "still sick"

    elif state == "recovered":
        return "recovered", "immune — recovered"

    elif state == "dead":
        return "dead", "deceased"

    return state, "no change"


def is_ambiguous(agent, neighbor_states: list[str]) -> bool:
    if not neighbor_states or agent.state not in ("healthy", "exposed"):
        return False
    infected = neighbor_states.count("infected") + neighbor_states.count("exposed")
    pressure = infected / len(neighbor_states)
    return 0.25 <= pressure <= 0.65


VALID_STATES = STATES
THEME_NAME = "Epidemic"
THEME_DESCRIPTION = "Agents get sick, recover, or die as disease spreads through contact networks."
STATE_COLORS = {
    "healthy": "#22c55e",
    "exposed": "#f59e0b",
    "infected": "#ef4444",
    "recovered": "#3b82f6",
    "dead": "#374151",
}
