import type { AppEnv } from "../env.js";
import { buildAnalysisPrompt, buildTutorPrompt } from "../prompt.js";
import {
  codeAnalyzeResponseSchema,
  tutorChatResponseSchema,
} from "../schemas.js";
import type {
  CodeAnalyzeRequest,
  CodeAnalyzeResponse,
  TutorChatRequest,
  TutorChatResponse,
} from "../types.js";

const REQUEST_TIMEOUT_MS = 45_000;

interface LanxinConfig {
  url: string;
  appId: string;
  appKey: string;
}

export class LanxinProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LanxinProviderError";
  }
}

function ensureConfig(env: AppEnv): LanxinConfig {
  if (!env.LANXIN_API_URL) {
    throw new LanxinProviderError("蓝心服务地址未配置。");
  }
  if (!env.LANXIN_APP_ID) {
    throw new LanxinProviderError("蓝心应用 ID 未配置。");
  }
  if (!env.LANXIN_APP_KEY) {
    throw new LanxinProviderError("蓝心应用密钥未配置。");
  }

  return {
    url: env.LANXIN_API_URL,
    appId: env.LANXIN_APP_ID,
    appKey: env.LANXIN_APP_KEY,
  };
}

function extractContent(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }
  if (typeof payload !== "object" || payload === null) {
    throw new LanxinProviderError("蓝心服务响应缺少模型内容。");
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.content === "string") {
    return record.content;
  }

  const data = record.data;
  if (
    typeof data === "object" &&
    data !== null &&
    typeof (data as Record<string, unknown>).content === "string"
  ) {
    return (data as Record<string, string>).content;
  }

  const choices = record.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0];
    if (typeof first === "object" && first !== null) {
      const message = (first as Record<string, unknown>).message;
      if (
        typeof message === "object" &&
        message !== null &&
        typeof (message as Record<string, unknown>).content === "string"
      ) {
        return (message as Record<string, string>).content;
      }
    }
  }

  throw new LanxinProviderError("蓝心服务响应缺少模型内容。");
}

function parseModelContent(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced?.[1] ?? trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        // Normalize below.
      }
    }
  }

  throw new LanxinProviderError("蓝心模型内容不是有效 JSON。");
}

async function requestLanxin(prompt: string, env: AppEnv): Promise<unknown> {
  const config = ensureConfig(env);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(config.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-lanxin-app-id": config.appId,
          Authorization: `Bearer ${config.appKey}`,
        },
        body: JSON.stringify({
          appId: config.appId,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
        }),
        signal: controller.signal,
      });
    } catch {
      throw new LanxinProviderError("蓝心服务请求失败。");
    }

    if (!response.ok) {
      throw new LanxinProviderError(`蓝心服务返回 HTTP ${response.status}。`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new LanxinProviderError("蓝心服务响应不是有效 JSON。");
    }

    return parseModelContent(extractContent(payload));
  } catch (error) {
    if (error instanceof LanxinProviderError) {
      throw error;
    }
    throw new LanxinProviderError("蓝心服务处理失败。");
  } finally {
    clearTimeout(timeout);
  }
}

function forceLanxinSource(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new LanxinProviderError("蓝心模型返回的数据结构无效。");
  }
  return { ...(value as Record<string, unknown>), source: "lanxin" };
}

export async function analyzeWithLanxin(
  request: CodeAnalyzeRequest,
  env: AppEnv,
): Promise<CodeAnalyzeResponse> {
  try {
    const value = await requestLanxin(buildAnalysisPrompt(request), env);
    return codeAnalyzeResponseSchema.parse(forceLanxinSource(value));
  } catch (error) {
    if (error instanceof LanxinProviderError) {
      throw error;
    }
    throw new LanxinProviderError("蓝心代码分析结果校验失败。");
  }
}

export async function answerWithLanxinTutor(
  request: TutorChatRequest,
  env: AppEnv,
): Promise<TutorChatResponse> {
  try {
    const value = await requestLanxin(buildTutorPrompt(request), env);
    return tutorChatResponseSchema.parse({
      ...forceLanxinSource(value),
      requestId: request.requestId,
    });
  } catch (error) {
    if (error instanceof LanxinProviderError) {
      throw error;
    }
    throw new LanxinProviderError("蓝心导师结果校验失败。");
  }
}
