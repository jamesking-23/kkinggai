// Server-side web push helpers. Never import from client components (uses the VAPID private key).
import { createHash, timingSafeEqual } from "node:crypto";
import { sendNotification } from "web-push";

export type PushSub = { endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body?: string; url?: string; tag?: string };

/** Hosts of the browser push services. The server only ever sends to these, so a registered endpoint cannot be used to reach other hosts. */
const PUSH_HOSTS: RegExp[] = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.push\.services\.mozilla\.com$/,
  /^[a-z0-9.-]+\.notify\.windows\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9.-]+\.push\.apple\.com$/,
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  if (endpoint.length > 2048) return false;
  let u: URL;
  try {
    u = new URL(endpoint);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
  return PUSH_HOSTS.some((re) => re.test(u.hostname));
}

const b64url = (min: number, max: number) => new RegExp(`^[A-Za-z0-9_-]{${min},${max}}$`);
export function isValidSubscription(s: PushSub): boolean {
  return (
    isAllowedPushEndpoint(s.endpoint) &&
    b64url(80, 100).test(s.p256dh) &&
    b64url(22, 43).test(s.auth)
  );
}

/** Trims a payload to what a push can safely carry; the link must stay inside the app. */
export function sanitizePayload(p: PushPayload): PushPayload {
  const url =
    typeof p.url === "string" && /^\/(?!\/)[A-Za-z0-9/_?=&.-]{0,200}$/.test(p.url)
      ? p.url
      : "/notifications";
  return {
    title: String(p.title ?? "").slice(0, 120) || "KKINGG AI",
    body: String(p.body ?? "").slice(0, 200),
    url,
    tag: String(p.tag ?? "").slice(0, 80) || undefined,
  };
}

export function vapidConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/** Sends one push. Returns the push service's HTTP status (201 delivered, 404/410 subscription gone), or 0 on a network failure or missing configuration. */
export async function sendPush(sub: PushSub, payload: PushPayload): Promise<number> {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return 0;
  if (!isValidSubscription(sub)) return 410;
  try {
    const res = await sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(sanitizePayload(payload)),
      {
        vapidDetails: {
          subject: process.env.VAPID_SUBJECT || "https://kkingg-ai.vercel.app",
          publicKey: pub,
          privateKey: priv,
        },
        TTL: 3600,
        timeout: 10_000,
      },
    );
    return res.statusCode;
  } catch (e) {
    const code = (e as { statusCode?: unknown }).statusCode;
    return typeof code === "number" ? code : 0;
  }
}

/** Compares a request's bearer token to the shared secret without leaking length or content through timing. */
export function authorised(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const a = createHash("sha256").update(header.slice(7)).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}
