import express from "express";

import { createApp } from "./createApp.js";
import { loadEnv } from "./env.js";

const env = loadEnv();
const app = createApp(express());

if (process.env.VERCEL !== "1") {
  app.listen(env.PORT, () => {
    console.log(
      JSON.stringify({
        service: "codemotion-api",
        event: "started",
        port: env.PORT,
        llmMode: env.LLM_MODE,
      }),
    );
  });
}

export default app;
