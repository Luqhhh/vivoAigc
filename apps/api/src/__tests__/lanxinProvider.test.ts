import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppEnv } from "../env.js";
import { fibonacciAnalysis } from "../mockData.js";
import {
  analyzeWithLanxin,
  answerWithLanxinTutor,
  LanxinProviderError,
} from "../providers/lanxinProvider.js";
import { buildAnalysisPrompt, buildTutorPrompt } from "../prompt.js";
import {
  codeAnalyzeResponseSchema,
  tutorChatResponseSchema,
} from "../schemas.js";
import type { CodeAnalyzeResponse, TutorChatResponse } from "../types.js";

const originalFetch = globalThis.fetch;

const fibonacciCode = `def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

print(fib(4))`;

const env: AppEnv = {
  PORT: 3000,
  NODE_ENV: "test",
  LLM_MODE: "real",
  LANXIN_API_URL: "https://lanxin.example.test/v1/chat/completions",
  LANXIN_APP_ID: "test-app-id",
  LANXIN_APP_KEY: "test-app-key",
  FRONTEND_ORIGIN: "http://localhost:5173",
};

const analysisRequest = {
  language: "python" as const,
  code: fibonacciCode,
  stdin: "4\n",
  visualizationFocus: "recursion" as const,
  userLevel: "beginner" as const,
};

const tutorRequest = {
  requestId: "req-tutor",
  code: fibonacciCode,
  currentStep: 2,
  analysisSummary: "fib(4) 正在展开递归调用。",
  question: "为什么当前步骤还没有返回？",
};

function completeAnalysis(
  source: CodeAnalyzeResponse["source"] = "mock",
): CodeAnalyzeResponse {
  return {
    ...structuredClone(fibonacciAnalysis),
    requestId: "req-lanxin-analysis",
    source,
  };
}

function completeTutor(
  source: TutorChatResponse["source"] = "mock",
): TutorChatResponse {
  return {
    requestId: tutorRequest.requestId,
    answer: "第 2 步正在展开递归调用，需要等待子调用返回。",
    referencedSteps: [2],
    suggestedFollowups: ["哪个子调用会先到达递归出口？"],
    source,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("CodeMotion Lanxin prompts", () => {
  it("builds a strict analysis prompt with request context and stdin", () => {
    const prompt = buildAnalysisPrompt(analysisRequest);

    expect(prompt).toContain(fibonacciCode);
    expect(prompt).toContain("beginner");
    expect(prompt).toContain("recursion");
    expect(prompt).toContain("4\n");
    expect(prompt).toContain("JSON");
    expect(prompt).toContain("CodeAnalyzeResponse");
    expect(prompt).toMatch(/不要.*Markdown|禁止.*Markdown/);
  });

  it("uses explicit defaults and marks absent stdin", () => {
    const prompt = buildAnalysisPrompt({
      language: "python",
      code: "print('hello')",
    });

    expect(prompt).toContain("beginner");
    expect(prompt).toContain("auto");
    expect(prompt).toMatch(/stdin.*未提供|标准输入.*未提供/);
  });

  it("builds a grounded tutor prompt with the current context", () => {
    const prompt = buildTutorPrompt(tutorRequest);

    expect(prompt).toContain("第 2 步");
    expect(prompt).toContain(tutorRequest.analysisSummary);
    expect(prompt).toContain(tutorRequest.question);
    expect(prompt).toContain(fibonacciCode);
    expect(prompt).toMatch(/不要.*编造.*行|禁止.*编造.*行/);
    expect(prompt).toMatch(/不要.*编造.*变量|禁止.*编造.*变量/);
  });

  it("uses the default current step when none is provided", () => {
    const prompt = buildTutorPrompt({ ...tutorRequest, currentStep: undefined });

    expect(prompt).toContain("第 1 步");
  });
});

describe("Lanxin provider", () => {
  it("parses an OpenAI-style analysis response and sends real credentials", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify(completeAnalysis()),
            },
          },
        ],
      }),
    );
    globalThis.fetch = fetchMock;

    const result = await analyzeWithLanxin(analysisRequest, env);

    expect(codeAnalyzeResponseSchema.parse(result)).toEqual(result);
    expect(result.source).toBe("lanxin");
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(env.LANXIN_API_URL);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      "content-type": "application/json",
      "x-lanxin-app-id": env.LANXIN_APP_ID,
      Authorization: `Bearer ${env.LANXIN_APP_KEY}`,
    });

    const body = JSON.parse(String(init?.body));
    expect(body.appId).toBe(env.LANXIN_APP_ID);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0]).toMatchObject({ role: "user" });
    expect(body.messages[0].content).toContain(fibonacciCode);
    expect(body.temperature).toBe(0.2);
  });

  it.each([
    ["raw string", (content: string) => content],
    ["fenced top-level content", (content: string) => ({ content: `\`\`\`json\n${content}\n\`\`\`` })],
    ["nested data.content", (content: string) => ({ data: { content: `prefix ${content} suffix` } })],
  ])("extracts analysis JSON from %s", async (_label, wrap) => {
    const modelJson = JSON.stringify(completeAnalysis());
    globalThis.fetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(wrap(modelJson)));

    const result = await analyzeWithLanxin(analysisRequest, env);

    expect(codeAnalyzeResponseSchema.parse(result)).toEqual(result);
    expect(result.source).toBe("lanxin");
  });

  it("parses a complete tutor response and forces the Lanxin source", async () => {
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify(completeTutor("fallback")),
            },
          },
        ],
      }),
    );

    const result = await answerWithLanxinTutor(tutorRequest, env);

    expect(tutorChatResponseSchema.parse(result)).toEqual(result);
    expect(result.source).toBe("lanxin");
    expect(result.referencedSteps).toEqual([2]);
  });

  it.each([
    ["URL", { LANXIN_API_URL: undefined }],
    ["app ID", { LANXIN_APP_ID: undefined }],
    ["app key", { LANXIN_APP_KEY: undefined }],
  ])("rejects a missing %s without calling fetch", async (_label, override) => {
    const fetchMock = vi.fn<typeof fetch>();
    globalThis.fetch = fetchMock;

    await expect(
      analyzeWithLanxin(analysisRequest, { ...env, ...override }),
    ).rejects.toBeInstanceOf(LanxinProviderError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes non-2xx responses", async () => {
    globalThis.fetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ error: { message: "denied" } }, 401));

    await expect(analyzeWithLanxin(analysisRequest, env)).rejects.toBeInstanceOf(
      LanxinProviderError,
    );
  });

  it("normalizes malformed response JSON", async () => {
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("not-json", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(analyzeWithLanxin(analysisRequest, env)).rejects.toBeInstanceOf(
      LanxinProviderError,
    );
  });

  it("normalizes malformed model-content JSON", async () => {
    globalThis.fetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ content: "not model JSON" }));

    await expect(analyzeWithLanxin(analysisRequest, env)).rejects.toBeInstanceOf(
      LanxinProviderError,
    );
  });

  it("normalizes network failures", async () => {
    globalThis.fetch = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("network unavailable"));

    await expect(analyzeWithLanxin(analysisRequest, env)).rejects.toBeInstanceOf(
      LanxinProviderError,
    );
  });

  it("normalizes schema-invalid model JSON", async () => {
    const invalid = completeAnalysis();
    invalid.traceSteps = [];
    globalThis.fetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ content: JSON.stringify(invalid) }));

    await expect(analyzeWithLanxin(analysisRequest, env)).rejects.toBeInstanceOf(
      LanxinProviderError,
    );
  });
});
