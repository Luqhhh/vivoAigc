/// <reference types="vite/client" />

import type { ZodType } from "zod";

import {
  codeAnalyzeResponseSchema,
  examplesResponseSchema,
  healthResponseSchema,
  tutorChatResponseSchema,
} from "./schemas";
import type {
  CodeAnalyzeResponse,
  CodeExample,
  HealthResponse,
  TutorChatRequest,
  TutorChatResponse,
} from "./types";

const INVALID_RESPONSE_MESSAGE = "服务返回的数据格式不正确";
const INVALID_API_BASE_URL_MESSAGE =
  "VITE_API_BASE_URL must be a public HTTP(S) origin without credentials, path, query, or hash.";

function apiBaseUrl(): string {
  const configuredUrl = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
  if (configuredUrl.length === 0) {
    return "";
  }

  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error(INVALID_API_BASE_URL_MESSAGE);
  }

  const isHttpOrigin = url.protocol === "http:" || url.protocol === "https:";
  const isBareOrigin = url.href === `${url.origin}/`;
  if (!isHttpOrigin || url.username || url.password || !isBareOrigin) {
    throw new Error(INVALID_API_BASE_URL_MESSAGE);
  }

  return url.origin;
}

function apiUrl(path: string): string {
  return `${apiBaseUrl()}${path}`;
}

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

async function parseJson(response: Response): Promise<unknown> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error) {
    if (!response.ok) {
      throw new Error("请求失败");
    }

    throw new Error(INVALID_RESPONSE_MESSAGE);
  }

  if (!response.ok) {
    throw new Error(getApiErrorMessage(payload) ?? "请求失败");
  }

  return payload;
}

function validatePayload<T>(schema: ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }

  return result.data;
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const url = apiUrl("/api/health");
  const payload = await parseJson(
    signal ? await fetch(url, { signal }) : await fetch(url),
  );

  return validatePayload(healthResponseSchema, payload);
}

interface HealthRetryOptions {
  attempts?: number;
  delayMs?: number;
  signal?: AbortSignal;
  sleep?: (delayMs: number) => Promise<void>;
}

function abortReason(signal?: AbortSignal): unknown {
  return signal?.reason ?? new DOMException("The operation was aborted", "AbortError");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw abortReason(signal);
  }
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "name" in error
    && error.name === "AbortError";
}

function sleepWithSignal(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }

    let timer: number;
    const cleanup = () => {
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(abortReason(signal));
    };

    timer = window.setTimeout(() => {
      cleanup();
      resolve();
    }, delayMs);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function fetchHealthWithRetry({
  attempts = 4,
  delayMs = 2_000,
  signal,
  sleep = (delay) => sleepWithSignal(delay, signal),
}: HealthRetryOptions = {}): Promise<HealthResponse> {
  let finalError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    throwIfAborted(signal);
    try {
      return await fetchHealth(signal);
    } catch (error) {
      throwIfAborted(signal);
      if (isAbortError(error)) {
        throw error;
      }
      finalError = error;
      if (attempt < attempts - 1) {
        await sleep(delayMs);
      }
    }
  }

  throw finalError instanceof Error
    ? finalError
    : new Error("服务健康检查失败");
}

export async function fetchExamples(): Promise<CodeExample[]> {
  const response = validatePayload(
    examplesResponseSchema,
    await parseJson(await fetch(apiUrl("/api/examples"))),
  );

  return response.examples;
}

export async function analyzeCode(code: string): Promise<CodeAnalyzeResponse> {
  const payload = await parseJson(
    await fetch(apiUrl("/api/analyze-code"), {
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

  return validatePayload(codeAnalyzeResponseSchema, payload);
}

export async function askTutor(
  params: TutorChatRequest,
): Promise<TutorChatResponse> {
  const payload = await parseJson(
    await fetch(apiUrl("/api/tutor-chat"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
    }),
  );

  return validatePayload(tutorChatResponseSchema, payload);
}
