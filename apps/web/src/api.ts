import type {
  CodeAnalyzeResponse,
  CodeExample,
  HealthResponse,
  TutorChatRequest,
  TutorChatResponse,
} from "./types";

function getApiErrorMessage(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null || !("error" in payload)) {
    return undefined;
  }

  const error = payload.error;
  if (typeof error !== "object" || error === null || !("message" in error)) {
    return undefined;
  }

  return typeof error.message === "string" && error.message.trim().length > 0
    ? error.message
    : undefined;
}

async function parseJson<T>(response: Response): Promise<T> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error) {
    if (!response.ok) {
      throw new Error("请求失败");
    }

    throw error;
  }

  if (!response.ok) {
    throw new Error(getApiErrorMessage(payload) ?? "请求失败");
  }

  return payload as T;
}

export async function fetchHealth(): Promise<HealthResponse> {
  return parseJson(await fetch("/api/health"));
}

export async function fetchExamples(): Promise<CodeExample[]> {
  const response = await parseJson<{ examples: CodeExample[] }>(
    await fetch("/api/examples"),
  );

  return response.examples;
}

export async function analyzeCode(code: string): Promise<CodeAnalyzeResponse> {
  return parseJson(
    await fetch("/api/analyze-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        language: "python",
        code,
        visualizationFocus: "auto",
        userLevel: "beginner",
      }),
    }),
  );
}

export async function askTutor(
  params: TutorChatRequest,
): Promise<TutorChatResponse> {
  return parseJson(
    await fetch("/api/tutor-chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
    }),
  );
}
