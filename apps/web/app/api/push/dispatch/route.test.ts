import { beforeEach, describe, expect, it, vi } from "vitest";

const sendPush = vi.hoisted(() => vi.fn());
vi.mock("../../../../lib/push", async (orig) => ({
  ...(await orig<typeof import("../../../../lib/push")>()),
  sendPush,
}));

import { POST } from "./route";

const SUB = "11111111-1111-4111-8111-111111111111";
const item = (over = {}) => ({
  sub: SUB,
  endpoint: "https://fcm.googleapis.com/fcm/send/abc",
  p256dh: "A".repeat(87),
  auth: "B".repeat(22),
  payload: { title: "Hi" },
  ...over,
});
const req = (body: unknown, token: string | null = "s3cret") =>
  new Request("http://x/api/push/dispatch", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => {
  sendPush.mockReset();
  process.env.PUSH_DISPATCH_SECRET = "s3cret";
});

describe("POST /api/push/dispatch", () => {
  it("is unavailable until a secret is configured", async () => {
    delete process.env.PUSH_DISPATCH_SECRET;
    expect((await POST(req({ items: [] }))).status).toBe(503);
  });
  it("rejects a missing or wrong secret without sending", async () => {
    expect((await POST(req({ items: [item()] }, null))).status).toBe(401);
    expect((await POST(req({ items: [item()] }, "nope"))).status).toBe(401);
    expect(sendPush).not.toHaveBeenCalled();
  });
  it("rejects malformed bodies", async () => {
    expect((await POST(req("not json"))).status).toBe(400);
    expect((await POST(req({}))).status).toBe(400);
    expect((await POST(req({ items: [item({ sub: "nope" })] }))).status).toBe(400);
    expect((await POST(req({ items: Array(201).fill(item()) }))).status).toBe(400);
  });
  it("reports one status per subscription", async () => {
    sendPush.mockResolvedValueOnce(201).mockResolvedValueOnce(410);
    const other = "22222222-2222-4222-8222-222222222222";
    const res = await POST(req({ items: [item(), item({ sub: other })] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      results: [
        { sub: SUB, status: 201 },
        { sub: other, status: 410 },
      ],
    });
  });
  it("marks endpoints outside the push services as gone without calling out", async () => {
    const res = await POST(req({ items: [item({ endpoint: "https://evil.example/x" })] }));
    expect((await res.json()).results[0].status).toBe(410);
    expect(sendPush).not.toHaveBeenCalled();
  });
});
