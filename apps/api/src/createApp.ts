import { randomBytes } from "node:crypto";

import cors, { type CorsOptions } from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { ZodError } from "zod";

import { loadEnv, type AppEnv } from "./env.js";
import {
  analyzeWithLanxin,
  answerWithLanxinTutor,
  LanxinProviderError,
} from "./providers/lanxinProvider.js";
import {
  analyzeWithMock,
  answerWithMockTutor,
  examples,
} from "./providers/mockProvider.js";
import { createAiRateLimiter } from "./rateLimit.js";
import {
  codeAnalyzeRequestSchema,
  tutorChatRequestSchema,
} from "./schemas.js";

const SERVICE_NAME = "codemotion-api";
const SERVICE_VERSION = "1.0.0";

export type AppOptions = Partial<AppEnv> & {
  llmMode?: AppEnv["LLM_MODE"];
  aiRateLimit?: number;
  requestLogger?: (entry: RequestLogEntry) => void;
};

export interface RequestLogEntry {
  requestId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
  source?: "lanxin" | "mock" | "fallback";
}

interface ApiErrorDetails {
  code: string;
  message: string;
  suggestion?: string;
}

function normalizeEnv(options: AppOptions): AppEnv {
  const defaults = loadEnv();

  return {
    PORT: options.PORT ?? defaults.PORT,
    NODE_ENV: options.NODE_ENV ?? defaults.NODE_ENV,
    LLM_MODE: options.llmMode ?? options.LLM_MODE ?? defaults.LLM_MODE,
    LANXIN_API_URL: options.LANXIN_API_URL ?? defaults.LANXIN_API_URL,
    LANXIN_APP_ID: options.LANXIN_APP_ID ?? defaults.LANXIN_APP_ID,
    LANXIN_APP_KEY: options.LANXIN_APP_KEY ?? defaults.LANXIN_APP_KEY,
    LANXIN_MODEL: options.LANXIN_MODEL ?? defaults.LANXIN_MODEL,
    FRONTEND_ORIGIN: options.FRONTEND_ORIGIN ?? defaults.FRONTEND_ORIGIN,
  };
}

function createRequestId(): string {
  return `req-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

function corsOrigin(frontendOrigin: string): CorsOptions["origin"] {
  if (frontendOrigin.trim() === "*") {
    return true;
  }

  const allowedOrigins = new Set(
    frontendOrigin
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

  return (origin, callback) => {
    callback(null, origin === undefined || allowedOrigins.has(origin));
  };
}

function apiError(
  res: Response,
  status: number,
  details: ApiErrorDetails,
): Response {
  return res.status(status).json({
    requestId: res.locals.requestId,
    error: {
      ...details,
      recoverable: status < 500,
    },
  });
}

function sendSourcedJson<T extends { source: RequestLogEntry["source"] }>(
  res: Response,
  payload: T,
): Response {
  res.locals.responseSource = payload.source;
  return res.json(payload);
}

function defaultRequestLogger(entry: RequestLogEntry): void {
  console.info(JSON.stringify({ event: "http_request", ...entry }));
}

export function createApp(options: AppOptions = {}) {
  const env = normalizeEnv(options);
  const app = express();
  app.set("trust proxy", 1);
  const aiRateLimiter = createAiRateLimiter(options.aiRateLimit ?? 30);
  const requestLogger = options.requestLogger ?? (
    env.NODE_ENV === "test" ? () => undefined : defaultRequestLogger
  );

  app.use((req, res, next) => {
    res.locals.requestId = createRequestId();
    const startedAt = Date.now();
    res.once("finish", () => {
      const source = res.locals.responseSource as RequestLogEntry["source"];
      const entry: RequestLogEntry = {
        requestId: res.locals.requestId,
        method: req.method,
        route: typeof req.route?.path === "string" ? req.route.path : req.path,
        status: res.statusCode,
        durationMs: Math.max(0, Date.now() - startedAt),
        ...(source === undefined ? {} : { source }),
      };

      try {
        requestLogger(entry);
      } catch {
        // Logging failures must not change an already-completed API response.
      }
    });
    next();
  });
  app.use(cors({ origin: corsOrigin(env.FRONTEND_ORIGIN) }));
  app.use(express.json({ limit: "64kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      service: SERVICE_NAME,
      llmMode: env.LLM_MODE,
      version: SERVICE_VERSION,
    });
  });

  app.get("/api/examples", (_req, res) => {
    res.json({ examples });
  });

  app.post(
    "/api/analyze-code",
    aiRateLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = codeAnalyzeRequestSchema.parse(req.body);
        const lineCount = input.code.split(/\r\n|\r|\n/).length;
        if (lineCount > 200) {
          return apiError(res, 400, {
            code: "CODE_TOO_LONG",
            message: "代码超过 200 行，暂时无法进行稳定可视化分析。",
            suggestion: "请精简到 200 行以内，或只提交需要讲解的核心函数。",
          });
        }

        if (env.LLM_MODE === "real") {
          try {
            const analysis = await analyzeWithLanxin(input, env);
            return sendSourcedJson(res, {
              ...analysis,
              requestId: res.locals.requestId,
            });
          } catch (error) {
            if (!(error instanceof LanxinProviderError)) {
              throw error;
            }

            const mock = analyzeWithMock(input);
            return sendSourcedJson(res, {
              ...mock,
              requestId: res.locals.requestId,
              source: "fallback",
              warnings: [
                ...mock.warnings,
                {
                  code: "MOCK_USED",
                  message:
                    "蓝心真实服务暂不可用，已切换为稳定 mock 演示。",
                },
              ],
            });
          }
        }

        return sendSourcedJson(res, {
          ...analyzeWithMock(input),
          requestId: res.locals.requestId,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    "/api/tutor-chat",
    aiRateLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = tutorChatRequestSchema.parse(req.body);
        if (env.LLM_MODE === "real") {
          try {
            return sendSourcedJson(
              res,
              await answerWithLanxinTutor(input, env),
            );
          } catch (error) {
            if (!(error instanceof LanxinProviderError)) {
              throw error;
            }

            return sendSourcedJson(res, {
              ...answerWithMockTutor(input),
              source: "fallback",
            });
          }
        }

        return sendSourcedJson(res, answerWithMockTutor(input));
      } catch (error) {
        next(error);
      }
    },
  );

  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      const bodyParserErrorType =
        typeof error === "object" && error !== null && "type" in error
          ? (error as { type?: unknown }).type
          : undefined;

      if (bodyParserErrorType === "entity.parse.failed") {
        return apiError(res, 400, {
          code: "INVALID_JSON",
          message: "请求体不是有效的 JSON。",
          suggestion: "请检查 JSON 语法后重试。",
        });
      }

      if (bodyParserErrorType === "entity.too.large") {
        return apiError(res, 413, {
          code: "PAYLOAD_TOO_LARGE",
          message: "请求体超过 64kb 大小限制。",
          suggestion: "请缩短代码或标准输入后重试。",
        });
      }

      if (error instanceof ZodError) {
        return apiError(res, 400, {
          code: "INVALID_INPUT",
          message: "请求参数不符合 CodeMotion API 要求。",
          suggestion: error.issues[0]?.message,
        });
      }

      return apiError(res, 500, {
        code: "INTERNAL_ERROR",
        message: "服务处理请求时发生内部错误，请稍后重试。",
      });
    },
  );

  return app;
}
