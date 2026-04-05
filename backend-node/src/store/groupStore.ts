/**
 * Group Store
 * Persists agent groups and their private chat messages to disk per simulation.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { AgentGroup, GroupMessage } from '../types.js';

const DATA_DIR = path.join(process.cwd(), 'data', 'groups');
const MAX_MSGS_PER_GROUP = 500;

// ── Write Queue ───────────────────────────────────────────────────────────

const writeQueues: Map<string, Promise<void>> = new Map();

function queueWrite(simId: string, fn: () => Promise<void>): Promise<void> {
  const cur = writeQueues.get(simId) || Promise.resolve();
  const next = cur.catch(() => undefined).then(() => fn());
  writeQueues.set(simId, next.catch(() => undefined));
  return next;
}

// ── Storage shape ─────────────────────────────────────────────────────────

interface GroupStorage {
  groups: AgentGroup[];
  messages: GroupMessage[];
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
      console.error('[GroupStore] mkdir error:', err);
    }
  }
}

async function loadFromDisk(simId: string): Promise<GroupStorage> {
  try {
    const raw = await fs.readFile(getFilePath(simId), 'utf-8');
    const data = JSON.parse(raw);
    return {
      groups: Array.isArray(data.groups) ? data.groups : [],
      messages: Array.isArray(data.messages) ? data.messages : [],
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { groups: [], messages: [] };
    console.error('[GroupStore] load error:', err);
    return { groups: [], messages: [] };
  }
}

async function writeToDisk(simId: string, store: GroupStorage): Promise<void> {
  const filePath = getFilePath(simId);
  const tmpPath = `${filePath}.tmp`;
  await ensureDir();
  await fs.writeFile(tmpPath, JSON.stringify(store, null, 2), 'utf-8');
  await fs.rename(tmpPath, filePath);
}

// ── Public API ───────────────────────────────────────────────────────────

export async function getGroups(simId: string): Promise<AgentGroup[]> {
  const store = await loadFromDisk(simId);
  return store.groups;
}

export async function createGroup(simId: string, group: AgentGroup): Promise<AgentGroup> {
  await queueWrite(simId, async () => {
    const store = await loadFromDisk(simId);
    // Avoid duplicates (same sharedBelief + overlapping members)
    const exists = store.groups.some(g => g.id === group.id);
    if (!exists) store.groups.push(group);
    await writeToDisk(simId, store);
  });
  return group;
}

export async function addMember(simId: string, groupId: string, agentId: string): Promise<AgentGroup | null> {
  let updated: AgentGroup | null = null;
  await queueWrite(simId, async () => {
    const store = await loadFromDisk(simId);
    const group = store.groups.find(g => g.id === groupId);
    if (group && !group.memberIds.includes(agentId)) {
      group.memberIds.push(agentId);
      updated = group;
    }
    await writeToDisk(simId, store);
  });
  return updated;
}

export async function removeMember(simId: string, groupId: string, agentId: string): Promise<AgentGroup | null> {
  let updated: AgentGroup | null = null;
  await queueWrite(simId, async () => {
    const store = await loadFromDisk(simId);
    const group = store.groups.find(g => g.id === groupId);
    if (group) {
      group.memberIds = group.memberIds.filter(id => id !== agentId);
      updated = group;
      // Dissolve group if no members remain
      if (group.memberIds.length === 0) {
        store.groups = store.groups.filter(g => g.id !== groupId);
      }
    }
    await writeToDisk(simId, store);
  });
  return updated;
}

export async function appendGroupMessage(simId: string, msg: GroupMessage): Promise<GroupMessage> {
  await queueWrite(simId, async () => {
    const store = await loadFromDisk(simId);
    store.messages.push(msg);
    // Trim per group
    const groupMsgs = store.messages.filter(m => m.groupId === msg.groupId);
    if (groupMsgs.length > MAX_MSGS_PER_GROUP) {
      const oldest = groupMsgs[0];
      const idx = store.messages.findIndex(m => m.id === oldest.id);
      if (idx >= 0) store.messages.splice(idx, 1);
    }
    await writeToDisk(simId, store);
  });
  return msg;
}

export async function getGroupMessages(simId: string, groupId: string): Promise<GroupMessage[]> {
  const store = await loadFromDisk(simId);
  return store.messages
    .filter(m => m.groupId === groupId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/** Check if a group with this sharedBelief already has these agents in it. */
export async function findExistingGroup(simId: string, sharedBelief: string, memberIds: string[]): Promise<AgentGroup | null> {
  const store = await loadFromDisk(simId);
  return store.groups.find(g =>
    g.sharedBelief === sharedBelief &&
    memberIds.some(id => g.memberIds.includes(id))
  ) || null;
}
