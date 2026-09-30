/**
 * Query Classifier & Conversational Intent Analyzer
 *
 * Inspects each incoming user question in relation to the ongoing conversation
 * history to understand intent, resolve contextual references (e.g. "Why?",
 * "How to fix it?", "the second one", "what if we target SMBs?"), and determine
 * whether real-time web research is genuinely required.
 */

import type { ChatMessage } from "../intelligence/types";

export type QueryIntent =
  | "follow_up_why"
  | "follow_up_how"
  | "follow_up_clarification"
  | "scenario_shift"
  | "competitor_comparison"
  | "competitor_inquiry"
  | "action_plan"
  | "weakness_or_problem"
  | "pricing_inquiry"
  | "customer_icp"
  | "new_market_research"
  | "general_strategic";

export interface QueryAnalysis {
  intent: QueryIntent;
  needsWebResearch: boolean;
  searchQuery?: string;
  resolvedReference?: string;
  guidance: string;
  recommendedFormat: "concise_explanation" | "tactical_steps" | "comparison" | "scenario_analysis" | "direct_answer" | "research_synthesis";
}

/**
 * Extracts numbered items (like competitors, options, channels) from the last assistant message.
 */
function extractNumberedItems(text: string): string[] {
  const items: string[] = [];
  // Match patterns like "1. **Name**", "1. Name", "• Name", "- **Name**"
  const regex = /(?:^|\n)\s*(?:\d+[\.\)]|\-|\*|•)\s*(?:\*\*)?([A-Za-z0-9\s\.\-_&]+?)(?:\*\*)?(?:\s*[:\(—–\n]|$)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const candidate = match[1].trim();
    if (candidate.length > 1 && candidate.length < 50 && !items.includes(candidate)) {
      items.push(candidate);
    }
  }
  return items;
}

/**
 * Classifies the user's question with contextual reference resolution.
 */
