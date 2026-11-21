import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn());
vi.mock("web-push", () => ({ sendNotification: send }));

import {
  authorised,
  isAllowedPushEndpoint,
  isValidSubscription,
  sanitizePayload,
  sendPush,
  vapidConfigured,
} from "./push";

const KEY = "A".repeat(87);
const AUTH = "B".repeat(22);
const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", p256dh: KEY, auth: AUTH };

beforeEach(() => {
  send.mockReset();
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
});

describe("push endpoints", () => {
  it("allows the real push services over https", () => {
    for (const e of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
      "https://web.push.apple.com/abc",
    ])
      expect(isAllowedPushEndpoint(e)).toBe(true);
  });
  it("refuses everything else", () => {
    for (const e of [
      "http://fcm.googleapis.com/x",
      "https://evil.example/x",
      "https://fcm.googleapis.com.evil.example/x",
      "https://fcm.googleapis.com@evil.example/x",
      "https://user:pw@fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
      "https://169.254.169.254/latest/meta-data",
      "https://localhost/x",
      "not a url",
      "https://fcm.googleapis.com/" + "a".repeat(3000),
    ])
      expect(isAllowedPushEndpoint(e)).toBe(false);
  });
  it("validates subscription key shape", () => {
    expect(isValidSubscription(sub)).toBe(true);
    expect(isValidSubscription({ ...sub, p256dh: "short" })).toBe(false);
    expect(isValidSubscription({ ...sub, auth: "x".repeat(60) })).toBe(false);
    expect(isValidSubscription({ ...sub, endpoint: "https://evil.example/x" })).toBe(false);
  });
});

describe("payload and auth", () => {
  it("trims long text and keeps links inside the app", () => {
    const p = sanitizePayload({
      title: "t".repeat(500),
      body: "b".repeat(500),
      url: "https://evil.example",
      tag: "x".repeat(200),
    });
    expect(p.title).toHaveLength(120);
    expect(p.body).toHaveLength(200);
    expect(p.tag).toHaveLength(80);
    expect(p.url).toBe("/notifications");
    expect(sanitizePayload({ title: "x", url: "/tasks/123" }).url).toBe("/tasks/123");
    expect(sanitizePayload({ title: "x", url: "//evil.example" }).url).toBe("/notifications");
    expect(sanitizePayload({ title: "" }).title).toBe("KKINGG AI");
  });
  it("checks the bearer secret", () => {
    expect(authorised("Bearer s3cret", "s3cret")).toBe(true);
    expect(authorised("Bearer wrong", "s3cret")).toBe(false);
    expect(authorised("s3cret", "s3cret")).toBe(false);
    expect(authorised(null, "s3cret")).toBe(false);
    expect(authorised("Bearer ", "s3cret")).toBe(false);
    expect(authorised("Bearer x", undefined)).toBe(false);
  });
});

describe("sendPush", () => {
  it("returns the push service status and sends sanitised JSON", async () => {
    send.mockResolvedValue({ statusCode: 201 });
    expect(await sendPush(sub, { title: "Hi", url: "https://evil.example" })).toBe(201);
    const [subscription, body, options] = send.mock.calls[0]!;
    expect(subscription.endpoint).toBe(sub.endpoint);
    expect(JSON.parse(body).url).toBe("/notifications");
    expect(options.vapidDetails.publicKey).toBe("pub");
    expect(options.TTL).toBe(3600);
  });
  it("maps push errors to their status and network failures to 0", async () => {
    send.mockRejectedValueOnce({ statusCode: 410 });
    expect(await sendPush(sub, { title: "x" })).toBe(410);
    send.mockRejectedValueOnce(new Error("boom"));
    expect(await sendPush(sub, { title: "x" })).toBe(0);
  });
  it("does not call out for invalid subscriptions or when unconfigured", async () => {
    expect(await sendPush({ ...sub, endpoint: "https://evil.example/x" }, { title: "x" })).toBe(
      410,
    );
    delete process.env.VAPID_PRIVATE_KEY;
    expect(vapidConfigured()).toBe(false);
    expect(await sendPush(sub, { title: "x" })).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });
});
