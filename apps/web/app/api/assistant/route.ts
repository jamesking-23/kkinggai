import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { providerFromEnv } from "@kkingg/ai";
import { bearerToken, runAssistantTurn } from "../../../lib/assistant";
import type { Database } from "../../../lib/supabase/database.types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Assistant for the phone app. The app sends its own sign-in token; the call to the AI provider happens here, on
 * the server, so the provider key never reaches the phone. The user's own token is used for every database
 * call, so row-level security applies exactly as on the website.
 */
export async function POST(request: Request) {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Sign in again." }, { status: 401 });

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data: u, error: authError } = await supabase.auth.getUser(token);
  if (authError || !u.user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });

  const provider = providerFromEnv(process.env);
  if (!provider)
    return NextResponse.json(
      { error: "The assistant is not configured: no AI provider key is set on the server." },
      { status: 503 },
    );

  let body: { message?: unknown; conversationId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const ws = await supabase
    .from("workspaces")
    .select("id")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!ws.data)
    return NextResponse.json({ error: "Could not find your workspace." }, { status: 400 });

  const result = await runAssistantTurn(supabase, provider, ws.data.id, body);
  if (!result.ok)
    return NextResponse.json(
      { error: result.error, conversationId: result.conversationId },
      { status: 400 },
    );
  return NextResponse.json({ conversationId: result.conversationId, reply: result.reply });
}