export function analyzeUserQuery(
  question: string,
  history: ChatMessage[],
  companyName: string = "our company"
): QueryAnalysis {
  const trimmed = question.trim();
  const lower = trimmed.toLowerCase();
  const lastAssistantMsg = [...history].reverse().find((m) => m.role === "assistant");
  const lastUserMsg = [...history].reverse().find((m) => m.role === "user");

  // 1. Follow-up "Why?" question
  if (
    lower === "why?" ||
    lower === "why" ||
    lower === "why is that?" ||
    lower === "why so?" ||
    lower.startsWith("why do you") ||
    lower.startsWith("why would that") ||
    lower.startsWith("what causes that")
  ) {
    return {
      intent: "follow_up_why",
      needsWebResearch: false,
      resolvedReference: lastAssistantMsg ? `Prior answer: "${lastAssistantMsg.content.slice(0, 150)}..."` : undefined,
      recommendedFormat: "concise_explanation",
      guidance:
        "The user is asking 'Why?' directly about the strategic conclusion you just shared in the immediately preceding response. Explain the underlying causal mechanics, market forces, and customer incentives in 1-2 punchy, direct paragraphs. Do NOT repeat yourself or dump a generic consulting overview.",
    };
  }

  // 2. Follow-up "How?" / "How do we fix it?" question
  if (
    lower === "how?" ||
    lower === "how" ||
    lower.includes("how would you fix") ||
    lower.includes("how to fix") ||
    lower.includes("how do we fix") ||
    lower.includes("how would we do that") ||
    lower.includes("how do we solve") ||
    lower.includes("how to solve")
  ) {
    return {
      intent: "follow_up_how",
      needsWebResearch: false,
      resolvedReference: lastAssistantMsg ? `Target issue from previous response` : undefined,
      recommendedFormat: "tactical_steps",
      guidance:
        "The user is asking how to operationalize or resolve the specific strategic problem discussed immediately above. Provide 3-4 pragmatic, sequenced execution steps. Be direct, actionable, and focus on immediate leverage.",
    };
  }

  // 3. Sequential reference resolution (e.g. "the second one", "the third competitor", "the first option")
  const ordinalMatch = lower.match(/(first|second|third|fourth|1st|2nd|3rd|4th)\s*(one|competitor|option|choice|player)?/);
  if (ordinalMatch && (lower.includes("compare") || lower.includes("attack") || lower.includes("what about") || lower.includes("with"))) {
    let resolvedItem = "";
    if (lastAssistantMsg) {
      const items = extractNumberedItems(lastAssistantMsg.content);
      const ordinal = ordinalMatch[1];
      const index = ordinal.startsWith("first") || ordinal.startsWith("1") ? 0
        : ordinal.startsWith("second") || ordinal.startsWith("2") ? 1
        : ordinal.startsWith("third") || ordinal.startsWith("3") ? 2
        : 3;

      if (items[index]) {
        resolvedItem = items[index];
      }
    }

    const target = resolvedItem || ordinalMatch[0];
    const isAttack = lower.includes("attack") || lower.includes("exploit") || lower.includes("vulnerab");

    return {
      intent: "competitor_comparison",
      needsWebResearch: Boolean(resolvedItem && resolvedItem.length > 2),
      searchQuery: resolvedItem ? `${resolvedItem} ${companyName} marketing competitive comparison` : undefined,
      resolvedReference: resolvedItem ? `Target competitor: ${resolvedItem}` : undefined,
      recommendedFormat: isAttack ? "tactical_steps" : "comparison",
      guidance: isAttack
        ? `The user is asking where ${target} would attack us or where we are vulnerable against them. Analyze their specific positioning, resource advantages, and messaging angles they would use against ${companyName}.`
        : `The user wants a direct comparison with ${target}. Compare value proposition, target customer fit, pricing leverage, and specific moats where we win vs. where they win.`,
    };
  }

  // 4. Scenario Shift / Pivot (e.g. "What if we target SMBs instead?", "What if we focus on enterprise?")
  if (
    lower.startsWith("what if we") ||
    lower.startsWith("what if they") ||
    lower.includes("target enterprise instead") ||
    lower.includes("target smbs instead") ||
    lower.includes("target developers instead") ||
    lower.includes("pivot to") ||
    lower.includes("forget the previous")
  ) {
    return {
      intent: "scenario_shift",
      needsWebResearch: false,
      recommendedFormat: "scenario_analysis",
      guidance:
        "The user is testing a strategic hypothesis or segment pivot. Acknowledge the shift immediately. Re-evaluate unit economics, sales cycles, acquisition channels, and product friction for this new scenario. Compare it against the previously discussed baseline.",
    };
  }

  // 5. Pricing inquiries (e.g. "Would that change our pricing strategy?", "Does our pricing make sense?")
  if (
    lower.includes("pricing strategy") ||
    lower.includes("pricing model") ||
    lower.includes("charge more") ||
    lower.includes("charge less") ||
    lower.includes("does our pricing make sense") ||
    lower.includes("pricing problem")
  ) {
    return {
      intent: "pricing_inquiry",
      needsWebResearch: false,
      recommendedFormat: "concise_explanation",
      guidance:
        "The user is asking about pricing strategy in relation to the current customer segment and competitive positioning. Directly evaluate whether current pricing aligns with buyer willingness-to-pay, sales friction, and competitive alternatives.",
    };
  }

  // 6. Action plan requests (e.g. "Give me a concrete 30-day plan", "3 landing page ideas", "what should we do next")
  if (
    lower.includes("30-day plan") ||
    lower.includes("action plan") ||
    lower.includes("next 30 days") ||
    lower.includes("what should we do next") ||
    lower.includes("what next") ||
    lower.includes("landing page ideas") ||
    lower.includes("give me 3") ||
    lower.includes("roadmap")
  ) {
    return {
      intent: "action_plan",
      needsWebResearch: false,
      recommendedFormat: "tactical_steps",
      guidance:
        "Deliver a highly concrete, actionable roadmap or discrete set of ideas directly answering the user's request. Organize chronologically or by high-priority levers. Avoid vague platitudes.",
    };
  }

  // 7. Weakness or Vulnerability analysis
  if (
    lower.includes("biggest weakness") ||
    lower.includes("vulnerability") ||
    lower.includes("threat to our growth") ||
    lower.includes("biggest threat") ||
    lower.includes("where are we weak")
  ) {
    return {
      intent: "weakness_or_problem",
      needsWebResearch: false,
      recommendedFormat: "concise_explanation",
      guidance:
        "Directly identify and break down the company's single most critical strategic vulnerability based on company intelligence and competitive dynamics. Be brutally honest, clear, and analytical.",
    };
  }

  // 8. Competitor Inquiry (e.g. "What are our top 3 competitors?", "Who are our competitors?")
  if (
    lower.includes("top competitors") ||
    lower.includes("who are our competitors") ||
    lower.includes("who are the competitors") ||
    lower.includes("main competitors")
  ) {
    return {
      intent: "competitor_inquiry",
      needsWebResearch: true,
      searchQuery: `${companyName} top competitors market landscape`,
      recommendedFormat: "tactical_steps",
      guidance:
        "List the top competitors cleanly with clear numbers (1., 2., 3.). For each competitor, state their primary angle and who they serve. Keep descriptions crisp so the user can easily follow up on specific players.",
    };
  }

  // 9. Brand new external market research inquiry
  if (
    lower.includes("market size") ||
    lower.includes("industry trend") ||
    lower.includes("market share") ||
    lower.includes("ecommerce platform market") ||
    lower.includes("in 2026") ||
    lower.includes("in the us market")
  ) {
    return {
      intent: "new_market_research",
      needsWebResearch: true,
      searchQuery: trimmed,
      recommendedFormat: "research_synthesis",
      guidance:
        "Ground your answer in real-time verified market data and cite the underlying web research accurately with exact URLs.",
    };
  }

  // 10. General strategic question (Default fallback)
  return {
    intent: "general_strategic",
    needsWebResearch: trimmed.split(" ").length > 4 && !lower.includes("we") && !lower.includes("our"),
    searchQuery: trimmed,
    recommendedFormat: "direct_answer",
    guidance:
      "Answer the user's strategic question directly, concisely, and conversationally. Tie your answer to company facts where relevant. Do NOT dump a boilerplate multi-section report unless explicitly asked for one.",
  };
}
