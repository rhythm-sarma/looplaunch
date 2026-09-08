/**
 * POST /api/intelligence/ask
 *
 * Strategic question-answering endpoint.
 * Uses stored intelligence to answer the user's marketing strategy questions.
 *
 * Requires a valid sessionId with status "ready".
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/intelligence/store";
import { answerQuestion } from "@/lib/ai/gemini";
import type { AskResponse, StrategicQuestion } from "@/lib/intelligence/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<StrategicQuestion>;

    // Validate input
    if (!body.sessionId || !body.question) {
      return NextResponse.json(
        { error: "Missing sessionId or question" },
        { status: 400 }
      );
    }

    const { sessionId, question } = body;

    // Get session
    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found or expired" },
        { status: 404 }
      );
    }

    // Check pipeline is complete
    if (session.status !== "ready") {
      return NextResponse.json(
        {
          error: `Intelligence gathering is not complete. Current status: ${session.status}`,
          status: session.status,
          statusMessage: session.statusMessage,
        },
        { status: 409 } // Conflict — pipeline not ready yet
      );
    }

    // Verify we have all required intelligence
    if (
      !session.companyIntelligence ||
      !session.marketIntelligence ||
      !session.diagnosis
    ) {
      return NextResponse.json(
        { error: "Intelligence data is incomplete. Please re-run the gathering pipeline." },
        { status: 500 }
      );
    }

    // Answer the question using Gemini + stored intelligence
    const answer = await answerQuestion(
      question,
      session.companyIntelligence,
      session.competitorIntelligence || [],
      session.marketIntelligence,
      session.diagnosis
    );

    const response: AskResponse = { answer };
    return NextResponse.json(response);
  } catch (error) {
    console.error("[API] /intelligence/ask error:", error);
    return NextResponse.json(
      { error: "Failed to generate answer. Please try again." },
      { status: 500 }
    );
  }
}
