import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

import themesRouter from './routes/themes.js';
import simulationsRouter from './routes/simulations.js';
import personalitiesRouter from './routes/personalities.js';
import modelsRouter from './routes/models.js';
import traitsRouter from './routes/traits.js';
import seedRouter from './routes/seed.js';
import whatifRouter from './routes/whatif.js';
import feedRouter from './routes/feed.js';
import agentsRouter from './routes/agents.js';
import worldBuilderRouter from './routes/worldBuilder.js';
import configRouter from './routes/config.js';
import dmRouter from './routes/dm.js';
import groupsRouter from './routes/groups.js';
import analysisRouter from './routes/analysis.js';
import { viewerIdMiddleware } from './middleware/viewerId.js';
import { getSimulation } from './simulation/registry.js';
import { configManager } from './lib/config-manager.js';

config();

// Load persisted provider configs from disk
configManager.loadFromDisk();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Viewer-Id');
  next();
});

app.options('*', (_req, res) => {
  res.sendStatus(200);
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// List all saved analysis run IDs
app.get('/api/analyses', async (_req, res) => {
  try {
    const dir = path.join(process.cwd(), 'data', 'analysis');
    const files = await fs.readdir(dir).catch(() => [] as string[]);
    const ids = files.filter((f: string) => f.endsWith('.json')).map((f: string) => f.replace('.json', ''));
    res.json({ ids });
  } catch {
    res.json({ ids: [] });
  }
});

app.use('/api/themes', themesRouter);
app.use('/api/simulations', simulationsRouter);
app.use('/api/generate-personalities', personalitiesRouter);
app.use('/api/models', modelsRouter);
app.use('/api/trait-tooltip', traitsRouter);
app.use('/api/seed', seedRouter);
app.use('/api/simulations/:simId/whatif', whatifRouter);
app.use('/api/simulations/:simId/feed', viewerIdMiddleware, feedRouter);
app.use('/api/simulations/:simId/agents', viewerIdMiddleware, agentsRouter);
app.use('/api/world-builder', worldBuilderRouter);
app.use('/api/config', configRouter);
app.use('/api/simulations/:simId/dms', dmRouter);
app.use('/api/simulations/:simId/groups', groupsRouter);
app.use('/api/simulations/:simId/analysis', analysisRouter);

const server = createServer(app);

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = request.url || '';
  const match = url.match(/^\/ws\/([a-zA-Z0-9-]+)$/);
  
  if (!match) {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
    return;
  }

  const simId = match[1];
  const engine = getSimulation(simId);
  
  if (!engine) {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request, simId, engine);
  });
});

wss.on('connection', (ws: WebSocket, _request: any, simId: string, engine: any) => {
  const send = (msg: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  };

  engine.subscribe(send);
  ws.send(JSON.stringify(engine.getInitData()));

  // Heartbeat: ping every 15s; terminate if pong not received in time
  (ws as any).isAlive = true;
  ws.on('pong', () => { (ws as any).isAlive = true; });

  const pingInterval = setInterval(() => {
    if (!(ws as any).isAlive) {
      clearInterval(pingInterval);
      ws.terminate();
      return;
    }
    (ws as any).isAlive = false;
    ws.ping();
  }, 15000);

  ws.on('close', () => {
    clearInterval(pingInterval);
    engine.unsubscribe(send);
  });

  ws.on('error', () => {
    clearInterval(pingInterval);
    engine.unsubscribe(send);
  });
});

server.listen(PORT, () => {
  console.log(`TuesFest2026 Node.js backend running on port ${PORT}`);
  console.log(`REST API: http://localhost:${PORT}/api`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws/:simId`);
});

export { app, server };
