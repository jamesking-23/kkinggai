import { describe, expect, it } from "vitest";
import {
  checkMessage,
  conversationTitle,
  parseReply,
  requestBody,
  visibleMessages,
  type MessageRow,
} from "./assistant";

describe("assistant", () => {
  it("validates messages", () => {
    expect(checkMessage("  hi ")).toEqual({ message: "hi" });
    expect(checkMessage("  ")).toBe("Type a message.");
    expect(checkMessage("x".repeat(4001))).toMatch(/limited/);
  });

  it("parses the server answer", () => {
    expect(parseReply(200, { conversationId: "c1", reply: "Hello" })).toEqual({
      ok: true,
      conversationId: "c1",
      reply: "Hello",
    });
    expect(parseReply(400, { error: "Daily limit reached.", conversationId: "c1" })).toEqual({
      ok: false,
      error: "Daily limit reached.",
      conversationId: "c1",
    });
    expect(parseReply(401, {})).toMatchObject({
      ok: false,
      error: expect.stringMatching(/Sign in/),
    });
    expect(parseReply(503, null)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/could not answer/),
    });
    expect(parseReply(200, { reply: "x" }).ok).toBe(false);
  });

  it("builds the request body", () => {
    expect(JSON.parse(requestBody("hi", null))).toEqual({ message: "hi" });
    expect(JSON.parse(requestBody("hi", "c1"))).toEqual({ message: "hi", conversationId: "c1" });
  });

  it("titles conversations and hides system messages", () => {
    expect(conversationTitle({ title: " " })).toBe("New chat");
    expect(conversationTitle({ title: "Plan" })).toBe("Plan");
    const list: MessageRow[] = [
      { id: "1", role: "system", content: "s" },
      { id: "2", role: "user", content: "u" },
    ];
    expect(visibleMessages(list).map((m) => m.id)).toEqual(["2"]);
  });
});
