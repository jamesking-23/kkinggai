import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { bearerToken, runAssistantTurn } from "../../../lib/assistant";
import { supabaseAssistantData } from "../../../lib/assistant-data";
import { cloudProvider, getOfflineAssistant } from "../../../lib/offline-assistant";
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

  const { data: prefs } = await supabase
    .from("user_settings")
    .select("timezone")
    .eq("user_id", u.user.id)
    .maybeSingle();
  const timeZone = prefs?.timezone || "UTC";

  const result = await runAssistantTurn(supabase, ws.data.id, body, {
    assistant: await getOfflineAssistant(),
    data: supabaseAssistantData(supabase, ws.data.id, u.user.id, timeZone),
    timeZone,
    provider: cloudProvider(process.env),
  });
  if (!result.ok)
    return NextResponse.json(
      { error: result.error, conversationId: result.conversationId },
      { status: 400 },
    );
  return NextResponse.json({ conversationId: result.conversationId, reply: result.reply });
}
