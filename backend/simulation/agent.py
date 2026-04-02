from dataclasses import dataclass, field
from collections import deque
from typing import Any


@dataclass
class AgentPersonality:
    name: str
    description: str
    credulity: int       # 0-100
    influence: int       # 0-100
    stubbornness: int    # 0-100
    activity: int        # 0-100
    color: str = "#888888"


@dataclass
class Agent:
    agent_id: str
    personality: AgentPersonality
    state: str
    memory: deque = field(default_factory=lambda: deque(maxlen=40))
    memory_summary: str = ""
    ticks_since_compression: int = 0
    used_gemini_recently: bool = False

    def add_memory(self, event: str):
        self.memory.append(event)

    def traits(self) -> dict:
        return {
            "credulity": self.personality.credulity,
            "influence": self.personality.influence,
            "stubbornness": self.personality.stubbornness,
            "activity": self.personality.activity,
        }
