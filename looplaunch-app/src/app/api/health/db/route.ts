import { NextResponse } from "next/server";
import { checkSupabaseConnection } from "@/lib/db/supabase";

/**
 * GET /api/health/db: is the database reachable? Public, so it says only yes or no; the
 * reason goes to the server log.
 */
export async function GET() {
  try {
    const health = await checkSupabaseConnection();
    if (health.ok) return NextResponse.json({ status: "ok", connected: true });
    console.error("[Health] Database check failed:", health.message);
    return NextResponse.json({ status: "error", connected: false }, { status: 503 });
  } catch (error) {
    console.error("[Health] Database check failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ status: "error", connected: false }, { status: 500 });
  }
}
