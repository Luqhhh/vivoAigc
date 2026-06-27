import { describe, expect, it } from "vitest";

import {
  analyzeWithMock,
  answerWithMockTutor,
} from "../providers/mockProvider.js";
import {
  codeAnalyzeResponseSchema,
  tutorChatResponseSchema,
} from "../schemas.js";
import { fibonacciAnalysis } from "../mockData.js";

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

  it("assigns a different request ID to each analysis", () => {
    const first = analyzeWithMock({ language: "python", code: fibonacciCode });
    const second = analyzeWithMock({ language: "python", code: fibonacciCode });

    expect(first.requestId).not.toBe(second.requestId);
  });

  it("isolates nested response data from the base fixture and later calls", () => {
    const first = analyzeWithMock({ language: "python", code: fibonacciCode });
    const originalDescription = fibonacciAnalysis.traceSteps[0].description;
    const originalN = fibonacciAnalysis.traceSteps[0].variables.n;
    const originalFunctionName =
      fibonacciAnalysis.stackFrames[0].frames[0].functionName;
    const originalNodeLabel = fibonacciAnalysis.recursionTree?.nodes[0].label;

    try {
      first.traceSteps[0].description = "mutated trace";
      first.traceSteps[0].variables.n = 999;
      first.stackFrames[0].frames[0].functionName = "mutated frame";
      first.recursionTree!.nodes[0].label = "mutated node";

      const fresh = analyzeWithMock({ language: "python", code: fibonacciCode });

      expect(fresh.traceSteps[0].description).toBe(originalDescription);
      expect(fresh.traceSteps[0].variables.n).toBe(originalN);
      expect(fresh.stackFrames[0].frames[0].functionName).toBe(
        originalFunctionName,
      );
      expect(fresh.recursionTree?.nodes[0].label).toBe(originalNodeLabel);
      expect(fibonacciAnalysis.traceSteps[0].description).toBe(
        originalDescription,
      );
      expect(first.traceSteps).not.toBe(fresh.traceSteps);
      expect(first.traceSteps[0].variables).not.toBe(
        fresh.traceSteps[0].variables,
      );
    } finally {
      first.traceSteps[0].description = originalDescription;
      first.traceSteps[0].variables.n = originalN;
      first.stackFrames[0].frames[0].functionName = originalFunctionName;
      first.recursionTree!.nodes[0].label = originalNodeLabel ?? "fib(4)";
    }
  });

  it("selects binary, Fibonacci, and generic fallback analyses", () => {
    const binary = analyzeWithMock({
      language: "python",
      code: "def binary_search(items, target):\n    return -1",
    });
    const fibonacci = analyzeWithMock({
      language: "python",
      code: fibonacciCode,
    });
    const fallback = analyzeWithMock({
      language: "python",
      code: "print('hello')",
    });

    for (const result of [binary, fibonacci, fallback]) {
      expect(() => codeAnalyzeResponseSchema.parse(result)).not.toThrow();
    }
    expect(binary.title).toBe("二分查找区间变化");
    expect(fibonacci.title).toBe("斐波那契递归执行过程");
    expect(fallback.title).toBe("Python 算法片段演示");
    expect(fallback.summary).toBe(
      "当前使用稳定 mock 分析结果演示 CodeMotion 的执行可视化能力。",
    );
    expect(fallback.warnings).toEqual([
      {
        code: "MOCK_USED",
        message: "未识别到专用示例，当前返回稳定 mock 演示结果。",
      },
    ]);
  });

  it("resolves every Fibonacci trace reference to stack and recursion data", () => {
    const result = analyzeWithMock({ language: "python", code: fibonacciCode });
    const frameIds = new Set(
      result.stackFrames.flatMap((snapshot) =>
        snapshot.frames.map((frame) => frame.id),
      ),
    );
    const unresolvedFrameIds = [
      ...new Set(
        result.traceSteps.flatMap((traceStep) =>
          traceStep.activeFrameId ? [traceStep.activeFrameId] : [],
        ),
      ),
    ].filter((frameId) => !frameIds.has(frameId));
    const recursionTree = result.recursionTree!;
    const recursionNodeIds = new Set(
      recursionTree.nodes.map((node) => node.id),
    );
    const unresolvedTraceNodeIds = [
      ...new Set(
        result.traceSteps.flatMap((traceStep) =>
          traceStep.activeRecursionNodeId
            ? [traceStep.activeRecursionNodeId]
            : [],
        ),
      ),
    ].filter((nodeId) => !recursionNodeIds.has(nodeId));
    const unresolvedEdges = recursionTree.edges.filter(
      (edge) =>
        !recursionNodeIds.has(edge.from) || !recursionNodeIds.has(edge.to),
    );

    expect(unresolvedFrameIds).toEqual([]);
    expect(unresolvedTraceNodeIds).toEqual([]);
    expect(recursionNodeIds.has(recursionTree.rootId)).toBe(true);
    expect(unresolvedEdges).toEqual([]);
  });

  it("narrows binary-search boundaries and midpoint over time", () => {
    const result = analyzeWithMock({
      language: "python",
      code: "def binary_search(items, target):\n    return -1",
    });
    const distinctValueCount = (name: "left" | "right" | "mid") =>
      new Set(
        result.traceSteps.flatMap((traceStep) => {
          const value = traceStep.variables[name];
          return typeof value === "number" ? [value] : [];
        }),
      ).size;

    expect(() => codeAnalyzeResponseSchema.parse(result)).not.toThrow();
    expect(distinctValueCount("left")).toBeGreaterThanOrEqual(2);
    expect(distinctValueCount("right")).toBeGreaterThanOrEqual(2);
    expect(distinctValueCount("mid")).toBeGreaterThanOrEqual(2);
  });
});

