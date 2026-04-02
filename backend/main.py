"""
FastAPI main application — TuesFest2026 Multi-Agent Simulation Platform
"""
import asyncio
import json
import uuid
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from simulation.engine import (
    SimulationConfig,
    create_simulation,
    get_simulation,
    list_simulations,
)
from ai import gemini

# ── Pydantic models ────────────────────────────────────────────────────────

class PersonalityModel(BaseModel):
    name: str
    description: str = ""
    credulity: int = 50
    influence: int = 50
    stubbornness: int = 50
    activity: int = 50
    suggested_percentage: int = 50
    color: str = "#888888"


class LaunchRequest(BaseModel):
    theme: str
    agent_count: int = 100
    topology: str = "small_world"
    tick_rate: float = 0.5
    personalities: list[PersonalityModel]


class GeneratePersonalitiesRequest(BaseModel):
    theme: str
    description: str


class TraitTooltipRequest(BaseModel):
    trait: str
    theme: str
    value: int


class InjectEventRequest(BaseModel):
    event_type: str
    payload: dict = {}


class ControlRequest(BaseModel):
    action: str          # pause | resume | stop | set_speed
    tick_rate: float | None = None


# ── App setup ──────────────────────────────────────────────────────────────

app = FastAPI(title="TuesFest2026 Simulation API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── REST endpoints ─────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/themes")
def get_themes():
    return [
        {
            "key": "misinformation",
            "name": "Misinformation Spread",
            "description": "Agents share and believe/disbelieve news as it spreads through their social network.",
            "states": ["unaware", "exposed", "believer", "resistant"],
            "difficulty": "medium",
            "emoji": "📰",
            "state_colors": {"unaware": "#64748b", "exposed": "#f59e0b", "believer": "#ef4444", "resistant": "#22c55e"},
        },
        {
            "key": "epidemic",
            "name": "Epidemic",
            "description": "Agents get sick, recover, or die as disease spreads through contact networks.",
            "states": ["healthy", "exposed", "infected", "recovered", "dead"],
            "difficulty": "simple",
            "emoji": "🦠",
            "state_colors": {"healthy": "#22c55e", "exposed": "#f59e0b", "infected": "#ef4444", "recovered": "#3b82f6", "dead": "#374151"},
        },
        {
            "key": "politics",
            "name": "Political Polarization",
            "description": "Agents shift political opinions as they interact with neighbors in an ideological landscape.",
            "states": ["far_left", "left", "center", "right", "far_right"],
            "difficulty": "complex",
            "emoji": "🗳️",
            "state_colors": {"far_left": "#1d4ed8", "left": "#60a5fa", "center": "#a855f7", "right": "#f97316", "far_right": "#b91c1c"},
        },
        {
            "key": "cultural",
            "name": "Cultural Trends",
            "description": "Agents adopt, spread, or abandon cultural trends as they diffuse through social networks.",
            "states": ["traditional", "curious", "early_adopter", "trendy", "burned_out"],
            "difficulty": "medium",
            "emoji": "🎭",
            "state_colors": {"traditional": "#78716c", "curious": "#a3e635", "early_adopter": "#06b6d4", "trendy": "#ec4899", "burned_out": "#6b7280"},
        },
    ]


@app.post("/api/generate-personalities")
async def generate_personalities(req: GeneratePersonalitiesRequest):
    try:
        personalities = await gemini.generate_personalities(req.theme, req.description)
        return {"personalities": personalities}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/trait-tooltip")
async def trait_tooltip(req: TraitTooltipRequest):
    try:
        text = await gemini.trait_tooltip(req.trait, req.theme, req.value)
        return {"tooltip": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/simulations")
async def launch_simulation(req: LaunchRequest):
    sim_id = str(uuid.uuid4())[:8]
    personalities_raw = [p.model_dump() for p in req.personalities]

    # Normalize percentages
    total = sum(p["suggested_percentage"] for p in personalities_raw)
    if total > 0:
        for p in personalities_raw:
            p["suggested_percentage"] = round(p["suggested_percentage"] * 100 / total)
        diff = 100 - sum(p["suggested_percentage"] for p in personalities_raw)
        personalities_raw[0]["suggested_percentage"] += diff

    config = SimulationConfig(
        sim_id=sim_id,
        theme=req.theme,
        agent_count=min(req.agent_count, 1000),
        topology=req.topology,
        tick_rate=req.tick_rate,
        personalities=personalities_raw,
    )
    engine = create_simulation(config)
    # Run engine in background task
    asyncio.create_task(engine.run())
    return {"sim_id": sim_id}


@app.get("/api/simulations")
def list_sims():
    return {"simulations": list_simulations()}


@app.get("/api/simulations/{sim_id}/snapshot")
def get_snapshot(sim_id: str):
    engine = get_simulation(sim_id)
    if not engine:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return engine.snapshot()


@app.post("/api/simulations/{sim_id}/control")
def control_simulation(sim_id: str, req: ControlRequest):
    engine = get_simulation(sim_id)
    if not engine:
        raise HTTPException(status_code=404, detail="Simulation not found")
    if req.action == "pause":
        engine.pause()
    elif req.action == "resume":
        engine.resume()
    elif req.action == "stop":
        engine.stop()
    elif req.action == "set_speed" and req.tick_rate is not None:
        engine.set_tick_rate(req.tick_rate)
    return {"status": "ok"}


@app.post("/api/simulations/{sim_id}/inject")
def inject_event(sim_id: str, req: InjectEventRequest):
    engine = get_simulation(sim_id)
    if not engine:
        raise HTTPException(status_code=404, detail="Simulation not found")
    engine.inject_event(req.event_type, req.payload)
    return {"status": "ok"}


# ── WebSocket ──────────────────────────────────────────────────────────────

@app.websocket("/ws/{sim_id}")
async def websocket_endpoint(websocket: WebSocket, sim_id: str):
    await websocket.accept()
    engine = get_simulation(sim_id)
    if not engine:
        await websocket.send_text(json.dumps({"error": "Simulation not found"}))
        await websocket.close()
        return

    # Send current init data immediately so frontend doesn't miss it
    await websocket.send_text(json.dumps(engine.get_init_data()))

    queue = engine.subscribe()
    try:
        while True:
            # Drain queue messages and send to client
            try:
                msg = queue.get_nowait()
                await websocket.send_text(json.dumps(msg))
            except asyncio.QueueEmpty:
                # Wait briefly before next check
                await asyncio.sleep(0.016)  # ~60fps drain rate
    except WebSocketDisconnect:
        engine.unsubscribe(queue)
    except Exception:
        engine.unsubscribe(queue)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
