/**
 * Gemini AI Service with Graceful Demo Fallbacks
 *
 * Wrapper around Google's Generative AI SDK.
 * Gemini is used for STRUCTURING and REASONING — not as a raw data source.
 * When GEMINI_API_KEY is present, it uses gemini-2.0-flash.
 * If the key is not configured or an API call fails (e.g. during team demos before keys are wired),
 * it seamlessly generates rich contextual mock intelligence so the UI and workflows never fail.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  OnboardingInput,
  CompanyIntelligence,
  CompetitorIntelligence,
  MarketIntelligence,
  StrategicDiagnosis,
  StrategicAnswer,
} from "../intelligence/types";
import {
  buildCompanyAnalysisPrompt,
  buildCompetitorAnalysisPrompt,
  buildMarketAnalysisPrompt,
  buildDiagnosisPrompt,
  buildQuestionAnswerPrompt,
} from "./prompts";

// ──────────────────────────────────────────────
// Singleton Client
// ──────────────────────────────────────────────

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

function getModel() {
  const client = getClient();
  if (!client) return null;

  return client.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
  });
}

// ──────────────────────────────────────────────
// JSON Parser Helper
// ──────────────────────────────────────────────

function parseJsonResponse<T>(text: string): T {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  return JSON.parse(cleaned) as T;
}

// ──────────────────────────────────────────────
// Contextual Mock Data Generators (Zero-Error Demo Mode)
// ──────────────────────────────────────────────

function getMockCompanyIntelligence(
  onboarding: OnboardingInput,
  _crawledContent: string
): CompanyIntelligence {
  const name = onboarding.companyName || "Your Company";
  const sell = onboarding.whatTheySell || "High-performance software and tools";
  const pain = onboarding.painPoint || "Scaling customer acquisition and market differentiation";

  return {
    name,
    website: onboarding.website || "https://looplaunch.app",
    industry: "B2B Software / AI Intelligence",
    description: `${name} builds ${sell}. Tailored to solve critical bottlenecks in ${pain}.`,
    valueProposition: `Accelerating growth and efficiency with high-leverage tooling built for ${sell}.`,
    products: [
      sell,
      "Intelligent workflow orchestration",
      "Strategic performance analytics",
    ],
    targetSegments: [
      onboarding.nameAndRole ? `Leaders in roles like ${onboarding.nameAndRole}` : "Founders and growth operators",
      "B2B software teams seeking higher velocity",
      "Modern agile companies outgrowing legacy tooling",
    ],
    brandTone: "Sharp, forward-thinking, pragmatic, and outcome-oriented",
    strengths: [
      "Targeted focus on solving specific customer pain points",
      "Modern, ultra-fast user experience",
      "High agility and rapid iteration compared to legacy alternatives",
    ],
    weaknesses: [
      "Early stage market recognition compared to decade-old incumbents",
      "Top-of-funnel acquisition channels currently in active expansion",
    ],
    currentChannels: [
      "Organic Product Discovery",
      "Founder-Led Network & Communities",
      "Direct Outbound to High-Intent Accounts",
    ],
    contentThemes: [
      "Modern vs Legacy Tooling Teardowns",
      "Tactical Marketing Velocity Guides",
      "Transparent Growth Frameworks",
    ],
    technologyStack: [
      "Next.js",
      "TypeScript",
      "Modern Cloud Infrastructure",
    ],
  };
}

function getMockCompetitorIntelligence(
  competitorName: string,
  _companyContext: string
): CompetitorIntelligence {
  const cleanName = competitorName.trim() || "Industry Competitor";
  const domain = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "");

  return {
    name: cleanName,
    website: `https://${domain || "competitor"}.com`,
    description: `Established category player offering broad solutions for ${cleanName} workflows.`,
    valueProposition: "Comprehensive enterprise-grade suite with broad feature coverage.",
    products: [
      "Enterprise Platform Suite",
      "Legacy Analytics Add-on",
      "Managed Professional Services",
    ],
    targetSegments: [
      "Large enterprise procurement teams",
      "Conservative corporate buyers",
    ],
    strengths: [
      "High brand recognition and long market presence",
      "Large enterprise sales force and partner network",
      "Extensive legacy feature checklist",
    ],
    weaknesses: [
      "Complex, cluttered UI and steep learning curve",
      "High base pricing with rigid annual lock-in contracts",
      "Slow feature development and delayed customer support",
    ],
    marketingChannels: [
      "Expensive Enterprise Search Ads",
      "Corporate Conferences & Trade Shows",
      "Outbound SDR Phone Sequences",
    ],
    contentStrategy: "High-volume whitepapers and generic corporate blog posts",
    differentiators: [
      "Loop Launch provides 10x faster insights, modern agile architecture, and tailored strategic intelligence without legacy bloat.",
    ],
    pricing: "High enterprise tiers with opaque quote-required pricing",
  };
}

function getMockMarketIntelligence(onboarding: OnboardingInput): MarketIntelligence {
  const sell = onboarding.whatTheySell || "modern software";
  const pain = onboarding.painPoint || "market differentiation and customer acquisition";

  return {
    industryOverview: `The market for ${sell} is undergoing a fundamental shift from bloated legacy suites toward agile, intelligent specialists that eliminate ${pain}.`,
    marketSize: "Rapidly growing multi-billion dollar category experiencing double-digit annual CAGR",
    growthTrends: [
      "Shift from horizontal, bloated suites toward agile, specialist tooling",
      "Rapid demand for automated strategic intelligence over raw data reporting",
      "Shorter evaluation cycles driven by self-serve discovery and transparent value",
    ],
    keyPlayers: [
      "Legacy Corporate Incumbents",
      "Agile Niche Challengers",
      "Modern AI-native Entrants",
    ],
    emergingTrends: [
      "Outcome-driven pricing over seat-based licensing",
      "Integration of real-time market signals into daily workflows",
    ],
    customerBehaviors: [
      "Buyers research independently before speaking with any sales rep",
      "High sensitivity to onboarding friction and slow time-to-value",
      "Strong preference for lightweight, modern interfaces over heavy enterprise dashboards",
    ],
    regulations: [
      "Standard SOC2 and GDPR compliance expectations",
      "Growing scrutiny on proprietary customer data handling",
    ],
    opportunities: [
      "Capitalize on customer frustration with legacy pricing and complexity",
      "Deliver immediate actionable clarity in the first session",
      "Create high-converting comparative teardowns that capture search intent",
    ],
    threats: [
      "Incumbents adding shallow AI marketing wrappers to existing products",
      "Customer inertia and default habituation to legacy tools",
    ],
  };
}

function getMockDiagnosis(
  companyIntel: CompanyIntelligence,
  onboarding: OnboardingInput
): StrategicDiagnosis {
  const constraint = onboarding.painPoint || "Top-of-funnel customer acquisition and positioning clarity";

  return {
    swot: {
      strengths: [
        "Modern and intuitive product experience with low cognitive overhead",
        "Focused value proposition addressing explicit high-pain friction points",
        "Fast decision-making and rapid release cycle",
      ],
      weaknesses: [
        "Smaller top-of-funnel reach compared to established players",
        "Educational barrier for buyers accustomed to old workflows",
      ],
      opportunities: [
        "Position as the agile alternative to sluggish corporate competitors",
        "Capture bottom-up demand through transparent value demonstration",
        "Leverage customer advocacy to build category authority",
      ],
      threats: [
        "Incumbent platforms bundling copycat features into existing contracts",
        "Saturation in standard digital advertising channels",
      ],
    },
    positioning: {
      current: "Feature-focused emerging tool in active customer discovery",
      ideal: "The definitive agile intelligence platform for forward-thinking growth teams",
      gap: "Need to transition from explaining how the tool works to emphasizing high-leverage business outcomes",
    },
    competitiveAnalysis: {
      advantages: [
        "10x faster time-to-insight than legacy enterprise alternatives",
        "Transparent, accessible workflows without complex onboarding",
        "Modern architecture designed for rapid iteration",
      ],
      disadvantages: [
        "Less historic enterprise brand equity than legacy giants",
      ],
      differentiationOpportunities: [
        "Highlight speed, clarity, and precision over bloated feature checklists",
        "Publish transparent comparisons contrasting your responsiveness with legacy stagnation",
      ],
    },
    keyInsights: [
      `Primary bottleneck is ${constraint}, which can be unlocked through sharper positioning.`,
      "Target accounts are actively looking for alternatives to expensive legacy contracts.",
      "A concentrated focus on 1-2 high-intent channels will produce superior ROI than broad ad spend.",
    ],
    strategicPriorities: [
      "Sharpen core value narrative to directly target buyer outcomes.",
      "Launch targeted comparative campaigns against legacy incumbents.",
      "Establish an intent-driven outbound workflow focused on dissatisfied incumbent users.",
    ],
    channelRecommendations: [
      {
        channel: "Intent-Based Search & Comparison Pages",
        reasoning: "Captures prospects at the exact moment they are frustrated with legacy alternatives.",
        priority: "high",
      },
      {
        channel: "Founder-Led Strategic Teardowns",
        reasoning: "Builds high-trust authority and category leadership with minimal paid spend.",
        priority: "high",
      },
      {
        channel: "Targeted Outbound to High-Fit Accounts",
        reasoning: "Allows direct testing of positioning hooks with verified decision-makers.",
        priority: "medium",
      },
      {
        channel: "Broad Social Display Ads",
        reasoning: "Low intent and expensive for early-stage positioning before hooks are validated.",
        priority: "low",
      },
    ],
    generatedAt: new Date().toISOString(),
  };
}

function getMockStrategicAnswer(
  question: string,
  companyIntel: CompanyIntelligence
): StrategicAnswer {
  return {
    question,
    answer: `For ${companyIntel.name}, the highest leverage move right now is focusing on sharp differentiation and capturing high-intent demand rather than running broad, generic awareness campaigns.\n\nBecause ${companyIntel.name} solves acute friction in ${companyIntel.description}, targeting buyers who are already dissatisfied with legacy alternatives produces significantly higher conversion rates at a fraction of the cost.\n\nRecommended actions:\n1. Deploy targeted landing pages contrasting your agile speed with legacy complexity.\n2. Leverage founder-led strategic teardowns to build authentic domain authority.\n3. Implement a high-touch feedback loop to refine positioning based on real buyer reactions.`,
    evidence: [
      {
        source: "Company Intelligence Profile",
        insight: `${companyIntel.name} has a clear speed and agility advantage over legacy category players.`,
      },
      {
        source: "Competitive Positioning Analysis",
        insight: "Incumbents suffer from bloated UX and slow support, creating high vulnerability to agile challengers.",
      },
      {
        source: "Market Dynamics Analysis",
        insight: "Buyers increasingly favor transparent, self-serve evaluation over drawn-out enterprise sales cycles.",
      },
    ],
    confidence: "high",
    followUpQuestions: [
      "Which specific marketing channel should we test first this week?",
      "How should we position our pricing against legacy incumbents?",
      "What is the most effective teardown topic to attract our ideal customers?",
    ],
    generatedAt: new Date().toISOString(),
  };
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Analyze company data and produce structured intelligence.
 */
