import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.string().default("development"),
  LLM_MODE: z.enum(["mock", "real"]).default("mock"),
  LANXIN_API_URL: z.string().url().optional(),
  LANXIN_APP_ID: z.string().min(1).optional(),
  LANXIN_APP_KEY: z.string().min(1).optional(),
  LANXIN_MODEL: z.string().min(1).default("Doubao-Seed-2.0-mini"),
  FRONTEND_ORIGIN: z.string().default("http://localhost:5173"),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(source);
}
