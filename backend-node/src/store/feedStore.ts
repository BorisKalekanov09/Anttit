/**
 * JSON Feed Store
 * Persists discussion feed posts, likes, and comments to disk.
 * Implements per-simId write queue to prevent concurrent write corruption.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { DiscussionPost, DiscussionComment } from '../types.js';

// ── Configuration ─────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data', 'feeds');
const MAX_POSTS = 200;
const MAX_COMMENTS_PER_POST = 20;

// ── Types ─────────────────────────────────────────────────────────────────

interface FeedSnapshot {
  posts: DiscussionPost[];
  stats: {
    totalPosts: number;
    totalLikes: number;
    totalComments: number;
    updatedAt: string;
  };
}

interface FeedStorage {
  posts: DiscussionPost[];
}

// ── Write Queue Management ─────────────────────────────────────────────────

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
 * Get the feed file path for a simulation.
 */
function getFeedFilePath(simId: string): string {
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
      console.error('[FeedStore] Failed to create data directory:', error);
    }
  }
}

/**
 * Normalize a DiscussionPost for backward compatibility.
 * Ensures `tags` (defaults to empty array) and `agentId` (leave undefined if missing).
 */
function normalizePost(post: any): DiscussionPost {
  return {
    ...post,
    tags: post.tags ?? [],
    comments: (post.comments ?? []).map((comment: any) => ({
      ...comment,
      // agentId stays undefined if not present
    })),
  };
}

/**
 * Load feed from disk.
 * Normalizes posts and comments to include default values for tags/agentId.
 */
async function loadFeedFromDisk(simId: string): Promise<FeedStorage> {
  const filePath = getFeedFilePath(simId);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    // Normalize posts to ensure backward compatibility
    const posts = (data.posts ?? []).map((post: any) => normalizePost(post));
    
    return { posts };
  } catch (error) {
    // File doesn't exist or is corrupted; return empty feed
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { posts: [] };
    }
    // Log parse errors but return empty feed
    console.error(`[FeedStore] Failed to parse feed for ${simId}:`, error);
    return { posts: [] };
  }
}

/**
 * Write feed to disk safely (write to temp, then rename).
 * Retries on EPERM/EACCES errors (Windows file locking).
 */
async function writeFeedToDisk(simId: string, feed: FeedStorage): Promise<void> {
  const filePath = getFeedFilePath(simId);
  const tempPath = `${filePath}.tmp`;
  const maxRetries = 5;
  let lastError: any;

  try {
    // Ensure directory exists
    await ensureDataDir();

    // Write to temp file
    await fs.writeFile(tempPath, JSON.stringify(feed, null, 2), 'utf-8');

    // Atomic rename with retry logic for Windows file locking
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await fs.rename(tempPath, filePath);
        return; // Success
      } catch (error: any) {
        lastError = error;
        // Only retry on permission/locking errors
        if ((error.code === 'EPERM' || error.code === 'EACCES') && attempt < maxRetries - 1) {
          // Exponential backoff: 10ms, 20ms, 40ms, 80ms
          const delayMs = Math.min(100, 10 * Math.pow(2, attempt));
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
        // Non-retryable error or final attempt
        throw error;
      }
    }
  } catch (error) {
    // Clean up temp file on error
    try {
      await fs.unlink(tempPath);
    } catch {
      // Temp file may not exist; ignore
    }
    // Log the actual error for debugging
    if ((error as NodeJS.ErrnoException)?.code === 'EPERM' || (error as NodeJS.ErrnoException)?.code === 'EACCES') {
      console.warn(`[FeedStore] File lock on ${simId} (${(error as NodeJS.ErrnoException).code}), write operation skipped`);
      // Don't throw - allow operation to proceed (feed exists, just not updated)
      return;
    }
    throw error;
  }
}

/**
 * Trim posts to max capacity (last 200).
 */
function trimPosts(feed: FeedStorage): void {
  if (feed.posts.length > MAX_POSTS) {
    feed.posts = feed.posts.slice(-MAX_POSTS);
  }
}

/**
 * Trim comments in a post to max capacity (last 20).
 */
function trimCommentsInPost(post: DiscussionPost): void {
  if (post.comments.length > MAX_COMMENTS_PER_POST) {
    post.comments = post.comments.slice(-MAX_COMMENTS_PER_POST);
  }
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Read the current feed snapshot for a simulation.
 * Computes stats at read time from stored data.
 */
export async function readFeed(simId: string): Promise<FeedSnapshot> {
  const feed = await loadFeedFromDisk(simId);

  const totalPosts = feed.posts.length;
  const totalLikes = feed.posts.reduce((sum, p) => sum + p.likes, 0);
  const totalComments = feed.posts.reduce((sum, p) => sum + p.comments.length, 0);

  return {
    posts: feed.posts,
    stats: {
      totalPosts,
      totalLikes,
      totalComments,
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Append a new post to the feed.
 * Preserves tags and agentId in the stored post.
 */
export async function appendPost(simId: string, post: DiscussionPost): Promise<DiscussionPost> {
  return queueWrite(simId, async () => {
    const feed = await loadFeedFromDisk(simId);

    // Add the new post with tags/agentId preserved
    const postToStore: DiscussionPost = {
      ...post,
      tags: post.tags ?? [],
      // agentId preserved as-is (undefined if not provided)
    };
    feed.posts.push(postToStore);

    // Apply caps
    trimPosts(feed);

    // Write back to disk
    await writeFeedToDisk(simId, feed);
  }).then(() => post);
}

/**
 * Add a like to a post.
 */
export async function addLike(simId: string, postId: string): Promise<DiscussionPost> {
  return queueWrite(simId, async () => {
    const feed = await loadFeedFromDisk(simId);

    const post = feed.posts.find((p) => p.id === postId);
    if (!post) {
      throw new Error(`Post ${postId} not found in simulation ${simId}`);
    }

    post.likes++;

    await writeFeedToDisk(simId, feed);
  }).then(async () => {
    // Fetch and return the updated post
    const feed = await loadFeedFromDisk(simId);
    const post = feed.posts.find((p) => p.id === postId);
    if (!post) {
      throw new Error(`Post ${postId} not found in simulation ${simId}`);
    }
    return post;
  });
}

/**
 * Add a comment to a post.
 * Preserves agentId in the stored comment.
 */
export async function addComment(
  simId: string,
  postId: string,
  comment: DiscussionComment
): Promise<DiscussionPost> {
  return queueWrite(simId, async () => {
    const feed = await loadFeedFromDisk(simId);

    const post = feed.posts.find((p) => p.id === postId);
    if (!post) {
      throw new Error(`Post ${postId} not found in simulation ${simId}`);
    }

    // Store comment with agentId preserved
    const commentToStore: DiscussionComment = {
      ...comment,
      // agentId preserved as-is (undefined if not provided)
    };
    post.comments.push(commentToStore);

    // Apply comment cap
    trimCommentsInPost(post);

    await writeFeedToDisk(simId, feed);
  }).then(async () => {
    // Fetch and return the updated post
    const feed = await loadFeedFromDisk(simId);
    const post = feed.posts.find((p) => p.id === postId);
    if (!post) {
      throw new Error(`Post ${postId} not found in simulation ${simId}`);
    }
    return post;
  });
}
