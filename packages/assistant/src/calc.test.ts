import { describe, expect, it } from "vitest";
import { CalcError, evaluate, extractExpression, formatNumber } from "./calc";

describe("calc", () => {
  it("evaluates with precedence, brackets, powers and percent", () => {
    expect(evaluate("3 + 4 * 2")).toBe(11);
    expect(evaluate("(3 + 4) * 2")).toBe(14);
    expect(evaluate("2 ^ 3 ^ 2")).toBe(512);
    expect(evaluate("-5 + 2")).toBe(-3);
    expect(evaluate("50%")).toBe(0.5);
    expect(evaluate("1.5 * 4")).toBe(6);
  });
  it("rejects bad input without evaluating code", () => {
    expect(() => evaluate("1 / 0")).toThrow(CalcError);
    expect(() => evaluate("(1 + 2")).toThrow(CalcError);
    expect(() => evaluate("2 +")).toThrow(CalcError);
    expect(() => evaluate("process.exit()")).toThrow(CalcError);
    expect(() => evaluate("1 2")).toThrow(CalcError);
  });
  it("pulls arithmetic out of sentences", () => {
    expect(evaluate(extractExpression("what is 15% of 200?")!)).toBe(30);
    expect(evaluate(extractExpression("calculate 12 times 5")!)).toBe(60);
    expect(evaluate(extractExpression("how much is 250 divided by 4")!)).toBe(62.5);
    expect(evaluate(extractExpression("work out 18 plus 27")!)).toBe(45);
    expect(extractExpression("calculate something")).toBeNull();
  });
  it("formats numbers", () => {
    expect(formatNumber(1234567.891)).toBe("1,234,567.891");
    expect(formatNumber(0.1 + 0.2)).toBe("0.3");
  });
});
