import { describe, expect, it } from "vitest";
import { blocks, COMMANDS, firstName, inline, keyboardOverlap, STARTERS } from "./assistantFormat";

describe("inline", () => {
  it("styles bold, italic and code, leaves the rest", () => {
    expect(inline("a **b** *c* `d` e")).toEqual([
      { text: "a " },
      { text: "b", bold: true },
      { text: " " },
      { text: "c", italic: true },
      { text: " " },
      { text: "d", code: true },
      { text: " e" },
    ]);
  });
  it("keeps unclosed markers as text and 2*3 as maths", () => {
    expect(inline("2 * 3 and **open")).toEqual([{ text: "2 * 3 and **open" }]);
  });
});

describe("blocks", () => {
  it("parses headings, lists, paragraphs and code", () => {
    const b = blocks(
      "# Title\nHello\nworld\n\n- one\n* two\n1. first\n2) second\n```js\nlet x = 1;\n```\nend",
    );
    expect(b.map((x) => x.type)).toEqual(["h", "p", "li", "li", "li", "li", "code", "p"]);
    expect(b[1]).toEqual({ type: "p", spans: [{ text: "Hello\nworld" }] });
    expect(b[4]).toMatchObject({ marker: "1." });
    expect(b[6]).toEqual({ type: "code", text: "let x = 1;" });
  });
  it("handles an unclosed code fence and empty input", () => {
    expect(blocks("```\nabc")).toEqual([{ type: "code", text: "abc" }]);
    expect(blocks("")).toEqual([]);
  });
});

describe("helpers", () => {
  it("computes how much the keyboard covers", () => {
    expect(keyboardOverlap(2300, 1500)).toBe(800);
    expect(keyboardOverlap(1500, 1500)).toBe(0);
    expect(keyboardOverlap(1400, 1500)).toBe(0); // window already resized above the keyboard
  });
  it("greets by first name", () => {
    expect(firstName("Ezra James")).toBe("Ezra");
    expect(firstName("  ")).toBe("there");
    expect(firstName(null)).toBe("there");
  });
  it("offers starters and commands that are usable", () => {
    for (const s of [...STARTERS, ...COMMANDS])
      expect(Boolean(s.send) !== Boolean(s.fill)).toBe(true);
  });
});
