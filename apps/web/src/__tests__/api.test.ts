import { afterEach, describe, expect, test, vi } from "vitest";

import {
  analyzeCode,
  askTutor,
  fetchExamples,
  fetchHealth,
} from "../api";
import type {
  CodeAnalyzeResponse,
  CodeExample,
  HealthResponse,
  TutorChatRequest,
  TutorChatResponse,
} from "../types";

const originalFetch = globalThis.fetch;

const health: HealthResponse = {
  ok: true,
  service: "codemotion-api",
  llmMode: "mock",
  version: "1.0.0",
};

const examples: CodeExample[] = [
  {
    id: "fibonacci-recursion",
    title: "Fibonacci recursion",
    category: "recursion",
    difficulty: "beginner",
    concepts: ["recursion", "base case"],
    code: "def fib(n):\n    return n",
    stdin: "4",
    expectedVisualization: ["timeline", "stack", "recursion-tree"],
  },
];

const analysis: CodeAnalyzeResponse = {
  requestId: "req-analysis",
  language: "python",
  title: "Running total",
  summary: "The value is assigned and printed.",
  detectedConcepts: ["assignment"],
  complexity: {
    time: "O(1)",
    space: "O(1)",
    explanation: "Constant work and storage.",
  },
  lineExplanations: [
    {
      line: 1,
      code: "total = 1",
      explanation: "Assign one to total.",
      role: "state-update",
    },
  ],
  traceSteps: [
    {
      step: 1,
      line: 1,
      event: "assign",
      description: "Assign total.",
      variables: { total: 1 },
      changedVariables: ["total"],
    },
  ],
  stackFrames: [
    {
      step: 1,
      frames: [
        {
          id: "module",
          functionName: "<module>",
          line: 1,
          params: {},
          locals: { total: 1 },
          status: "active",
        },
      ],
    },
  ],
  recursionTree: {
    rootId: "root",
    nodes: [
      {
        id: "root",
        label: "module",
        functionName: "<module>",
        args: {},
        status: "active",
        enterStep: 1,
      },
    ],
    edges: [],
  },
  recommendations: [
    {
      id: "next-step",
      title: "Try a loop",
      difficulty: "beginner",
      concepts: ["loop"],
      reason: "Practice repeated updates.",
      visualizationHint: "Watch total change.",
      starterPrompt: "Sum the numbers from one to five.",
    },
  ],
  warnings: [
    {
      code: "MOCK_USED",
      message: "Mock analysis was used.",
    },
  ],
  source: "mock",
};

const tutorRequest: TutorChatRequest = {
  requestId: "req-analysis",
  code: "total = 1",
  currentStep: 1,
  analysisSummary: "The value is assigned and printed.",
  question: "What changed?",
};

const tutorResponse: TutorChatResponse = {
  requestId: "req-analysis",
  answer: "The variable total changed to one.",
  referencedSteps: [1],
  suggestedFollowups: ["What happens next?"],
  source: "mock",
};

function jsonResponse(payload: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function mockFetch(response: Response): ReturnType<typeof vi.fn<typeof fetch>> {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
  globalThis.fetch = fetchMock;
  return fetchMock;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("CodeMotion web API client", () => {
  test("fetchHealth sends GET /api/health and returns the health payload", async () => {
    const fetchMock = mockFetch(jsonResponse(health));

    await expect(fetchHealth()).resolves.toEqual(health);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/api/health");
  });

  test("fetchExamples sends GET /api/examples and unwraps examples", async () => {
    const fetchMock = mockFetch(jsonResponse({ examples }));

    await expect(fetchExamples()).resolves.toEqual(examples);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/api/examples");
  });

  test("analyzeCode sends the exact default Python analysis request", async () => {
    const fetchMock = mockFetch(jsonResponse(analysis));
    const code = "total = 1";

    await expect(analyzeCode(code)).resolves.toEqual(analysis);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/api/analyze-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        language: "python",
        code,
        visualizationFocus: "auto",
        userLevel: "beginner",
      }),
    });
  });

  test("askTutor sends supplied parameters and returns the tutor payload", async () => {
    const fetchMock = mockFetch(jsonResponse(tutorResponse));

    await expect(askTutor(tutorRequest)).resolves.toEqual(tutorResponse);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/api/tutor-chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(tutorRequest),
    });
  });

  test("propagates network failures without wrapping them", async () => {
    const networkError = new Error("network unavailable");
    globalThis.fetch = vi
      .fn<typeof fetch>()
      .mockRejectedValue(networkError);

    await expect(fetchHealth()).rejects.toBe(networkError);
  });

  test("uses a stable validation error for malformed successful JSON", async () => {
    mockFetch(
      new Response("{not-json", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(fetchHealth()).rejects.toThrow(
      "服务返回的数据格式不正确",
    );
  });

  test("rejects a wrong-shape health response", async () => {
    mockFetch(jsonResponse({ ok: "yes" }));

    await expect(fetchHealth()).rejects.toThrow(
      "服务返回的数据格式不正确",
    );
  });

  test("rejects a wrong-shape examples response", async () => {
    mockFetch(jsonResponse({ examples: [{}] }));

    await expect(fetchExamples()).rejects.toThrow(
      "服务返回的数据格式不正确",
    );
  });

  test("rejects a wrong-shape analysis response", async () => {
    mockFetch(jsonResponse({ requestId: "req-analysis" }));

    await expect(analyzeCode("total = 1")).rejects.toThrow(
      "服务返回的数据格式不正确",
    );
  });

  test("rejects a wrong-shape tutor response", async () => {
    mockFetch(jsonResponse({ requestId: "req-analysis" }));

    await expect(askTutor(tutorRequest)).rejects.toThrow(
      "服务返回的数据格式不正确",
    );
  });

  test("throws the API error message from a non-OK JSON response", async () => {
    mockFetch(
      jsonResponse(
        {
          requestId: "req-error",
          error: { code: "INVALID_INPUT", message: "代码不能为空" },
        },
        { status: 400 },
      ),
    );

    await expect(analyzeCode("")).rejects.toThrow("代码不能为空");
  });

  test("uses the Chinese fallback for a non-OK response without an API message", async () => {
    mockFetch(
      jsonResponse(
        { error: { code: "INTERNAL_ERROR", message: "   " } },
        { status: 500 },
      ),
    );

    await expect(fetchHealth()).rejects.toThrow("请求失败");
  });

  test("uses the Chinese fallback for a non-JSON error response", async () => {
    mockFetch(new Response("Service unavailable", { status: 503 }));

    await expect(fetchExamples()).rejects.toThrow("请求失败");
  });
});
