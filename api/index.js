// Vercel serverless function — wraps the Express API
import { createApp } from "../apps/api/dist/app.js";

const app = createApp();

export default app;
