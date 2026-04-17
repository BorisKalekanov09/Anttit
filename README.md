# TuesFest 2026

A full-stack multi-agent AI simulation platform for festival event management — featuring real-time agent networking, force-directed graph visualization, and AI-driven scenario analysis powered by Google Gemini.

## Overview

TuesFest 2026 provides an interactive environment for simulating and analyzing complex agent behaviors within a festival context. Users can configure agent personalities, observe live interactions over WebSocket, replay historical runs, and compare simulation outcomes side by side — all through a responsive React dashboard.

## Features

- **Live Simulation** — Real-time multi-agent interactions streamed via WebSocket
- **Agent Network Graph** — Force-directed visualization using D3 and react-force-graph
- **AI-Powered Analysis** — Gemini-backed scenario generation, agent reasoning, and breakdown reports
- **Comparison Mode** — Side-by-side analysis of multiple simulation runs
- **World Builder** — Step-wizard interface for configuring simulation topology and agent properties
- **Personality Manager** — Define and assign behavioral profiles to agents
- **Replay Controls** — Scrub through and replay recorded simulation sessions
- **System Console** — Live event log with filtering and structured output

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Visualization | D3 v7, Chart.js, react-force-graph-2d |
| Backend | Node.js, Express, WebSocket (`ws`) |
| AI | Google Gemini (`@google/generative-ai`) |
| Graph Engine | Graphology + ForceAtlas2 layout |
| Validation | Zod |
| Testing | Vitest |

## Project Structure

```
TuesFest2026/
├── frontend/               # React + TypeScript client
│   └── src/
│       ├── components/     # UI components (graph, panels, modals, etc.)
│       ├── pages/          # Route-level pages (Live, Analysis, Config, etc.)
│       ├── hooks/          # Custom React hooks
│       └── types/          # Shared TypeScript types
└── backend-node/           # Node.js simulation engine
    └── src/
        ├── ai/             # Gemini AI integration
        ├── simulation/     # Agent simulation logic
        ├── routes/         # Express API routes
        ├── store/          # In-memory state management
        ├── lib/            # Utilities and helpers
        └── middleware/     # Express middleware
```

## Getting Started

### Prerequisites

- Node.js 18+
- A [Google AI Studio](https://aistudio.google.com) API key

### Backend

```bash
cd backend-node
cp .env.example .env        # Add your GEMINI_API_KEY
npm install
npm run dev                 # Starts on port 3003
```

### Frontend

```bash
cd frontend
npm install
npm run dev                 # Starts on http://localhost:5173
```

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key | — |
| `PORT` | Backend server port | `3003` |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Production build |
| `npm run test` | Run test suite (Vitest) |
| `npm run typecheck` | TypeScript type checking |

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
