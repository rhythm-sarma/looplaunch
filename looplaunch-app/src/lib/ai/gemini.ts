/**
 * Gemini AI Service
 *
 * Wrapper around Google's Generative AI SDK.
 * Gemini is used for STRUCTURING and REASONING — not as a data source.
 * All evidence comes from crawling and research.
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

function getClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not set. Add it to .env.local"
      );
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/**
 * Get the Gemini model instance.
 * Uses gemini-2.0-flash for fast, cost-effective structured output.
 */
function getModel() {
  return getClient().getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      temperature: 0.3, // Low temp for consistent structured output
      maxOutputTokens: 4096,
    },
  });
}

// ──────────────────────────────────────────────
// JSON Parser Helper
// ──────────────────────────────────────────────

/**
 * Parse Gemini's response as JSON, handling markdown fences and edge cases.
 */
function parseJsonResponse<T>(text: string): T {
  // Strip markdown code fences if present
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

  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    console.error("[Gemini] Failed to parse JSON response:", cleaned.substring(0, 200));
    throw new Error(`Gemini returned invalid JSON: ${(e as Error).message}`);
  }
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
  const prompt = buildCompanyAnalysisPrompt(onboarding, crawledContent);

  console.log("[Gemini] Analyzing company intelligence...");
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  const parsed = parseJsonResponse<CompanyIntelligence>(text);
  return {
    ...parsed,
    website: onboarding.website,
  };
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
  const prompt = buildCompetitorAnalysisPrompt(
    competitorName,
    crawledContent,
    companyContext
  );

  console.log(`[Gemini] Analyzing competitor: ${competitorName}...`);
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  return parseJsonResponse<CompetitorIntelligence>(text);
}

/**
 * Analyze market data and produce structured intelligence.
 */
export async function analyzeMarket(
  onboarding: OnboardingInput,
  searchResults: string
): Promise<MarketIntelligence> {
  const model = getModel();
  const prompt = buildMarketAnalysisPrompt(onboarding, searchResults);

  console.log("[Gemini] Analyzing market intelligence...");
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  return parseJsonResponse<MarketIntelligence>(text);
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
  const prompt = buildDiagnosisPrompt(
    JSON.stringify(companyIntel, null, 2),
    JSON.stringify(competitorIntel, null, 2),
    JSON.stringify(marketIntel, null, 2),
    onboarding
  );

  console.log("[Gemini] Generating strategic diagnosis...");
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  const parsed = parseJsonResponse<StrategicDiagnosis>(text);
  return {
    ...parsed,
    generatedAt: new Date().toISOString(),
  };
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
  const prompt = buildQuestionAnswerPrompt(
    question,
    JSON.stringify(companyIntel, null, 2),
    JSON.stringify(competitorIntel, null, 2),
    JSON.stringify(marketIntel, null, 2),
    JSON.stringify(diagnosis, null, 2)
  );

  console.log(`[Gemini] Answering question: "${question.substring(0, 60)}..."`);
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  const parsed = parseJsonResponse<StrategicAnswer>(text);
  return {
    ...parsed,
    question,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Health check — verify the API key works.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const model = getModel();
    const result = await model.generateContent("Say 'ok' and nothing else.");
    return result.response.text().toLowerCase().includes("ok");
  } catch (e) {
    console.error("[Gemini] Health check failed:", e);
    return false;
  }
}
