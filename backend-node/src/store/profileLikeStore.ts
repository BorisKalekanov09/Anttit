/**
 * Profile Likes Store
 * Persists profile likes to disk with per-viewer uniqueness enforcement.
 * Implements per-simId write queue to prevent concurrent write corruption.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// ── Types ─────────────────────────────────────────────────────────────────

/**
 * A profile like entry tracking who liked which agent's profile.
 */
interface ProfileLike {
  agentId: string;
  viewerId: string;
  likedAt: string;  // ISO timestamp
}

/**
 * Storage format for profile likes per simulation.
 */
interface ProfileLikesStorage {
  likes: ProfileLike[];
}

/**
 * Error thrown when a duplicate like is attempted (409 Conflict).
 */
interface ConflictError extends Error {
  statusCode: 409;
}

// ── Configuration ─────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data', 'profileLikes');

// ── Write Queue Management ────────────────────────────────────────────────

const writeQueues: Map<string, Promise<void>> = new Map();

/**
 * Queue a write operation for a specific simulation.
 * Ensures serial writes to prevent JSON corruption.
 * Recovers from errors: failed write rejects current call but allows subsequent writes.
 */
function queueWrite(simId: string, fn: () => Promise<void>): Promise<void> {
  const currentQueue = writeQueues.get(simId) || Promise.resolve();
  const newQueue = currentQueue
    .catch(() => undefined) // Suppress previous errors to allow queue recovery
    .then(() => fn());
  
  // Store a version that doesn't propagate errors to future writes
  writeQueues.set(simId, newQueue.catch(() => undefined));
  
  // Return original promise (with error) so current caller knows if their write failed
  return newQueue;
}

// ── File Operations ───────────────────────────────────────────────────────

/**
 * Get the profile likes file path for a simulation.
 */
function getProfileLikesFilePath(simId: string): string {
  return path.join(DATA_DIR, `${simId}.json`);
}

/**
 * Ensure data directory exists.
 */
async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    // Directory may already exist; log but don't throw
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      console.error('[ProfileLikeStore] Failed to create data directory:', error);
    }
  }
}

/**
 * Load profile likes from disk.
 */
async function loadProfileLikesFromDisk(simId: string): Promise<ProfileLikesStorage> {
  const filePath = getProfileLikesFilePath(simId);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    return { likes: data.likes ?? [] };
  } catch (error) {
    // File doesn't exist or is corrupted; return empty storage
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { likes: [] };
    }
    // Log parse errors but return empty storage
    console.error(`[ProfileLikeStore] Failed to parse profile likes for ${simId}:`, error);
    return { likes: [] };
  }
}

/**
 * Write profile likes to disk safely (write to temp, then rename).
 */
async function writeProfileLikesToDisk(simId: string, storage: ProfileLikesStorage): Promise<void> {
  const filePath = getProfileLikesFilePath(simId);
  const tempPath = `${filePath}.tmp`;

  try {
    // Ensure directory exists
    await ensureDataDir();

    // Write to temp file
    await fs.writeFile(tempPath, JSON.stringify(storage, null, 2), 'utf-8');

    // Atomic rename
    await fs.rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file on error
    try {
      await fs.unlink(tempPath);
    } catch {
      // Temp file may not exist; ignore
    }
    throw error;
  }
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Add a like from viewerId to agentId's profile.
 * Throws error if viewerId already liked this agent (409 equivalent).
 */
export async function addProfileLike(
  simId: string,
  agentId: string,
  viewerId: string
): Promise<void> {
  return queueWrite(simId, async () => {
    const storage = await loadProfileLikesFromDisk(simId);

    // Check uniqueness: (agentId, viewerId) pair must not exist
    const alreadyLiked = storage.likes.some(
      (like) => like.agentId === agentId && like.viewerId === viewerId
    );

    if (alreadyLiked) {
      // Throw a descriptive error for 409 Conflict response
      const message = `Profile already liked by viewer ${viewerId} for agent ${agentId}`;
      const error = Object.assign(new Error(message), { statusCode: 409 as const }) as ConflictError;
      throw error;
    }

    // Add the new like
    const newLike: ProfileLike = {
      agentId,
      viewerId,
      likedAt: new Date().toISOString(),
    };
    storage.likes.push(newLike);

    // Write back to disk
    await writeProfileLikesToDisk(simId, storage);
  });
}

/**
 * Check if viewerId has already liked agentId's profile.
 */
export async function hasLikedProfile(
  simId: string,
  agentId: string,
  viewerId: string
): Promise<boolean> {
  const storage = await loadProfileLikesFromDisk(simId);
  return storage.likes.some(
    (like) => like.agentId === agentId && like.viewerId === viewerId
  );
}

/**
 * Get the count of likes for an agent's profile.
 */
export async function getProfileLikeCount(simId: string, agentId: string): Promise<number> {
  const storage = await loadProfileLikesFromDisk(simId);
  return storage.likes.filter((like) => like.agentId === agentId).length;
}

/**
 * Get all profile likes for a simulation.
 */
export async function getAllProfileLikes(simId: string): Promise<ProfileLike[]> {
  const storage = await loadProfileLikesFromDisk(simId);
  return storage.likes;
}
