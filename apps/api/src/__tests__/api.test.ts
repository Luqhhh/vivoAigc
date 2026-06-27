import { describe, expect, it } from "vitest";

import {
  analyzeWithMock,
  answerWithMockTutor,
} from "../providers/mockProvider.js";
import {
  codeAnalyzeResponseSchema,
  tutorChatResponseSchema,
} from "../schemas.js";

const fibonacciCode = `def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

print(fib(4))`;

describe("mock analysis provider", () => {
  it("returns a schema-valid Fibonacci recursion analysis", () => {
    const result = analyzeWithMock({
      language: "python",
      code: fibonacciCode,
      visualizationFocus: "recursion",
      userLevel: "beginner",
    });

    expect(() => codeAnalyzeResponseSchema.parse(result)).not.toThrow();
    expect(result.title).toContain("斐波那契");
    expect(result.traceSteps.length).toBeGreaterThanOrEqual(6);
    expect(result.recursionTree?.nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "fib(4)" })]),
    );
    expect(result.source).toBe("mock");
  });

  it("includes binary-search boundary and midpoint variables", () => {
    const result = analyzeWithMock({
      language: "python",
      code: "def binary_search(items, target):\n    return -1",
    });
    const variableNames = new Set(
      result.traceSteps.flatMap((traceStep) =>
        Object.keys(traceStep.variables),
      ),
    );

    expect(() => codeAnalyzeResponseSchema.parse(result)).not.toThrow();
    expect(variableNames.has("left")).toBe(true);
    expect(variableNames.has("right")).toBe(true);
    expect(variableNames.has("mid")).toBe(true);
  });
});

describe("mock tutor provider", () => {
  it("explains the Fibonacci base case at the current step", () => {
    const result = answerWithMockTutor({
      requestId: "req-test",
      code: fibonacciCode,
      currentStep: 2,
      analysisSummary: "递归计算 fib(4)。",
      question: "为什么这里会返回 1？",
    });

    expect(() => tutorChatResponseSchema.parse(result)).not.toThrow();
    expect(result.requestId).toBe("req-test");
    expect(result.answer).toContain("base case");
    expect(result.referencedSteps.length).toBeGreaterThanOrEqual(1);
    expect(result.source).toBe("mock");
  });
});
