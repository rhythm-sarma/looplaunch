/**
 * Intelligence Store — MongoDB Atlas persistent storage with in-memory caching.
 *
 * "Research Once, Answer Many Times"
 *
 * Persists all onboarding intelligence, SWOT diagnosis, market research,
 * and chat history to MongoDB Atlas (sessions collection).
 * Falls back gracefully to in-memory cache if MongoDB is offline.
 */

import type { IntelligenceSession, PipelineStatus, ChatMessage } from "./types";
import { getDatabase } from "@/lib/db/mongodb";

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const SESSIONS_COLLECTION = "sessions";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours in-memory TTL
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// ──────────────────────────────────────────────
// In-Memory Cache (global singleton for fast reads & HMR survival)
// ──────────────────────────────────────────────

const globalStore = globalThis as unknown as {
  __intelligenceStore?: Map<string, IntelligenceSession>;
  __cleanupTimer?: ReturnType<typeof setInterval>;
  __dbIndexesCreated?: boolean;
};

function getMemoryStore(): Map<string, IntelligenceSession> {
  if (!globalStore.__intelligenceStore) {
    globalStore.__intelligenceStore = new Map();

    if (!globalStore.__cleanupTimer) {
      globalStore.__cleanupTimer = setInterval(() => {
        cleanupExpiredMemory();
      }, CLEANUP_INTERVAL_MS);
    }
  }
  return globalStore.__intelligenceStore;
}

/**
 * Lazily initialize MongoDB collection indexes.
 */