describe("mock tutor provider", () => {
  it("does not mislabel a non-base Fibonacci step", () => {
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
    expect(result.answer).toContain("当前步骤不是 base case");
    expect(result.answer).toContain("fib(1)");
    expect(result.answer).toContain("fib(0)");
    expect(result.referencedSteps).toEqual([2]);
    expect(result.suggestedFollowups).toHaveLength(3);
    expect(result.source).toBe("mock");
  });

  it("identifies an actual Fibonacci base-case return step", () => {
    const result = answerWithMockTutor({
      requestId: "req-base-case",
      code: fibonacciCode,
      currentStep: 7,
      analysisSummary: "递归计算 fib(4)。",
      question: "这一步发生了什么？",
    });

    expect(() => tutorChatResponseSchema.parse(result)).not.toThrow();
    expect(result.requestId).toBe("req-base-case");
    expect(result.answer).toContain("当前步骤是 base case 返回");
    expect(result.answer).toContain("fib(1)");
    expect(result.referencedSteps).toEqual([7]);
    expect(result.suggestedFollowups).toHaveLength(3);
    expect(result.source).toBe("mock");
  });

  it("defaults tutor references to step 1", () => {
    const result = answerWithMockTutor({
      requestId: "req-default-step",
      code: fibonacciCode,
      analysisSummary: "递归计算 fib(4)。",
      question: "从哪里开始？",
    });

    expect(result.referencedSteps).toEqual([1]);
  });

  it("explains binary-search state without applying Fibonacci step metadata", () => {
    const result = answerWithMockTutor({
      requestId: "req-binary-tutor",
      code: "def binary_search(items, target): return 3",
      currentStep: 7,
      analysisSummary: "二分查找通过收缩边界定位目标。",
      question: "这一轮为什么继续查找？",
    });

    expect(() => tutorChatResponseSchema.parse(result)).not.toThrow();
    expect(result.requestId).toBe("req-binary-tutor");
    expect(result.source).toBe("mock");
    expect(result.referencedSteps).toEqual([7]);
    expect(result.suggestedFollowups).toHaveLength(3);
    expect(result.answer).toContain("二分查找");
    expect(result.answer).toContain("left");
    expect(result.answer).toContain("right");
    expect(result.answer).toContain("mid");
    expect(result.answer).not.toContain("fib(");
    expect(result.answer).not.toContain("base case");
  });

  it("answers generic code neutrally when its step collides with Fibonacci", () => {
    const result = answerWithMockTutor({
      requestId: "req-generic-tutor",
      code: "total = 0\nfor number in range(3):\n    total += number",
      currentStep: 7,
      analysisSummary: "循环累加每个 number。",
      question: "当前状态如何变化？",
    });

    expect(() => tutorChatResponseSchema.parse(result)).not.toThrow();
    expect(result.requestId).toBe("req-generic-tutor");
    expect(result.source).toBe("mock");
    expect(result.referencedSteps).toEqual([7]);
    expect(result.suggestedFollowups).toHaveLength(3);
    expect(result.answer).toContain("当前第 7 步");
    expect(result.answer).toContain("循环累加每个 number。");
    expect(result.answer).toContain("当前状态如何变化？");
    expect(result.answer).not.toContain("fib(");
    expect(result.answer).not.toContain("二分查找");
    expect(result.answer).not.toContain("base case");
  });
});
