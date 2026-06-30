import { ipKeyGenerator, rateLimit } from "express-rate-limit";

export function createAiRateLimiter(limit: number) {
  return rateLimit({
    windowMs: 5 * 60 * 1000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => {
      const forwardedFor = req.headers["x-forwarded-for"];
      const forwardedIp = (
        Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor
      )
        ?.split(",", 1)[0]
        ?.trim();
      const selectedIp =
        forwardedIp || req.ip || req.socket.remoteAddress || "unknown";

      return ipKeyGenerator(selectedIp);
    },
    handler: (_req, res) => {
      res.status(429).json({
        requestId: res.locals.requestId,
        error: {
          code: "RATE_LIMITED",
          message: "请求过于频繁，请稍后重试。",
          suggestion: "等待几分钟后重新分析。",
          recoverable: true,
        },
      });
    },
  });
}