async function ensureDbIndexes(): Promise<void> {
  if (globalStore.__dbIndexesCreated) return;
  try {
    const db = await getDatabase();
    const collection = db.collection(SESSIONS_COLLECTION);
    await collection.createIndex({ id: 1 }, { unique: true });
    await collection.createIndex({ updatedAt: -1 });
    globalStore.__dbIndexesCreated = true;
  } catch (error) {
    console.warn("[MongoDB Store] Index initialization notice:", error);
  }
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
export async function createSession(
  input: IntelligenceSession["onboardingInput"]
): Promise<IntelligenceSession> {
  const memory = getMemoryStore();
  const session: IntelligenceSession = {
    id: generateSessionId(),
    status: "idle",
    statusMessage: "Session created",
    onboardingInput: input,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Cache in-memory
  memory.set(session.id, session);

  // Persist to MongoDB
  try {
    await ensureDbIndexes();
    const db = await getDatabase();
    await db.collection<IntelligenceSession>(SESSIONS_COLLECTION).insertOne({ ...session });
    console.log(`[MongoDB Store] Created session ${session.id} in MongoDB Atlas.`);
  } catch (error) {
    console.warn(`[MongoDB Store] Failed to persist new session ${session.id} to MongoDB (in-memory preserved):`, error);
  }

  return session;
}

function createTestSession(id: string): IntelligenceSession {
  return {
    id,
    status: "ready",
    statusMessage: "Intelligence gathering complete. Ready for questions.",
    onboardingInput: {
      companyName: "Acme SaaS",
      whatTheySell: "B2B Software & Marketing Operations",
      website: "https://acme.example.com",
      nameAndRole: "Founder / Head of Growth",
      competitors: "Shopify, BigCommerce, WooCommerce",
      painPoint: "High customer acquisition cost and market differentiation",
      whyTheyreHere: ["Strategic Clarity", "Competitive Differentiation"],
    },
    companyIntelligence: {
      name: "Acme SaaS",
      website: "https://acme.example.com",
      industry: "B2B Software / E-commerce Infrastructure",
      description: "Modern cloud platform solving e-commerce and marketing operational bottlenecks.",
      valueProposition: "High-velocity modern software with transparent pricing and agile ergonomics.",
      products: ["Cloud Suite", "Analytics Engine", "Strategic Intelligence"],
      targetSegments: ["Founders", "Growth Marketers", "E-commerce Operators"],
      brandTone: "Sharp, forward-thinking, pragmatic",
      strengths: ["Fast onboarding", "Modern UX", "High agility and velocity"],
      weaknesses: ["Emerging brand recognition compared to legacy incumbents"],
      currentChannels: ["Organic Discovery", "Founder Network", "Direct Outbound"],
      contentThemes: ["Modern Tooling Teardowns", "Growth Frameworks"],
      technologyStack: ["Next.js", "TypeScript", "Cloud-native microservices"],
    },
    competitorIntelligence: [
      {
        name: "Shopify",
        website: "https://shopify.com",
        description: "Leading global commerce platform offering hosted store software.",
        valueProposition: "All-in-one commerce solution with massive app store ecosystem.",
        products: ["Shopify Basic", "Shopify Plus", "Shop Payments"],
        targetSegments: ["SMB Merchants", "Enterprise Brands"],
        strengths: ["Huge ecosystem", "High brand recognition", "App store variety"],
        weaknesses: ["Transaction fees on non-native payments", "Expensive app stack costs"],
        marketingChannels: ["Search Ads", "Brand Sponsorships", "Partner Network"],
        contentStrategy: "High-volume founder case studies and commerce guides",
        differentiators: ["Industry standard ecosystem with extensive third-party integration"],
        pricing: "Tiered subscription + app add-ons + transaction fees",
      },
    ],
    marketIntelligence: {
      industryOverview: "Dynamic digital commerce and marketing technology market undergoing rapid transformation toward specialist tools.",
      marketSize: "Multi-billion dollar global addressable market with double-digit CAGR",
      growthTrends: [
        "Shift from bloated legacy suites to specialized agile tooling",
        "Demand for real-time intelligence over static dashboards",
      ],
      keyPlayers: ["Legacy Incumbents", "Agile Challengers", "AI-native platforms"],
      emergingTrends: ["Transparent usage-based pricing", "AI-assisted marketing execution"],
      customerBehaviors: ["Independent research before buying", "High UX sensitivity"],
      regulations: ["GDPR / SOC2"],
      opportunities: ["Disrupt slow, expensive legacy competitors by highlighting TCO"],
      threats: ["Incumbent bundling of shallow copycat features"],
    },
    diagnosis: {
      swot: {
        strengths: ["Modern tech stack", "Fast iteration cycle", "Transparent pricing"],
        weaknesses: ["Smaller top-of-funnel reach than legacy players"],
        opportunities: ["Position as agile alternative to legacy complexity"],
        threats: ["Aggressive incumbent discounting"],
      },
      positioning: {
        current: "Fast-moving specialist in high-growth category",
        ideal: "The premier modern intelligence platform for growth teams",
        gap: "Transition from feature messaging to high-leverage business outcomes",
      },
      competitiveAnalysis: {
        advantages: ["10x faster time to value", "Lower total cost of ownership"],
        disadvantages: ["Smaller enterprise sales partner network"],
        differentiationOpportunities: ["Highlight agility, speed, and transparent pricing"],
      },
      keyInsights: [
        "Focus on high-intent search and comparative positioning against legacy fees.",
        "Target operators dissatisfied with expensive, monolithic apps.",
      ],
      strategicPriorities: [
        "Deploy intent-driven comparative landing pages.",
        "Accelerate outbound to dissatisfied incumbent customers.",
      ],
      channelRecommendations: [
        { channel: "Intent Search", reasoning: "Captures buyers actively looking to switch", priority: "high" },
        { channel: "Strategic Teardowns", reasoning: "Builds high-trust authority with founders", priority: "high" },
      ],
      generatedAt: new Date().toISOString(),
    },
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get a session by ID (checks memory first, falls back to MongoDB).
 */
export async function getSession(
  sessionId: string
): Promise<IntelligenceSession | undefined> {
  const memory = getMemoryStore();
  let session = memory.get(sessionId);

  // If not in memory, query MongoDB Atlas
  if (!session) {
    try {
      const db = await getDatabase();
      const doc = await db.collection(SESSIONS_COLLECTION).findOne({ id: sessionId });
      if (doc) {
        // Strip MongoDB's _id when loading into IntelligenceSession
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _id, ...rest } = doc;
        session = rest as unknown as IntelligenceSession;
        memory.set(sessionId, session);
        console.log(`[MongoDB Store] Hydrated session ${sessionId} from MongoDB Atlas.`);
      }
    } catch (error) {
      console.warn(`[MongoDB Store] Error querying session ${sessionId} from MongoDB:`, error);
    }
  }

  // Handle demo / test session
  if (!session && (sessionId === "test" || sessionId.startsWith("test_") || sessionId === "demo")) {
    session = createTestSession(sessionId);
    memory.set(sessionId, session);
  }

  if (!session) return undefined;

  // Check in-memory TTL
  const age = Date.now() - new Date(session.createdAt).getTime();
  if (age > SESSION_TTL_MS) {
    memory.delete(sessionId);
    return undefined;
  }

  return session;
}

/**
 * Append a message to the session's persistent conversation history.
 */
export async function addMessageToSession(
  sessionId: string,
  message: ChatMessage
): Promise<ChatMessage[]> {
  const session = await getSession(sessionId);
  if (!session) return [];

  if (!session.messages) {
    session.messages = [];
  }

  session.messages.push(message);
  session.updatedAt = new Date().toISOString();
  getMemoryStore().set(sessionId, session);

    // Persist to MongoDB
    try {
      const db = await getDatabase();
      await db.collection<IntelligenceSession>(SESSIONS_COLLECTION).updateOne(
        { id: sessionId },
        {
          $push: { messages: message },
          $set: { updatedAt: session.updatedAt },
        }
      );
    } catch (error) {
    console.warn(`[MongoDB Store] Error persisting message to session ${sessionId}:`, error);
  }

  return session.messages;
}

/**
 * Get the full conversation history for a session.
 */
export async function getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  const session = await getSession(sessionId);
  return session?.messages || [];
}

/**
 * Update rolling conversation summary for long conversations.
 */
export async function updateConversationSummary(
  sessionId: string,
  summary: string
): Promise<void> {
  const session = await getSession(sessionId);
  if (session) {
    session.conversationSummary = summary;
    session.updatedAt = new Date().toISOString();
    getMemoryStore().set(sessionId, session);

    try {
      const db = await getDatabase();
      await db.collection(SESSIONS_COLLECTION).updateOne(
        { id: sessionId },
        {
          $set: {
            conversationSummary: summary,
            updatedAt: session.updatedAt,
          },
        }
      );
    } catch (error) {
      console.warn(`[MongoDB Store] Error updating summary for ${sessionId}:`, error);
    }
  }
}

/**
 * Update a session's status and optional fields.
 */
export async function updateSession(
  sessionId: string,
  updates: Partial<Omit<IntelligenceSession, "id" | "createdAt">>
): Promise<IntelligenceSession | undefined> {
  const memory = getMemoryStore();
  let session = memory.get(sessionId);

  if (!session) {
    session = await getSession(sessionId);
  }
  if (!session) return undefined;

  const updated: IntelligenceSession = {
    ...session,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  memory.set(sessionId, updated);

  // Persist update to MongoDB
  try {
    const db = await getDatabase();
    await db.collection(SESSIONS_COLLECTION).updateOne(
      { id: sessionId },
      {
        $set: {
          ...updates,
          updatedAt: updated.updatedAt,
        },
      },
      { upsert: true }
    );
  } catch (error) {
    console.warn(`[MongoDB Store] Error updating session ${sessionId} in MongoDB:`, error);
  }

  return updated;
}

/**
 * Update just the pipeline status with a message.
 */
export async function updateStatus(
  sessionId: string,
  status: PipelineStatus,
  statusMessage: string
): Promise<void> {
  await updateSession(sessionId, { status, statusMessage });
}

/**
 * Delete a session.
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  const deletedFromMemory = getMemoryStore().delete(sessionId);
  try {
    const db = await getDatabase();
    await db.collection(SESSIONS_COLLECTION).deleteOne({ id: sessionId });
  } catch (error) {
    console.warn(`[MongoDB Store] Error deleting session ${sessionId} from MongoDB:`, error);
  }
  return deletedFromMemory;
}

/**
 * List all active sessions.
 */
export async function listSessions(): Promise<IntelligenceSession[]> {
  try {
    const db = await getDatabase();
    const docs = await db
      .collection(SESSIONS_COLLECTION)
      .find({})
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();

    if (docs && docs.length > 0) {
      return docs.map((doc) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _id, ...rest } = doc;
        return rest as unknown as IntelligenceSession;
      });
    }
  } catch (error) {
    console.warn("[MongoDB Store] Error listing sessions from MongoDB:", error);
  }

  return Array.from(getMemoryStore().values());
}

// ──────────────────────────────────────────────
// Internal Cleanup (in-memory)
// ──────────────────────────────────────────────

function cleanupExpiredMemory(): void {
  const memory = getMemoryStore();
  const now = Date.now();
  for (const [id, session] of memory.entries()) {
    const age = now - new Date(session.createdAt).getTime();
    if (age > SESSION_TTL_MS) {
      memory.delete(id);
    }
  }
}
