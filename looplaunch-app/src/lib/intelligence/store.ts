/**
 * Intelligence Store — In-memory session-keyed storage.
 *
 * "Research Once, Answer Many Times"
 *
 * This is a simple in-memory store for the MVP.
 * Will be replaced with MongoDB tomorrow.
 * Sessions auto-expire after 24 hours.
 */

import type { IntelligenceSession, PipelineStatus, ChatMessage } from "./types";

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
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.set(session.id, session);
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
 * Get a session by ID.
 */
export function getSession(
  sessionId: string
): IntelligenceSession | undefined {
  const store = getStore();
  let session = store.get(sessionId);

  if (!session && (sessionId === "test" || sessionId.startsWith("test_") || sessionId === "demo")) {
    session = createTestSession(sessionId);
    store.set(sessionId, session);
  }

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
 * Append a message to the session's persistent conversation history.
 */
export function addMessageToSession(
  sessionId: string,
  message: ChatMessage
): ChatMessage[] {
  const session = getSession(sessionId);
  if (!session) return [];

  if (!session.messages) {
    session.messages = [];
  }

  session.messages.push(message);
  session.updatedAt = new Date().toISOString();
  getStore().set(sessionId, session);
  return session.messages;
}

/**
 * Get the full conversation history for a session.
 */
export function getSessionMessages(sessionId: string): ChatMessage[] {
  const session = getSession(sessionId);
  return session?.messages || [];
}

/**
 * Update rolling conversation summary for long conversations.
 */
export function updateConversationSummary(
  sessionId: string,
  summary: string
): void {
  const session = getSession(sessionId);
  if (session) {
    session.conversationSummary = summary;
    session.updatedAt = new Date().toISOString();
    getStore().set(sessionId, session);
  }
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
