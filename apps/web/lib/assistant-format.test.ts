import { describe, expect, it } from "vitest";
import { blocks, firstName, greeting, inline } from "./assistant-format";

describe("assistant-format", () => {
  it("styles inline markers and leaves unclosed ones alone", () => {
    expect(inline("a **b** `c` *d*")).toEqual([
      { text: "a " },
      { text: "b", bold: true },
      { text: " " },
      { text: "c", code: true },
      { text: " " },
      { text: "d", italic: true },
    ]);
    expect(inline("2 * 3 and **open")).toEqual([{ text: "2 * 3 and **open" }]);
  });

  it("builds paragraphs, headings, lists and code blocks", () => {
    const b = blocks("# Title\nhello\nworld\n\n- one\n2. two\n```js\nlet x = 1;\n```");
    expect(b.map((x) => x.type)).toEqual(["h", "p", "li", "li", "code"]);
    expect(b[3]).toMatchObject({ marker: "2." });
    expect(b[4]).toEqual({ type: "code", text: "let x = 1;" });
  });

  it("greets by hour and picks a first name", () => {
    expect(greeting(3)).toBe("Good night");
    expect(greeting(9)).toBe("Good morning");
    expect(greeting(14)).toBe("Good afternoon");
    expect(greeting(20)).toBe("Good evening");
    expect(firstName("Ezra James")).toBe("Ezra");
    expect(firstName("  ")).toBe("there");
  });
});
