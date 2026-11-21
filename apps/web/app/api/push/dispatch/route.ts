import { NextResponse } from "next/server";
import {
  authorised,
  isAllowedPushEndpoint,
  sendPush,
  type PushPayload,
} from "../../../../lib/push";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_ITEMS = 200;
const CONCURRENCY = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Item = { sub: string; endpoint: string; p256dh: string; auth: string; payload: PushPayload };

function parseItems(body: unknown): Item[] | null {
  if (!body || typeof body !== "object") return null;
  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length > MAX_ITEMS) return null;
  const out: Item[] = [];
  for (const i of items) {
    if (!i || typeof i !== "object") return null;
    const o = i as Record<string, unknown>;
    if (
      typeof o.sub !== "string" ||
      !UUID.test(o.sub) ||
      typeof o.endpoint !== "string" ||
      typeof o.p256dh !== "string" ||
      typeof o.auth !== "string" ||
      !o.payload ||
      typeof o.payload !== "object"
    )
      return null;
    out.push({
      sub: o.sub,
      endpoint: o.endpoint,
      p256dh: o.p256dh,
      auth: o.auth,
      payload: o.payload as PushPayload,
    });
  }
  return out;
}

/** Called by the database (pg_cron through pg_net) with a bearer secret. Sends each push and reports the status per subscription. */
export async function POST(request: Request) {
  const secret = process.env.PUSH_DISPATCH_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 503 });
  if (!authorised(request.headers.get("authorization"), secret))
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const items = parseItems(body);
  if (!items) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const results: { sub: string; status: number }[] = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const chunk = items.slice(i, i + CONCURRENCY);
    const done = await Promise.all(
      chunk.map(async (it) => ({
        sub: it.sub,
        // endpoints outside the known push services are reported as gone so the database drops them
        status: isAllowedPushEndpoint(it.endpoint) ? await sendPush(it, it.payload) : 410,
      })),
    );
    results.push(...done);
  }
  return NextResponse.json({ results });
}