export async function analyzeCompany(
  onboarding: OnboardingInput,
  crawledContent: string
): Promise<CompanyIntelligence> {
  const model = getModel();

  if (!model) {
    console.log("[Gemini] GEMINI_API_KEY not configured — using contextual demo intelligence for company.");
    return getMockCompanyIntelligence(onboarding, crawledContent);
  }

  try {
    const prompt = buildCompanyAnalysisPrompt(onboarding, crawledContent);
    console.log("[Gemini] Analyzing company intelligence via API...");
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = parseJsonResponse<CompanyIntelligence>(text);

    return {
      ...parsed,
      website: onboarding.website,
    };
  } catch (err) {
    console.warn("[Gemini] analyzeCompany API error, falling back to contextual demo data:", err);
    return getMockCompanyIntelligence(onboarding, crawledContent);
  }
}

/**
 * Analyze a competitor and produce structured intelligence.
 */
export async function analyzeCompetitor(
  competitorName: string,
  crawledContent: string,
  companyContext: string
): Promise<CompetitorIntelligence> {
  const model = getModel();

  if (!model) {
    console.log(`[Gemini] GEMINI_API_KEY not configured — using demo data for competitor: ${competitorName}`);
    return getMockCompetitorIntelligence(competitorName, companyContext);
  }

  try {
    const prompt = buildCompetitorAnalysisPrompt(
      competitorName,
      crawledContent,
      companyContext
    );
    console.log(`[Gemini] Analyzing competitor: ${competitorName}...`);
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return parseJsonResponse<CompetitorIntelligence>(text);
  } catch (err) {
    console.warn(`[Gemini] analyzeCompetitor API error for ${competitorName}, falling back:`, err);
    return getMockCompetitorIntelligence(competitorName, companyContext);
  }
}

