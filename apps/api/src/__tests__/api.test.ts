import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app.js";
import {
  analyzeWithMock,
  answerWithMockTutor,
} from "../providers/mockProvider.js";
import {
  codeAnalyzeResponseSchema,
  tutorChatResponseSchema,
} from "../schemas.js";
import { examples, fibonacciAnalysis } from "../mockData.js";

const fibonacciCode = `def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

print(fib(4))`;

const binarySearchCode = `def binary_search(nums, target):
    left, right = 0, len(nums) - 1
    while left <= right:
        mid = (left + right) // 2
        if nums[mid] == target:
            return mid
        elif nums[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1

print(binary_search([1, 3, 5, 7, 9], 7))`;

const bracketDatasetCode = `def is_valid(s):
    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    for ch in s:
        if ch in '([{':
            stack.append(ch)
        elif ch in pairs:
            if not stack or stack[-1] != pairs[ch]:
                return False
            stack.pop()
    return not stack

print(is_valid('([])'))`;

type TraceSnapshot = {
  event: string;
  variables: Record<string, unknown>;
  changedVariables: string[];
  activeFrameId?: string;
  stdout?: string;
};

function expectOrderedEvents(
  traceSteps: TraceSnapshot[],
  expectedEvents: readonly string[],
): void {
  let expectedIndex = 0;

  for (const traceStep of traceSteps) {
    if (traceStep.event === expectedEvents[expectedIndex]) {
      expectedIndex += 1;
    }
  }

  expect(expectedIndex).toBe(expectedEvents.length);
}

