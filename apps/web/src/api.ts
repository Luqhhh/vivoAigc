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

function apiUrl(path: string): string {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(
    /\/+$/,
    "",
  );

  return `${baseUrl}${path}`;
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

export async function fetchHealth(): Promise<HealthResponse> {
  const payload = await parseJson(await fetch(apiUrl("/api/health")));

  return validatePayload(healthResponseSchema, payload);
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
