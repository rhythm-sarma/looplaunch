/**
 * Intelligence Store — In-memory session-keyed storage.
 *
 * "Research Once, Answer Many Times"
 *
 * This is a simple in-memory store for the MVP.
 * Will be replaced with MongoDB tomorrow.
 * Sessions auto-expire after 24 hours.
 */

import type { IntelligenceSession, PipelineStatus } from "./types";

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// ──────────────────────────────────────────────
// In-Memory Store (global singleton)
// ──────────────────────────────────────────────

// Using globalThis to survive Next.js hot reloads in dev
const globalStore = globalThis as unknown as {
  __intelligenceStore?: Map<string, IntelligenceSession>;
  __cleanupTimer?: ReturnType<typeof setInterval>;
};

function getStore(): Map<string, IntelligenceSession> {
  if (!globalStore.__intelligenceStore) {
    globalStore.__intelligenceStore = new Map();

    // Start periodic cleanup
    if (!globalStore.__cleanupTimer) {
      globalStore.__cleanupTimer = setInterval(() => {
        cleanupExpired();
      }, CLEANUP_INTERVAL_MS);
    }
  }
  return globalStore.__intelligenceStore;
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Generate a unique session ID.
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `ll_${timestamp}_${random}`;
}

/**
 * Create a new intelligence session.
 */
export function createSession(
  input: IntelligenceSession["onboardingInput"]
): IntelligenceSession {
  const store = getStore();
  const session: IntelligenceSession = {
    id: generateSessionId(),
    status: "idle",
    statusMessage: "Session created",
    onboardingInput: input,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.set(session.id, session);
  return session;
}

/**
 * Get a session by ID.
 */
export function getSession(
  sessionId: string
): IntelligenceSession | undefined {
  const store = getStore();
  const session = store.get(sessionId);
  if (!session) return undefined;

  // Check TTL
  const age = Date.now() - new Date(session.createdAt).getTime();
  if (age > SESSION_TTL_MS) {
    store.delete(sessionId);
    return undefined;
  }

  return session;
}

/**
 * Update a session's status and optional fields.
 */
export function updateSession(
  sessionId: string,
  updates: Partial<Omit<IntelligenceSession, "id" | "createdAt">>
): IntelligenceSession | undefined {
  const store = getStore();
  const session = store.get(sessionId);
  if (!session) return undefined;

  const updated: IntelligenceSession = {
    ...session,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  store.set(sessionId, updated);
  return updated;
}

/**
 * Update just the pipeline status with a message.
 */
export function updateStatus(
  sessionId: string,
  status: PipelineStatus,
  statusMessage: string
): void {
  updateSession(sessionId, { status, statusMessage });
}

/**
 * Delete a session.
 */
export function deleteSession(sessionId: string): boolean {
  return getStore().delete(sessionId);
}

/**
 * List all active sessions (for debugging).
 */
export function listSessions(): IntelligenceSession[] {
  return Array.from(getStore().values());
}

// ──────────────────────────────────────────────
// Internal Cleanup
// ──────────────────────────────────────────────

function cleanupExpired(): void {
  const store = getStore();
  const now = Date.now();
  for (const [id, session] of store.entries()) {
    const age = now - new Date(session.createdAt).getTime();
    if (age > SESSION_TTL_MS) {
      store.delete(id);
    }
  }
}
