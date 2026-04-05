/**
 * Direct Message Store
 * Persists private agent-to-agent DMs to disk per simulation.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { DirectMessage } from '../types.js';

const DATA_DIR = path.join(process.cwd(), 'data', 'dms');
const MAX_DMS = 2000;

// ── Write Queue ───────────────────────────────────────────────────────────

const writeQueues: Map<string, Promise<void>> = new Map();

function queueWrite(simId: string, fn: () => Promise<void>): Promise<void> {
  const cur = writeQueues.get(simId) || Promise.resolve();
  const next = cur.catch(() => undefined).then(() => fn());
  writeQueues.set(simId, next.catch(() => undefined));
  return next;
}

// ── File Helpers ──────────────────────────────────────────────────────────

function getFilePath(simId: string): string {
  return path.join(DATA_DIR, `${simId}.json`);
}

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
      console.error('[DmStore] mkdir error:', err);
    }
  }
}

async function loadFromDisk(simId: string): Promise<DirectMessage[]> {
  try {
    const raw = await fs.readFile(getFilePath(simId), 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data.dms) ? data.dms : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    console.error('[DmStore] load error:', err);
    return [];
  }
}

async function writeToDisk(simId: string, dms: DirectMessage[]): Promise<void> {
  const filePath = getFilePath(simId);
  const tmpPath = `${filePath}.tmp`;
  await ensureDir();
  await fs.writeFile(tmpPath, JSON.stringify({ dms }, null, 2), 'utf-8');
  await fs.rename(tmpPath, filePath);
}

// ── Public API ───────────────────────────────────────────────────────────

export async function appendDM(simId: string, dm: DirectMessage): Promise<DirectMessage> {
  await queueWrite(simId, async () => {
    const dms = await loadFromDisk(simId);
    dms.push(dm);
    if (dms.length > MAX_DMS) dms.splice(0, dms.length - MAX_DMS);
    await writeToDisk(simId, dms);
  });
  return dm;
}

/** Get all DMs between two agents (in either direction). */
export async function getConversation(simId: string, agentA: string, agentB: string): Promise<DirectMessage[]> {
  const dms = await loadFromDisk(simId);
  return dms.filter(
    dm =>
      (dm.fromAgentId === agentA && dm.toAgentId === agentB) ||
      (dm.fromAgentId === agentB && dm.toAgentId === agentA)
  ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/** Get all DMs for a single agent (inbox + sent). */
export async function getAgentDMs(simId: string, agentId: string): Promise<DirectMessage[]> {
  const dms = await loadFromDisk(simId);
  return dms.filter(dm => dm.fromAgentId === agentId || dm.toAgentId === agentId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function getAllDMs(simId: string): Promise<DirectMessage[]> {
  return loadFromDisk(simId);
}