function changedValues(
  traceSteps: TraceSnapshot[],
  variable: string,
): unknown[] {
  return traceSteps
    .filter(({ changedVariables }) => changedVariables.includes(variable))
    .map(({ variables }) => variables[variable]);
}

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
      code: binarySearchCode,
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
    expect(fallback.summary).not.toContain("fib");
    expect(fallback.summary).not.toContain("斐波那契");
    expect(fallback.warnings).toEqual([
      {
        code: "MOCK_USED",
        message: "未识别到专用示例，当前返回稳定 mock 演示结果。",
      },
    ]);
    expect(fallback.lineExplanations).toEqual([
      expect.objectContaining({ line: 1, code: "print('hello')" }),
    ]);
    expect(fallback.traceSteps).toHaveLength(2);
    expect(fallback.traceSteps.map(({ event }) => event)).toEqual([
      "start",
      "end",
    ]);
  });

  it("does not select Fibonacci solely from recursion visualization focus", () => {
    const result = analyzeWithMock({
      language: "python",
      code: "value = 2\nprint(value)",
      visualizationFocus: "recursion",
    });

    expect(result.title).toBe("Python 算法片段演示");
    expect(result.summary).not.toContain("fib");
    expect(result.summary).not.toContain("斐波那契");
    expect(result.lineExplanations.map(({ code }) => code)).toEqual([
      "value = 2",
      "print(value)",
    ]);
  });

  it("does not trim a leading blank line when matching a built-in example", () => {
    const result = analyzeWithMock({
      language: "python",
      code: `\n${fibonacciCode}`,
    });

    expect(result.title).toBe("Python 算法片段演示");
    expect(result.lineExplanations[0]).toEqual(
      expect.objectContaining({ line: 2, code: "def fib(n):" }),
    );
    expect(result.traceSteps[0].line).toBe(2);
  });

  it.each(["\r\n", "\r"])(
    "matches built-in examples after normalizing %j newlines",
    (newline) => {
      const result = analyzeWithMock({
        language: "python",
        code: binarySearchCode.replace(/\n/g, newline),
      });

      expect(result.title).toBe("二分查找区间变化");
      expect(result.warnings).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "MOCK_USED" }),
        ]),
      );
    },
  );

  it("splits CR-only unknown code without losing source line numbers", () => {
    const result = analyzeWithMock({
      language: "python",
      code: "first = 1\rsecond = 2\rprint(second)",
    });

    expect(result.lineExplanations).toEqual([
      expect.objectContaining({ line: 1, code: "first = 1" }),
      expect.objectContaining({ line: 2, code: "second = 2" }),
      expect.objectContaining({ line: 3, code: "print(second)" }),
    ]);
    expect(result.traceSteps.map(({ line }) => line)).toEqual([1, 3]);
    expect(result.traceSteps[0].variables.lineCount).toBe(3);
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
      code: binarySearchCode,
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
    expect(distinctValueCount("right")).toBeGreaterThanOrEqual(1);
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
    expect(result.referencedSteps).toEqual([2, 7, 9, 12, 16, 18]);
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

  it("covers every explicitly named Fibonacci base-case step", () => {
    const result = answerWithMockTutor({
      requestId: "req-base-case-references",
      code: fibonacciCode,
      currentStep: 2,
      analysisSummary: "递归计算 fib(4)。",
      question: "哪些步骤命中递归出口？",
    });
    const namedStepList = result.answer.match(
      /真正的 base case 返回发生在第 ([\d、]+) 步/,
    )?.[1];
    const namedSteps = namedStepList?.split("、").map(Number) ?? [];

    expect(namedSteps).toEqual([7, 9, 12, 16, 18]);
    expect(result.referencedSteps).toEqual(
      expect.arrayContaining(namedSteps),
    );
  });

  it("defaults tutor references to step 1", () => {
    const result = answerWithMockTutor({
      requestId: "req-default-step",
      code: fibonacciCode,
      analysisSummary: "递归计算 fib(4)。",
      question: "从哪里开始？",
    });

    expect(result.referencedSteps).toEqual([1, 7, 9, 12, 16, 18]);
  });

  it("explains binary-search state without applying Fibonacci step metadata", () => {
    const result = answerWithMockTutor({
      requestId: "req-binary-tutor",
      code: binarySearchCode,
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

  it.each([
    {
      name: "custom Fibonacci",
      code: "def fib(n):\n    return 42",
      forbidden: /fib\(|base case|第 9 步|第 12 步/,
    },
    {
      name: "pseudo binary search",
      code: [
        "def binary_search(items, target):",
        "    left = 0",
        "    mid = 0",
        "    return 42",
      ].join("\n"),
      forbidden: /二分查找|left|right|mid/,
    },
  ])("answers $name with generic tutor semantics", ({ code, forbidden }) => {
    const result = answerWithMockTutor({
      requestId: "req-custom-tutor",
      code,
      currentStep: 7,
      analysisSummary: "自定义函数固定返回常量。",
      question: "当前步骤如何理解？",
    });

    expect(() => tutorChatResponseSchema.parse(result)).not.toThrow();
    expect(result.answer).toContain("当前第 2 步需要结合已有分析理解");
    expect(result.answer).not.toMatch(forbidden);
    expect(result.referencedSteps).toEqual([2]);
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
    expect(result.referencedSteps).toEqual([2]);
    expect(result.suggestedFollowups).toHaveLength(3);
    expect(result.answer).toBe("当前第 2 步需要结合已有分析理解。");
    expect(result.answer).not.toContain("fib(");
    expect(result.answer).not.toContain("二分查找");
    expect(result.answer).not.toContain("base case");
  });

  it("does not echo unreferenced steps from generic tutor inputs", () => {
    const result = answerWithMockTutor({
      requestId: "req-generic-unreferenced-steps",
      code: "value = 1\nprint(value)",
      currentStep: 7,
      analysisSummary: "第 3 步完成初始化。",
      question: "第 5 步是否会返回结果？",
    });

    expect(() => tutorChatResponseSchema.parse(result)).not.toThrow();
    expect(result.answer).toBe("当前第 2 步需要结合已有分析理解。");
    expect(result.answer).not.toMatch(/第 [35] 步/);
    expect(result.referencedSteps).toEqual([2]);
    expect(result.suggestedFollowups).toEqual([
      "这一步执行前后的状态有什么变化？",
      "当前条件会如何影响下一步？",
      "可以用更小的输入手动跟踪吗？",
    ]);
  });
});

const originalFetch = globalThis.fetch;
const originalLlmMode = process.env.LLM_MODE;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalLlmMode === undefined) {
    delete process.env.LLM_MODE;
  } else {
    process.env.LLM_MODE = originalLlmMode;
  }
  vi.restoreAllMocks();
});

describe("CodeMotion API", () => {
  it("reports service health and normalized mock mode", async () => {
    const response = await request(createApp({ llmMode: "mock" }))
      .get("/api/health")
      .expect(200);

    expect(response.body).toEqual({
      ok: true,
      service: "codemotion-api",
      llmMode: "mock",
      version: "1.0.0",
    });
  });

  it("uses process environment defaults when app options are omitted", async () => {
    process.env.LLM_MODE = "real";

    const response = await request(createApp()).get("/api/health").expect(200);

    expect(response.body.llmMode).toBe("real");
  });

  it("reflects the request origin when wildcard CORS is configured", async () => {
    const origin = "https://frontend.example.test";
    const response = await request(createApp({ FRONTEND_ORIGIN: "*" }))
      .get("/api/health")
      .set("origin", origin)
      .expect(200);

    expect(response.headers["access-control-allow-origin"]).toBe(origin);
  });

  it("allows every origin in a comma-separated CORS configuration", async () => {
    const app = createApp({
      FRONTEND_ORIGIN:
        "https://web.example.test, https://localhost",
    });

    for (const origin of ["https://web.example.test", "https://localhost"]) {
      const response = await request(app)
        .get("/api/health")
        .set("origin", origin)
        .expect(200);

      expect(response.headers["access-control-allow-origin"]).toBe(origin);
    }
  });

  it("does not grant CORS access to an origin outside the configured list", async () => {
    const response = await request(
      createApp({
        FRONTEND_ORIGIN:
          "https://web.example.test,https://localhost",
      }),
    )
      .get("/api/health")
      .set("origin", "https://unlisted.example.test")
      .expect(200);

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("keeps requests without an Origin header available", async () => {
    const response = await request(
      createApp({
        FRONTEND_ORIGIN:
          "https://web.example.test,https://localhost",
      }),
    )
      .get("/api/health")
      .expect(200);

    expect(response.body.ok).toBe(true);
  });

  it("keeps a single exact CORS origin compatible", async () => {
    const origin = "https://web.example.test";
    const response = await request(createApp({ FRONTEND_ORIGIN: origin }))
      .get("/api/health")
      .set("origin", origin)
      .expect(200);

    expect(response.headers["access-control-allow-origin"]).toBe(origin);
  });

  it("allows Capacitor JSON POST preflight requests", async () => {
    const response = await request(
      createApp({ FRONTEND_ORIGIN: "https://localhost" }),
    )
      .options("/api/analyze-code")
      .set("Origin", "https://localhost")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type")
      .expect(204);

    expect(response.headers["access-control-allow-origin"]).toBe(
      "https://localhost",
    );
    expect(response.headers["access-control-allow-headers"]).toBe(
      "content-type",
    );
    expect(response.headers["access-control-allow-methods"])
      .toContain("POST");
  });

  it("returns exactly five examples including Fibonacci recursion", async () => {
    const response = await request(createApp({ llmMode: "mock" }))
      .get("/api/examples")
      .expect(200);
    const categories = [
      "recursion",
      "binary-search",
      "stack",
      "dfs",
      "dp",
    ];
    const difficulties = ["beginner", "intermediate", "advanced"];
    const visualizations = [
      "timeline",
      "stack",
      "recursion-tree",
      "variables",
    ];

    expect(response.body.examples).toHaveLength(5);
    expect(response.body.examples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "fibonacci-recursion" }),
      ]),
    );
    const actualCategories = response.body.examples.map(
      (example: { category: string }) => example.category,
    );
    expect(new Set(actualCategories)).toEqual(new Set(categories));
    const exampleIds = response.body.examples.map(
      (example: { id: string }) => example.id,
    );
    expect(new Set(exampleIds).size).toBe(exampleIds.length);
    for (const example of response.body.examples) {
      expect(example).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          title: expect.any(String),
          category: expect.any(String),
          difficulty: expect.any(String),
          concepts: expect.any(Array),
          code: expect.any(String),
          expectedVisualization: expect.any(Array),
        }),
      );
      expect(example.id.length).toBeGreaterThan(0);
      expect(example.title.length).toBeGreaterThan(0);
      expect(example.concepts.length).toBeGreaterThan(0);
      expect(example.code.length).toBeGreaterThan(0);
      expect(example.expectedVisualization.length).toBeGreaterThan(0);
      expect(categories).toContain(example.category);
      expect(difficulties).toContain(example.difficulty);
      for (const visualization of example.expectedVisualization) {
        expect(visualizations).toContain(visualization);
      }
    }
  });

  it("analyzes every built-in example with algorithm-specific mock data", async () => {
    const app = createApp({ llmMode: "mock" });
    const examplesResponse = await request(app).get("/api/examples").expect(200);
    const expectations = {
      recursion: {
        title: "斐波那契",
        summary: "fib(4)",
        events: ["start", "call", "condition", "return", "output", "end"],
        time: "O(2^n)",
        space: "O(n)",
      },
      "binary-search": {
        title: "二分查找",
        summary: "目标值",
        events: ["start", "assign", "condition", "return", "output", "end"],
        time: "O(log n)",
        space: "O(1)",
      },
      stack: {
        title: "括号匹配",
        summary: "栈",
        events: ["start", "push", "push", "pop", "pop", "return", "output"],
        time: "O(n)",
        space: "O(n)",
      },
      dfs: {
        title: "深度优先搜索",
        summary: "grid",
        events: ["start", "call", "call", "return", "output"],
        time: "O(rows * cols)",
        space: "O(rows * cols)",
      },
      dp: {
        title: "爬楼梯",
        summary: "previous",
        events: ["start", "assign", "loop", "loop", "loop", "loop", "loop", "return", "output"],
        time: "O(n)",
        space: "O(1)",
      },
    } as const;
    const titles = new Set<string>();
    const summaries = new Set<string>();

    for (const example of examplesResponse.body.examples) {
      const response = await request(app)
        .post("/api/analyze-code")
        .send({ language: "python", code: example.code })
        .expect(200);
      const expected =
        expectations[example.category as keyof typeof expectations];
      const sourceLines = example.code.split("\n");
      const traceSteps = response.body.traceSteps as TraceSnapshot[];

      expect(() => codeAnalyzeResponseSchema.parse(response.body)).not.toThrow();
      expect(response.body.title).toContain(expected.title);
      expect(response.body.summary).toContain(expected.summary);
      expect(response.body.complexity).toEqual(
        expect.objectContaining({
          time: expected.time,
          space: expected.space,
          explanation: expect.any(String),
        }),
      );
      expect(response.body.traceSteps.length).toBeGreaterThanOrEqual(2);
      expect(response.body.warnings).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "MOCK_USED" })]),
      );
      for (const explanation of response.body.lineExplanations) {
        if (explanation.code.trim().length > 0) {
          expect(explanation.code).toBe(sourceLines[explanation.line - 1]);
        }
      }
      expectOrderedEvents(traceSteps, expected.events);

      switch (example.category) {
        case "recursion":
          expect(traceSteps[0].variables.n).toBe(4);
          expect(traceSteps.some(({ variables }) => variables.returnValue === 3))
            .toBe(true);
          expect(traceSteps.find(({ event }) => event === "output")?.stdout)
            .toBe("3");
          break;
        case "binary-search":
          expect(changedValues(traceSteps, "left")).toEqual([0, 3]);
          expect(changedValues(traceSteps, "right")).toEqual([4]);
          expect(changedValues(traceSteps, "mid")).toEqual([2, 3]);
          expect(traceSteps.some(({ variables }) => variables.returnValue === 3))
            .toBe(true);
          expect(traceSteps.find(({ event }) => event === "output")?.stdout)
            .toBe("3");
          break;
        case "stack":
          expect(changedValues(traceSteps, "stack")).toEqual([
            "",
            "(",
            "([",
            "(",
            "",
          ]);
          expect(traceSteps.find(({ event }) => event === "return")?.variables.returnValue)
            .toBe(true);
          expect(traceSteps.find(({ event }) => event === "output")?.stdout)
            .toBe("True");
          break;
        case "dfs":
          expect(changedValues(traceSteps, "visited").at(0)).toBe("");
          expect(changedValues(traceSteps, "visited").at(-1)).toBe(
            "(0,0),(0,1),(1,1),(1,2),(2,2)",
          );
          expect(traceSteps.at(-2)?.variables.visitedCount).toBe(5);
          expect(traceSteps.at(-1)?.stdout).toBe("5");
          expect(response.body.stackFrames.length).toBeGreaterThan(0);
          for (const step of traceSteps) {
            if (step.activeFrameId) {
              expect(response.body.stackFrames.some(
                (snapshot: { frames: Array<{ id: string }> }) =>
                  snapshot.frames.some(({ id }) => id === step.activeFrameId),
              )).toBe(true);
            }
          }
          break;
        case "dp":
          expect(changedValues(traceSteps, "previous")).toEqual([1, 2, 3, 5, 8]);
          expect(changedValues(traceSteps, "current")).toEqual([1, 2, 3, 5, 8, 13]);
          expect(traceSteps.some(({ variables }) => variables.returnValue === 8))
            .toBe(true);
          expect(traceSteps.find(({ event }) => event === "output")?.stdout)
            .toBe("8");
          break;
      }

      titles.add(response.body.title);
      summaries.add(response.body.summary);
    }

    expect(titles.size).toBe(5);
    expect(summaries.size).toBe(5);
  });

  it.each([
    [binarySearchCode, "二分查找", "3"],
    [bracketDatasetCode, "括号匹配", "True"],
  ])("supports the fixed acceptance dataset without generic fallback", async (code, title, stdout) => {
    const response = await request(createApp({ llmMode: "mock" }))
      .post("/api/analyze-code")
      .send({ language: "python", code })
      .expect(200);

    expect(response.body.title).toContain(title);
    expect(response.body.warnings).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "MOCK_USED" })]),
    );
    expect(response.body.traceSteps.some(
      (step: { stdout?: string }) => step.stdout === stdout,
    )).toBe(true);
  });

  it("returns conservative source-aligned analysis for unknown custom code", async () => {
    const code = [
      "total = 0",
      "for number in range(3):",
      "    total += number",
    ].join("\n");
    const response = await request(createApp({ llmMode: "mock" }))
      .post("/api/analyze-code")
      .send({ language: "python", code, visualizationFocus: "recursion" })
      .expect(200);

    expect(() => codeAnalyzeResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.title).toBe("Python 算法片段演示");
    expect(response.body.summary).not.toMatch(/fib|斐波那契/i);
    expect(response.body.complexity).toEqual(
      expect.objectContaining({ time: "未知", space: "未知" }),
    );
    expect(response.body.lineExplanations.map(
      ({ code: explainedCode }: { code: string }) => explainedCode,
    )).toEqual(code.split("\n"));
    expect(response.body.traceSteps.map(
      ({ event }: { event: string }) => event,
    )).toEqual(["start", "end"]);
    expect(JSON.stringify(response.body.traceSteps)).not.toMatch(
      /fib|斐波那契|returnValue|stdout/i,
    );
    expect(response.body.warnings).toEqual([
      {
        code: "MOCK_USED",
        message: "未识别到专用示例，当前返回稳定 mock 演示结果。",
      },
    ]);
  });

  it.each([
    "def fib(n):\n    return 42",
    "def binary_search(items, target):\n    return -1",
  ])("keeps custom code with familiar names on generic analysis", (code) => {
    const result = analyzeWithMock({
      language: "python",
      code,
      visualizationFocus: "recursion",
    });

    expect(result.title).toBe("Python 算法片段演示");
    expect(result.lineExplanations.map(({ code: sourceLine }) => sourceLine))
      .toEqual(code.split("\n"));
    expect(result.traceSteps.map(({ event }) => event)).toEqual([
      "start",
      "end",
    ]);
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: "MOCK_USED" }),
    ]);
  });

  it("rejects an empty analysis request as recoverable invalid input", async () => {
    const response = await request(createApp({ llmMode: "mock" }))
      .post("/api/analyze-code")
      .send({})
      .expect(400);

    expect(response.body.requestId).toMatch(/^req-/);
    expect(response.body.error).toMatchObject({
      code: "INVALID_INPUT",
      recoverable: true,
    });
  });

  it("returns a recoverable invalid JSON error for malformed JSON", async () => {
    const response = await request(createApp({ llmMode: "mock" }))
      .post("/api/analyze-code")
      .set("content-type", "application/json")
      .send('{"language":"python"')
      .expect(400);

    expect(response.body.requestId).toMatch(/^req-\d+-[a-f0-9]{8}$/);
    expect(response.body.error).toMatchObject({
      code: "INVALID_JSON",
      recoverable: true,
    });
  });

  it("returns a recoverable payload-too-large error above 64kb", async () => {
    const response = await request(createApp({ llmMode: "mock" }))
      .post("/api/analyze-code")
      .send({ language: "python", code: "x".repeat(65 * 1024) })
      .expect(413);

    expect(response.body.requestId).toMatch(/^req-\d+-[a-f0-9]{8}$/);
    expect(response.body.error).toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
      recoverable: true,
    });
  });

  it("returns the mock Fibonacci trace from the analysis route", async () => {
    const response = await request(createApp({ llmMode: "mock" }))
      .post("/api/analyze-code")
      .send({ language: "python", code: fibonacciCode })
      .expect(200);

    expect(response.body.requestId).toMatch(/^req-\d+-[a-f0-9]{8}$/);
    expect(response.body.source).toBe("mock");
    expect(response.body.traceSteps.length).toBeGreaterThanOrEqual(6);
  });

  it("returns tutor references for the requested current step", async () => {
    const response = await request(createApp({ llmMode: "mock" }))
      .post("/api/tutor-chat")
      .send({
        requestId: "req-http-tutor",
        code: fibonacciCode,
        currentStep: 2,
        analysisSummary: "递归计算 fib(4)。",
        question: "当前步骤发生了什么？",
      })
      .expect(200);

    expect(response.body.referencedSteps).toContain(2);
    expect(response.body.source).toBe("mock");
  });

  it("marks a real-mode tutor provider failure as fallback", async () => {
    globalThis.fetch = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("network unavailable"));
    const app = createApp({
      llmMode: "real",
      LANXIN_API_URL: "https://lanxin.example.test/v1/chat/completions",
      LANXIN_APP_ID: "test-app-id",
      LANXIN_APP_KEY: "test-app-key",
    });

    const response = await request(app)
      .post("/api/tutor-chat")
      .send({
        requestId: "req-real-tutor-fallback",
        code: fibonacciCode,
        currentStep: 2,
        analysisSummary: "递归计算 fib(4)。",
        question: "当前步骤发生了什么？",
      })
      .expect(200);

    expect(response.body.requestId).toBe("req-real-tutor-fallback");
    expect(response.body.referencedSteps).toContain(2);
    expect(response.body.source).toBe("fallback");
  });

  it("rejects code longer than 200 lines with a suggestion", async () => {
    const code = Array.from({ length: 201 }, () => "print(1)").join("\n");
    const response = await request(createApp({ llmMode: "mock" }))
      .post("/api/analyze-code")
      .send({ language: "python", code })
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: "CODE_TOO_LONG",
      recoverable: true,
    });
    expect(response.body.error.suggestion).toEqual(expect.any(String));
    expect(response.body.error.suggestion.length).toBeGreaterThan(0);
  });

  it("falls back through the real provider path when Lanxin is unavailable", async () => {
    globalThis.fetch = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("network unavailable"));
    const app = createApp({
      llmMode: "real",
      LANXIN_API_URL: "https://lanxin.example.test/v1/chat/completions",
      LANXIN_APP_ID: "test-app-id",
      LANXIN_APP_KEY: "test-app-key",
    });

    const response = await request(app)
      .post("/api/analyze-code")
      .send({ language: "python", code: fibonacciCode })
      .expect(200);

    expect(response.body.requestId).toMatch(/^req-\d+-[a-f0-9]{8}$/);
    expect(response.body.source).toBe("fallback");
    expect(response.body.warnings).toEqual(
      expect.arrayContaining([
        {
          code: "MOCK_USED",
          message: "蓝心真实服务暂不可用，已切换为稳定 mock 演示。",
        },
      ]),
    );
  });
});
