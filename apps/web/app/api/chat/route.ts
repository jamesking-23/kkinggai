import { NextResponse } from "next/server";
import { runAssistantTurn } from "../../../lib/assistant";
import { supabaseAssistantData } from "../../../lib/assistant-data";
import { cloudProvider, getPipeline } from "../../../lib/offline-assistant";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Assistant for the website chat. Same turn logic as the phone route, but signed in by the website's session cookie.
 * Row-level security applies because the cookie client acts as the user.
 */
export async function POST(request: Request) {
  let body: { message?: unknown; conversationId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  let ctx: Awaited<ReturnType<typeof getAppContext>>;
  try {
    ctx = await getAppContext();
  } catch {
    return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  }
  const supabase = await createClient();
  const result = await runAssistantTurn(supabase, ctx.current.id, body, {
    pipeline: await getPipeline(),
    data: supabaseAssistantData(supabase, ctx.current.id, ctx.userId, ctx.timezone),
    timeZone: ctx.timezone,
    provider: cloudProvider(process.env),
  });
  if (!result.ok)
    return NextResponse.json(
      { error: result.error, conversationId: result.conversationId },
      { status: 400 },
    );
  return NextResponse.json({ conversationId: result.conversationId, reply: result.reply });
}