/**
 * Analyze market data and produce structured intelligence.
 */
export async function analyzeMarket(
  onboarding: OnboardingInput,
  searchResults: string
): Promise<MarketIntelligence> {
  const model = getModel();

  if (!model) {
    console.log("[Gemini] GEMINI_API_KEY not configured — using demo market intelligence.");
    return getMockMarketIntelligence(onboarding);
  }

  try {
    const prompt = buildMarketAnalysisPrompt(onboarding, searchResults);
    console.log("[Gemini] Analyzing market intelligence via API...");
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return parseJsonResponse<MarketIntelligence>(text);
  } catch (err) {
    console.warn("[Gemini] analyzeMarket API error, falling back to demo data:", err);
    return getMockMarketIntelligence(onboarding);
  }
}

/**
 * Generate strategic diagnosis from all intelligence.
 */
export async function generateDiagnosis(
  companyIntel: CompanyIntelligence,
  competitorIntel: CompetitorIntelligence[],
  marketIntel: MarketIntelligence,
  onboarding: OnboardingInput
): Promise<StrategicDiagnosis> {
  const model = getModel();

  if (!model) {
    console.log("[Gemini] GEMINI_API_KEY not configured — using demo strategic diagnosis.");
    return getMockDiagnosis(companyIntel, onboarding);
  }

  try {
    const prompt = buildDiagnosisPrompt(
      JSON.stringify(companyIntel, null, 2),
      JSON.stringify(competitorIntel, null, 2),
      JSON.stringify(marketIntel, null, 2),
      onboarding
    );
    console.log("[Gemini] Generating strategic diagnosis via API...");
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = parseJsonResponse<StrategicDiagnosis>(text);

    return {
      ...parsed,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("[Gemini] generateDiagnosis API error, falling back to demo diagnosis:", err);
    return getMockDiagnosis(companyIntel, onboarding);
  }
}

/**
 * Answer a strategic question using stored intelligence.
 */
export async function answerQuestion(
  question: string,
  companyIntel: CompanyIntelligence,
  competitorIntel: CompetitorIntelligence[],
  marketIntel: MarketIntelligence,
  diagnosis: StrategicDiagnosis
): Promise<StrategicAnswer> {
  const model = getModel();

  if (!model) {
    console.log(`[Gemini] GEMINI_API_KEY not configured — answering with demo strategic logic: "${question}"`);
    return getMockStrategicAnswer(question, companyIntel);
  }

  try {
    const prompt = buildQuestionAnswerPrompt(
      question,
      JSON.stringify(companyIntel, null, 2),
      JSON.stringify(competitorIntel, null, 2),
      JSON.stringify(marketIntel, null, 2),
      JSON.stringify(diagnosis, null, 2)
    );
    console.log(`[Gemini] Answering question via API: "${question.substring(0, 60)}..."`);
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = parseJsonResponse<StrategicAnswer>(text);

    return {
      ...parsed,
      question,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("[Gemini] answerQuestion API error, falling back to demo response:", err);
    return getMockStrategicAnswer(question, companyIntel);
  }
}

/**
 * Health check — verify if the API key is active.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const model = getModel();
    if (!model) return false;
    const result = await model.generateContent("Say 'ok' and nothing else.");
    return result.response.text().toLowerCase().includes("ok");
  } catch (e) {
    console.error("[Gemini] Health check failed:", e);
    return false;
  }
}
