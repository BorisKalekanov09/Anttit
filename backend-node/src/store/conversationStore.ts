/**
 * Conversation Store
 * Persists multi-turn agent conversations to disk per simulation.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { ConversationLog } from '../types.js';

const DATA_DIR = path.join(process.cwd(), 'data', 'conversations');
const MAX_CONVERSATIONS = 500;

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
      console.error('[ConversationStore] mkdir error:', err);
    }
  }
}

async function loadFromDisk(simId: string): Promise<ConversationLog[]> {
  try {
    const raw = await fs.readFile(getFilePath(simId), 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data.conversations) ? data.conversations : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    console.error('[ConversationStore] load error:', err);
    return [];
  }
}

async function saveToDisk(simId: string, conversations: ConversationLog[]): Promise<void> {
  await ensureDir();
  const filePath = getFilePath(simId);
  const tmpPath = filePath + '.tmp';
  const data = JSON.stringify({ conversations }, null, 2);

  let retries = 3;
  while (retries > 0) {
    try {
      await fs.writeFile(tmpPath, data, 'utf-8');
      await fs.rename(tmpPath, filePath);
      return;
    } catch (err) {
      retries--;
      if (retries === 0) {
        console.error('[ConversationStore] save error:', err);
      } else {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────

export async function appendConversation(simId: string, conversation: ConversationLog): Promise<ConversationLog> {
  return new Promise((resolve, reject) => {
    queueWrite(simId, async () => {
      try {
        const conversations = await loadFromDisk(simId);
        conversations.push(conversation);
        const trimmed = conversations.length > MAX_CONVERSATIONS
          ? conversations.slice(-MAX_CONVERSATIONS)
          : conversations;
        await saveToDisk(simId, trimmed);
        resolve(conversation);
      } catch (err) {
        reject(err);
      }
    });
  });
}

export async function getConversations(simId: string): Promise<ConversationLog[]> {
  return loadFromDisk(simId);
}

export async function getConversationsBetween(
  simId: string,
  agentAId: string,
  agentBId: string
): Promise<ConversationLog[]> {
  const all = await loadFromDisk(simId);
  return all.filter(c =>
    (c.agentAId === agentAId && c.agentBId === agentBId) ||
    (c.agentAId === agentBId && c.agentBId === agentAId)
  );
}
