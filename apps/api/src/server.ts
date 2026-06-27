import { createApp } from "./app.js";
import { loadEnv } from "./env.js";

const env = loadEnv();
const app = createApp(env);

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
