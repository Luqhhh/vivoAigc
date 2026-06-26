# CodeMotion Option A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable mobile-first CodeMotion Web app, API service, mock/real Lanxin integration framework, and delivery documentation for the approved Option A scope.

**Architecture:** The repo becomes a small npm workspace with `apps/api` and `apps/web`. The API owns validation, examples, mock analysis, Lanxin real-mode adapter, and secret-safe logging; the Web app consumes those endpoints and renders the mobile learning loop from structured trace data. Mock mode is the default so the full demo works without external network or Lanxin endpoint details.

**Tech Stack:** Node.js, npm workspaces, TypeScript, Express, Zod, Vitest, Supertest, React, Vite, CSS, lucide-react.

---

## File Structure

Create or modify these files:

```text
package.json
README.md
apps/api/package.json
apps/api/tsconfig.json
apps/api/vitest.config.ts
apps/api/.env.example
apps/api/src/env.ts
apps/api/src/types.ts
apps/api/src/schemas.ts
apps/api/src/mockData.ts
apps/api/src/providers/mockProvider.ts
apps/api/src/providers/lanxinProvider.ts
apps/api/src/prompt.ts
apps/api/src/app.ts
apps/api/src/server.ts
apps/api/src/__tests__/api.test.ts
apps/api/src/__tests__/lanxinProvider.test.ts
apps/web/package.json
apps/web/tsconfig.json
apps/web/tsconfig.node.json
apps/web/vite.config.ts
apps/web/index.html
apps/web/src/main.tsx
apps/web/src/types.ts
apps/web/src/api.ts
apps/web/src/playback.ts
apps/web/src/App.tsx
apps/web/src/App.css
apps/web/src/__tests__/playback.test.ts
docs/deployment.md
docs/demo-script.md
docs/test-report.md
```

Responsibilities:

- `apps/api/src/types.ts`: TypeScript domain types shared internally by API modules.
- `apps/api/src/schemas.ts`: Zod request/response schemas and validation helpers.
- `apps/api/src/mockData.ts`: deterministic examples and analysis responses.
- `apps/api/src/providers/mockProvider.ts`: returns stable analysis/tutor data.
- `apps/api/src/providers/lanxinProvider.ts`: configurable real-mode HTTP adapter with fallback-friendly errors.
- `apps/api/src/app.ts`: Express routes and API error normalization.
- `apps/web/src/playback.ts`: pure playback derivation functions, tested independently.
- `apps/web/src/App.tsx`: mobile UI and API flow.
- `docs/*.md`: repeatable deployment, demo, and test evidence instructions.

---

### Task 1: Workspace And Package Skeleton

**Files:**
- Create: `package.json`
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/.env.example`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tsconfig.node.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`

- [ ] **Step 1: Write package files**

Create root `package.json`:

```json
{
  "name": "codemotion",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "apps/api",
    "apps/web"
  ],
  "scripts": {
    "dev": "npm run dev --workspace apps/api",
    "dev:api": "npm run dev --workspace apps/api",
    "dev:web": "npm run dev --workspace apps/web",
    "build": "npm run build --workspace apps/api && npm run build --workspace apps/web",
    "test": "npm run test --workspace apps/api && npm run test --workspace apps/web",
    "test:api": "npm run test --workspace apps/api",
    "test:web": "npm run test --workspace apps/web"
  }
}
```

Create `apps/api/package.json`:

```json
{
  "name": "@codemotion/api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "dist/server.js",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "test": "vitest run"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.2",
    "supertest": "^7.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

Create `apps/api/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

Create `apps/api/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
```

Create `apps/api/.env.example`:

```env
PORT=3000
NODE_ENV=development
LLM_MODE=mock
LANXIN_API_URL=https://example.invalid/lanxin/chat
LANXIN_APP_ID=your_app_id
LANXIN_APP_KEY=your_app_key
FRONTEND_ORIGIN=http://localhost:5173
```

Create `apps/web/package.json`:

```json
{
  "name": "@codemotion/web",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host 0.0.0.0",
    "test": "vitest run"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "lucide-react": "^0.468.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/react": "^16.1.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "typescript": "^5.7.2",
    "vite": "^6.0.5",
    "vitest": "^2.1.8"
  }
}
```

Create `apps/web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `apps/web/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

Create `apps/web/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000"
    }
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"]
  }
});
```

Create `apps/web/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#f6f8fb" />
    <title>CodeMotion</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Install dependencies**

Run:

```powershell
npm install
```

Expected: npm creates `package-lock.json` and installs workspace dependencies without package-resolution errors.

- [ ] **Step 3: Verify initial scripts fail only because source is missing**

Run:

```powershell
npm run build
```

Expected: FAIL with TypeScript or Vite entry-file errors mentioning missing `src` files. This confirms the workspace scripts are wired before source code exists.

- [ ] **Step 4: Commit scaffold**

Run:

```powershell
git add package.json package-lock.json apps/api/package.json apps/api/tsconfig.json apps/api/vitest.config.ts apps/api/.env.example apps/web/package.json apps/web/tsconfig.json apps/web/tsconfig.node.json apps/web/vite.config.ts apps/web/index.html
git commit -m "chore: scaffold codemotion workspaces"
```

---

### Task 2: API Schemas, Mock Data, And Provider Tests

**Files:**
- Create: `apps/api/src/types.ts`
- Create: `apps/api/src/schemas.ts`
- Create: `apps/api/src/mockData.ts`
- Create: `apps/api/src/providers/mockProvider.ts`
- Create: `apps/api/src/__tests__/api.test.ts`

- [ ] **Step 1: Write failing mock provider tests**

Create `apps/api/src/__tests__/api.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { analyzeWithMock, answerWithMockTutor } from "../providers/mockProvider.js";
import { codeAnalyzeResponseSchema } from "../schemas.js";

const fibonacciCode = `def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

print(fib(4))`;

describe("mock provider", () => {
  test("returns a schema-valid fibonacci analysis with recursion tree", async () => {
    const response = await analyzeWithMock({
      language: "python",
      code: fibonacciCode,
      visualizationFocus: "recursion",
      userLevel: "beginner"
    });

    expect(() => codeAnalyzeResponseSchema.parse(response)).not.toThrow();
    expect(response.title).toContain("斐波那契");
    expect(response.traceSteps.length).toBeGreaterThanOrEqual(6);
    expect(response.recursionTree?.nodes.some((node) => node.label === "fib(4)")).toBe(true);
    expect(response.source).toBe("mock");
  });

  test("returns binary search mock data with left right and mid variables", async () => {
    const response = await analyzeWithMock({
      language: "python",
      code: "def binary_search(nums, target):\\n    return 3",
      visualizationFocus: "variables",
      userLevel: "beginner"
    });

    const allVariables = response.traceSteps.map((step) => Object.keys(step.variables)).flat();
    expect(allVariables).toContain("left");
    expect(allVariables).toContain("right");
    expect(allVariables).toContain("mid");
  });

  test("answers tutor questions with referenced steps", async () => {
    const response = await answerWithMockTutor({
      requestId: "req-test",
      code: fibonacciCode,
      currentStep: 2,
      analysisSummary: "递归斐波那契",
      question: "为什么这里会返回 1？"
    });

    expect(response.answer).toContain("base case");
    expect(response.referencedSteps.length).toBeGreaterThan(0);
    expect(response.source).toBe("mock");
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm run test:api -- src/__tests__/api.test.ts
```

Expected: FAIL with module-not-found errors for `../providers/mockProvider.js` or `../schemas.js`.

- [ ] **Step 3: Create API domain types**

Create `apps/api/src/types.ts`:

```ts
export type PrimitiveValue = string | number | boolean | null;

export type CodeAnalyzeRequest = {
  language: "python";
  code: string;
  stdin?: string;
  visualizationFocus?: "auto" | "recursion" | "stack" | "variables" | "dp";
  userLevel?: "beginner" | "intermediate";
};

export type LineExplanation = {
  line: number;
  code: string;
  explanation: string;
  role:
    | "input"
    | "condition"
    | "loop"
    | "recursive-call"
    | "return"
    | "state-update"
    | "output"
    | "other";
};

export type TraceStep = {
  step: number;
  line: number;
  event:
    | "start"
    | "assign"
    | "condition"
    | "call"
    | "return"
    | "loop"
    | "push"
    | "pop"
    | "output"
    | "end";
  description: string;
  variables: Record<string, PrimitiveValue>;
  changedVariables: string[];
  stdout?: string;
  activeFrameId?: string;
  activeRecursionNodeId?: string;
};

export type StackFrame = {
  id: string;
  functionName: string;
  line: number;
  params: Record<string, PrimitiveValue>;
  locals: Record<string, PrimitiveValue>;
  status: "active" | "waiting" | "returned";
  returnValue?: PrimitiveValue;
};

export type StackFrameSnapshot = {
  step: number;
  frames: StackFrame[];
};

export type RecursionNode = {
  id: string;
  label: string;
  functionName: string;
  args: Record<string, PrimitiveValue>;
  status: "pending" | "active" | "returned";
  returnValue?: PrimitiveValue;
  enterStep: number;
  exitStep?: number;
};

export type RecursionTree = {
  rootId: string;
  nodes: RecursionNode[];
  edges: Array<{ from: string; to: string; label?: string }>;
};

export type PracticeRecommendation = {
  id: string;
  title: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  concepts: string[];
  reason: string;
  visualizationHint: string;
  starterPrompt?: string;
};

export type AnalysisWarning = {
  code:
    | "CODE_TOO_LONG"
    | "UNSUPPORTED_LANGUAGE"
    | "TRACE_PARTIAL"
    | "MODEL_FORMAT_REPAIRED"
    | "VISUALIZATION_LIMITED"
    | "MOCK_USED";
  message: string;
};

export type CodeAnalyzeResponse = {
  requestId: string;
  language: "python";
  title: string;
  summary: string;
  detectedConcepts: string[];
  complexity: { time: string; space: string; explanation: string };
  lineExplanations: LineExplanation[];
  traceSteps: TraceStep[];
  stackFrames: StackFrameSnapshot[];
  recursionTree?: RecursionTree;
  recommendations: PracticeRecommendation[];
  warnings: AnalysisWarning[];
  source: "lanxin" | "mock" | "fallback";
};

export type TutorChatRequest = {
  requestId: string;
  code: string;
  currentStep?: number;
  analysisSummary: string;
  question: string;
};

export type TutorChatResponse = {
  requestId: string;
  answer: string;
  referencedSteps: number[];
  suggestedFollowups: string[];
  source: "lanxin" | "mock" | "fallback";
};
```

- [ ] **Step 4: Create Zod schemas**

Create `apps/api/src/schemas.ts`:

```ts
import { z } from "zod";

const primitiveValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const primitiveRecord = z.record(primitiveValue);

export const codeAnalyzeRequestSchema = z.object({
  language: z.literal("python"),
  code: z.string().min(1).max(12000),
  stdin: z.string().max(4000).optional(),
  visualizationFocus: z.enum(["auto", "recursion", "stack", "variables", "dp"]).default("auto"),
  userLevel: z.enum(["beginner", "intermediate"]).default("beginner")
});

export const tutorChatRequestSchema = z.object({
  requestId: z.string().min(1),
  code: z.string().min(1).max(12000),
  currentStep: z.number().int().positive().optional(),
  analysisSummary: z.string().min(1).max(3000),
  question: z.string().min(1).max(500)
});

export const lineExplanationSchema = z.object({
  line: z.number().int().positive(),
  code: z.string(),
  explanation: z.string(),
  role: z.enum(["input", "condition", "loop", "recursive-call", "return", "state-update", "output", "other"])
});

export const traceStepSchema = z.object({
  step: z.number().int().positive(),
  line: z.number().int().positive(),
  event: z.enum(["start", "assign", "condition", "call", "return", "loop", "push", "pop", "output", "end"]),
  description: z.string(),
  variables: primitiveRecord,
  changedVariables: z.array(z.string()),
  stdout: z.string().optional(),
  activeFrameId: z.string().optional(),
  activeRecursionNodeId: z.string().optional()
});

export const stackFrameSnapshotSchema = z.object({
  step: z.number().int().positive(),
  frames: z.array(z.object({
    id: z.string(),
    functionName: z.string(),
    line: z.number().int().positive(),
    params: primitiveRecord,
    locals: primitiveRecord,
    status: z.enum(["active", "waiting", "returned"]),
    returnValue: primitiveValue.optional()
  }))
});

export const recursionTreeSchema = z.object({
  rootId: z.string(),
  nodes: z.array(z.object({
    id: z.string(),
    label: z.string(),
    functionName: z.string(),
    args: primitiveRecord,
    status: z.enum(["pending", "active", "returned"]),
    returnValue: primitiveValue.optional(),
    enterStep: z.number().int().positive(),
    exitStep: z.number().int().positive().optional()
  })),
  edges: z.array(z.object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional()
  }))
});

export const codeAnalyzeResponseSchema = z.object({
  requestId: z.string(),
  language: z.literal("python"),
  title: z.string(),
  summary: z.string(),
  detectedConcepts: z.array(z.string()),
  complexity: z.object({
    time: z.string(),
    space: z.string(),
    explanation: z.string()
  }),
  lineExplanations: z.array(lineExplanationSchema),
  traceSteps: z.array(traceStepSchema).min(1),
  stackFrames: z.array(stackFrameSnapshotSchema),
  recursionTree: recursionTreeSchema.optional(),
  recommendations: z.array(z.object({
    id: z.string(),
    title: z.string(),
    difficulty: z.enum(["beginner", "intermediate", "advanced"]),
    concepts: z.array(z.string()),
    reason: z.string(),
    visualizationHint: z.string(),
    starterPrompt: z.string().optional()
  })),
  warnings: z.array(z.object({
    code: z.enum(["CODE_TOO_LONG", "UNSUPPORTED_LANGUAGE", "TRACE_PARTIAL", "MODEL_FORMAT_REPAIRED", "VISUALIZATION_LIMITED", "MOCK_USED"]),
    message: z.string()
  })),
  source: z.enum(["lanxin", "mock", "fallback"])
});

export const tutorChatResponseSchema = z.object({
  requestId: z.string(),
  answer: z.string(),
  referencedSteps: z.array(z.number().int().positive()),
  suggestedFollowups: z.array(z.string()),
  source: z.enum(["lanxin", "mock", "fallback"])
});

export type ParsedCodeAnalyzeRequest = z.infer<typeof codeAnalyzeRequestSchema>;
export type ParsedTutorChatRequest = z.infer<typeof tutorChatRequestSchema>;
```

- [ ] **Step 5: Create deterministic mock data and provider**

Create `apps/api/src/mockData.ts` with five example records and at least two complete analysis responses. The Fibonacci response must include these trace facts:

```ts
export const fibonacciCode = `def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

print(fib(4))`;
```

For the Fibonacci analysis, include trace steps with `fib(4)`, `fib(3)`, `fib(2)`, `fib(1)`, return values, a recursion tree root labeled `fib(4)`, and three practice recommendations. For binary search, include steps where `left`, `right`, and `mid` change and stdout is `3`.

Create `apps/api/src/providers/mockProvider.ts`:

```ts
import type { CodeAnalyzeRequest, CodeAnalyzeResponse, TutorChatRequest, TutorChatResponse } from "../types.js";
import { binarySearchAnalysis, examples, fibonacciAnalysis } from "../mockData.js";

function withRequestId(response: CodeAnalyzeResponse): CodeAnalyzeResponse {
  return {
    ...response,
    requestId: `mock-${Date.now()}-${Math.random().toString(16).slice(2)}`
  };
}

export async function analyzeWithMock(request: CodeAnalyzeRequest): Promise<CodeAnalyzeResponse> {
  const normalized = request.code.toLowerCase();
  if (normalized.includes("binary_search") || normalized.includes("left") && normalized.includes("mid")) {
    return withRequestId(binarySearchAnalysis);
  }
  if (normalized.includes("fib") || request.visualizationFocus === "recursion") {
    return withRequestId(fibonacciAnalysis);
  }
  return withRequestId({
    ...fibonacciAnalysis,
    title: "Python 算法片段演示",
    summary: "当前使用稳定 mock 分析结果演示 CodeMotion 的执行可视化能力。",
    warnings: [{ code: "MOCK_USED", message: "未匹配到专用示例，已使用斐波那契 mock 演示。" }]
  });
}

export async function answerWithMockTutor(request: TutorChatRequest): Promise<TutorChatResponse> {
  const step = request.currentStep ?? 1;
  return {
    requestId: request.requestId,
    answer: `根据当前 trace，第 ${step} 步正在解释递归的 base case。base case 是递归停止继续调用自己的条件，例如 fib(1) 直接返回 1，这样递归才能逐层回到上一层。`,
    referencedSteps: [step],
    suggestedFollowups: ["这个返回值会传给哪一层？", "能换成循环写法吗？", "给我一道相似练习"],
    source: "mock"
  };
}

export { examples };
```

- [ ] **Step 6: Run mock provider tests to verify GREEN**

Run:

```powershell
npm run test:api -- src/__tests__/api.test.ts
```

Expected: PASS for three mock provider tests.

- [ ] **Step 7: Commit API schemas and mock provider**

Run:

```powershell
git add apps/api/src/types.ts apps/api/src/schemas.ts apps/api/src/mockData.ts apps/api/src/providers/mockProvider.ts apps/api/src/__tests__/api.test.ts
git commit -m "feat(api): add schemas and mock analysis provider"
```

---

### Task 3: Express API Routes

**Files:**
- Create: `apps/api/src/env.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`
- Modify: `apps/api/src/__tests__/api.test.ts`

- [ ] **Step 1: Add failing route tests**

Append to `apps/api/src/__tests__/api.test.ts`:

```ts
import request from "supertest";
import { createApp } from "../app.js";

describe("api routes", () => {
  const app = createApp({ llmMode: "mock" });

  test("GET /api/health returns service status", async () => {
    const response = await request(app).get("/api/health").expect(200);
    expect(response.body).toMatchObject({
      ok: true,
      service: "codemotion-api",
      llmMode: "mock",
      version: "1.0.0"
    });
  });

  test("GET /api/examples returns five examples", async () => {
    const response = await request(app).get("/api/examples").expect(200);
    expect(response.body.examples).toHaveLength(5);
    expect(response.body.examples.map((item: { id: string }) => item.id)).toContain("fibonacci-recursion");
  });

  test("POST /api/analyze-code rejects empty code", async () => {
    const response = await request(app)
      .post("/api/analyze-code")
      .send({ language: "python", code: "" })
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_INPUT");
    expect(response.body.error.recoverable).toBe(true);
  });

  test("POST /api/analyze-code returns mock analysis", async () => {
    const response = await request(app)
      .post("/api/analyze-code")
      .send({ language: "python", code: fibonacciCode, visualizationFocus: "recursion" })
      .expect(200);

    expect(response.body.source).toBe("mock");
    expect(response.body.traceSteps.length).toBeGreaterThanOrEqual(6);
  });

  test("POST /api/tutor-chat returns mock tutor answer", async () => {
    const response = await request(app)
      .post("/api/tutor-chat")
      .send({
        requestId: "req-test",
        code: fibonacciCode,
        currentStep: 2,
        analysisSummary: "递归斐波那契",
        question: "为什么这里会返回 1？"
      })
      .expect(200);

    expect(response.body.referencedSteps).toContain(2);
  });
});
```

- [ ] **Step 2: Run route tests to verify RED**

Run:

```powershell
npm run test:api -- src/__tests__/api.test.ts
```

Expected: FAIL with module-not-found error for `../app.js`.

- [ ] **Step 3: Implement environment loader**

Create `apps/api/src/env.ts`:

```ts
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.string().default("development"),
  LLM_MODE: z.enum(["mock", "real"]).default("mock"),
  LANXIN_API_URL: z.string().url().optional(),
  LANXIN_APP_ID: z.string().optional(),
  LANXIN_APP_KEY: z.string().optional(),
  FRONTEND_ORIGIN: z.string().default("http://localhost:5173")
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(source);
}
```

- [ ] **Step 4: Implement Express app**

Create `apps/api/src/app.ts`:

```ts
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { loadEnv, type AppEnv } from "./env.js";
import { codeAnalyzeRequestSchema, tutorChatRequestSchema } from "./schemas.js";
import { analyzeWithMock, answerWithMockTutor, examples } from "./providers/mockProvider.js";
import { analyzeWithLanxin, answerWithLanxinTutor, LanxinProviderError } from "./providers/lanxinProvider.js";

type AppOptions = Partial<AppEnv>;

function requestId(): string {
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function apiError(id: string, status: number, code: string, message: string, suggestion?: string) {
  return {
    status,
    body: {
      requestId: id,
      error: { code, message, recoverable: status < 500, suggestion }
    }
  };
}

export function createApp(options: AppOptions = {}) {
  const env = { ...loadEnv(), ...options };
  const app = express();

  app.use(cors({ origin: env.FRONTEND_ORIGIN === "*" ? true : env.FRONTEND_ORIGIN }));
  app.use(express.json({ limit: "64kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "codemotion-api", llmMode: env.LLM_MODE ?? env.llmMode ?? "mock", version: "1.0.0" });
  });

  app.get("/api/examples", (_req, res) => {
    res.json({ examples });
  });

  app.post("/api/analyze-code", async (req, res, next) => {
    const id = requestId();
    try {
      const parsed = codeAnalyzeRequestSchema.parse(req.body);
      const lines = parsed.code.split(/\r?\n/).length;
      if (lines > 200) {
        const error = apiError(id, 400, "CODE_TOO_LONG", "首版适合分析 200 行以内的 Python 算法片段。", "请缩短代码或选择内置示例。");
        res.status(error.status).json(error.body);
        return;
      }

      if ((env.LLM_MODE ?? "mock") === "real") {
        try {
          const response = await analyzeWithLanxin(parsed, env);
          res.json(response);
          return;
        } catch (error) {
          if (!(error instanceof LanxinProviderError)) throw error;
          const fallback = await analyzeWithMock(parsed);
          res.json({
            ...fallback,
            source: "fallback",
            warnings: [...fallback.warnings, { code: "MOCK_USED", message: "蓝心真实服务暂不可用，已切换为稳定 mock 演示。" }]
          });
          return;
        }
      }

      res.json(await analyzeWithMock(parsed));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/tutor-chat", async (req, res, next) => {
    try {
      const parsed = tutorChatRequestSchema.parse(req.body);
      if ((env.LLM_MODE ?? "mock") === "real") {
        try {
          res.json(await answerWithLanxinTutor(parsed, env));
          return;
        } catch (error) {
          if (!(error instanceof LanxinProviderError)) throw error;
        }
      }
      res.json(await answerWithMockTutor(parsed));
    } catch (error) {
      next(error);
    }
  });

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    const id = requestId();
    if (error instanceof ZodError) {
      const body = apiError(id, 400, "INVALID_INPUT", "请求参数不符合 CodeMotion 首版要求。", error.issues[0]?.message).body;
      res.status(400).json(body);
      return;
    }
    const body = apiError(id, 500, "INTERNAL_ERROR", "服务暂时不可用，请稍后重试。").body;
    res.status(500).json(body);
  };

  app.use(errorHandler);
  return app;
}
```

- [ ] **Step 5: Implement server entry**

Create `apps/api/src/server.ts`:

```ts
import { createApp } from "./app.js";
import { loadEnv } from "./env.js";

const env = loadEnv();
const app = createApp(env);

app.listen(env.PORT, () => {
  console.log(JSON.stringify({
    service: "codemotion-api",
    event: "started",
    port: env.PORT,
    llmMode: env.LLM_MODE
  }));
});
```

- [ ] **Step 6: Run route tests to verify GREEN**

Run:

```powershell
npm run test:api -- src/__tests__/api.test.ts
```

Expected: PASS for provider and route tests.

- [ ] **Step 7: Commit API routes**

Run:

```powershell
git add apps/api/src/env.ts apps/api/src/app.ts apps/api/src/server.ts apps/api/src/__tests__/api.test.ts
git commit -m "feat(api): expose codemotion endpoints"
```

---

### Task 4: Lanxin Real-Mode Adapter

**Files:**
- Create: `apps/api/src/prompt.ts`
- Create: `apps/api/src/providers/lanxinProvider.ts`
- Create: `apps/api/src/__tests__/lanxinProvider.test.ts`

- [ ] **Step 1: Write failing Lanxin provider tests**

Create `apps/api/src/__tests__/lanxinProvider.test.ts`:

```ts
import { afterEach, describe, expect, test, vi } from "vitest";
import { analyzeWithLanxin, LanxinProviderError } from "../providers/lanxinProvider.js";

const env = {
  PORT: 3000,
  NODE_ENV: "test",
  LLM_MODE: "real" as const,
  LANXIN_API_URL: "https://lanxin.example.invalid/chat",
  LANXIN_APP_ID: "app-id",
  LANXIN_APP_KEY: "secret-key",
  FRONTEND_ORIGIN: "http://localhost:5173"
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("lanxin provider", () => {
  test("parses schema-valid JSON content from provider response", async () => {
    const providerBody = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              requestId: "lanxin-test",
              language: "python",
              title: "测试分析",
              summary: "测试摘要",
              detectedConcepts: ["递归"],
              complexity: { time: "O(n)", space: "O(n)", explanation: "递归调用栈" },
              lineExplanations: [{ line: 1, code: "print(1)", explanation: "输出", role: "output" }],
              traceSteps: [{ step: 1, line: 1, event: "output", description: "输出 1", variables: {}, changedVariables: [], stdout: "1" }],
              stackFrames: [{ step: 1, frames: [] }],
              recommendations: [],
              warnings: [],
              source: "lanxin"
            })
          }
        }
      ]
    };

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(providerBody), { status: 200 })));

    const response = await analyzeWithLanxin({ language: "python", code: "print(1)" }, env);

    expect(response.source).toBe("lanxin");
    expect(response.title).toBe("测试分析");
  });

  test("throws provider error when endpoint configuration is missing", async () => {
    await expect(analyzeWithLanxin({ language: "python", code: "print(1)" }, { ...env, LANXIN_API_URL: undefined }))
      .rejects.toBeInstanceOf(LanxinProviderError);
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm run test:api -- src/__tests__/lanxinProvider.test.ts
```

Expected: FAIL with module-not-found error for `../providers/lanxinProvider.js`.

- [ ] **Step 3: Implement prompt builder**

Create `apps/api/src/prompt.ts`:

```ts
import type { CodeAnalyzeRequest, TutorChatRequest } from "./types.js";

export function buildAnalysisPrompt(request: CodeAnalyzeRequest): string {
  return [
    "你是 CodeMotion 的代码执行可视化导师。",
    "只分析 Python 单文件算法片段，不执行代码，不输出 Markdown。",
    "请严格返回符合 CodeAnalyzeResponse TypeScript 结构的 JSON。",
    `用户水平：${request.userLevel ?? "beginner"}`,
    `可视化重点：${request.visualizationFocus ?? "auto"}`,
    request.stdin ? `stdin:\n${request.stdin}` : "stdin: 未提供",
    "代码：",
    request.code
  ].join("\n\n");
}

export function buildTutorPrompt(request: TutorChatRequest): string {
  return [
    "你是 CodeMotion 的 AI 导师。",
    "围绕当前代码、当前步骤和已有分析回答，不编造不存在的行号或变量。",
    `当前步骤：${request.currentStep ?? "未指定"}`,
    `分析摘要：${request.analysisSummary}`,
    `问题：${request.question}`,
    "代码：",
    request.code
  ].join("\n\n");
}
```

- [ ] **Step 4: Implement Lanxin provider**

Create `apps/api/src/providers/lanxinProvider.ts`:

```ts
import type { AppEnv } from "../env.js";
import type { CodeAnalyzeRequest, CodeAnalyzeResponse, TutorChatRequest, TutorChatResponse } from "../types.js";
import { buildAnalysisPrompt, buildTutorPrompt } from "../prompt.js";
import { codeAnalyzeResponseSchema, tutorChatResponseSchema } from "../schemas.js";

export class LanxinProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LanxinProviderError";
  }
}

function ensureConfig(env: AppEnv): asserts env is AppEnv & { LANXIN_API_URL: string; LANXIN_APP_ID: string; LANXIN_APP_KEY: string } {
  if (!env.LANXIN_API_URL || !env.LANXIN_APP_ID || !env.LANXIN_APP_KEY) {
    throw new LanxinProviderError("Lanxin real mode requires LANXIN_API_URL, LANXIN_APP_ID, and LANXIN_APP_KEY.");
  }
}

function extractContent(body: unknown): string {
  if (typeof body === "string") return body;
  if (body && typeof body === "object") {
    const anyBody = body as { choices?: Array<{ message?: { content?: string } }>; content?: string; data?: { content?: string } };
    return anyBody.choices?.[0]?.message?.content ?? anyBody.content ?? anyBody.data?.content ?? JSON.stringify(body);
  }
  throw new LanxinProviderError("Lanxin response body is empty.");
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new LanxinProviderError("Lanxin response did not contain valid JSON.");
  }
}

async function callLanxin(prompt: string, env: AppEnv): Promise<unknown> {
  ensureConfig(env);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(env.LANXIN_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-lanxin-app-id": env.LANXIN_APP_ID,
        "authorization": `Bearer ${env.LANXIN_APP_KEY}`
      },
      body: JSON.stringify({
        appId: env.LANXIN_APP_ID,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new LanxinProviderError(`Lanxin request failed with HTTP ${response.status}.`);
    }
    return response.json();
  } catch (error) {
    if (error instanceof LanxinProviderError) throw error;
    throw new LanxinProviderError(error instanceof Error ? error.message : "Lanxin request failed.");
  } finally {
    clearTimeout(timer);
  }
}

export async function analyzeWithLanxin(request: CodeAnalyzeRequest, env: AppEnv): Promise<CodeAnalyzeResponse> {
  const body = await callLanxin(buildAnalysisPrompt(request), env);
  const parsed = parseJsonContent(extractContent(body));
  return codeAnalyzeResponseSchema.parse({ ...(parsed as object), source: "lanxin" });
}

export async function answerWithLanxinTutor(request: TutorChatRequest, env: AppEnv): Promise<TutorChatResponse> {
  const body = await callLanxin(buildTutorPrompt(request), env);
  const parsed = parseJsonContent(extractContent(body));
  return tutorChatResponseSchema.parse({ ...(parsed as object), source: "lanxin" });
}
```

- [ ] **Step 5: Run Lanxin tests to verify GREEN**

Run:

```powershell
npm run test:api -- src/__tests__/lanxinProvider.test.ts
```

Expected: PASS for both Lanxin provider tests.

- [ ] **Step 6: Run all API tests**

Run:

```powershell
npm run test:api
```

Expected: PASS for API route, mock provider, and Lanxin provider tests.

- [ ] **Step 7: Commit Lanxin adapter**

Run:

```powershell
git add apps/api/src/prompt.ts apps/api/src/providers/lanxinProvider.ts apps/api/src/__tests__/lanxinProvider.test.ts
git commit -m "feat(api): add lanxin provider adapter"
```

---

### Task 5: Web Types, API Client, And Playback Logic

**Files:**
- Create: `apps/web/src/types.ts`
- Create: `apps/web/src/api.ts`
- Create: `apps/web/src/playback.ts`
- Create: `apps/web/src/__tests__/playback.test.ts`

- [ ] **Step 1: Write failing playback tests**

Create `apps/web/src/__tests__/playback.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { clampStepIndex, getCurrentStackFrames, getCurrentTraceStep, nextStepIndex, previousStepIndex } from "../playback";
import type { CodeAnalyzeResponse } from "../types";

const analysis: CodeAnalyzeResponse = {
  requestId: "req",
  language: "python",
  title: "Test",
  summary: "Summary",
  detectedConcepts: [],
  complexity: { time: "O(1)", space: "O(1)", explanation: "constant" },
  lineExplanations: [],
  traceSteps: [
    { step: 1, line: 1, event: "start", description: "start", variables: {}, changedVariables: [] },
    { step: 2, line: 2, event: "assign", description: "assign", variables: { n: 1 }, changedVariables: ["n"] }
  ],
  stackFrames: [
    { step: 1, frames: [] },
    { step: 2, frames: [{ id: "f1", functionName: "fib", line: 2, params: { n: 1 }, locals: {}, status: "active" }] }
  ],
  recommendations: [],
  warnings: [],
  source: "mock"
};

describe("playback helpers", () => {
  test("clamps step index within trace bounds", () => {
    expect(clampStepIndex(-1, analysis)).toBe(0);
    expect(clampStepIndex(99, analysis)).toBe(1);
  });

  test("moves next and previous without leaving bounds", () => {
    expect(nextStepIndex(0, analysis)).toBe(1);
    expect(nextStepIndex(1, analysis)).toBe(1);
    expect(previousStepIndex(1, analysis)).toBe(0);
    expect(previousStepIndex(0, analysis)).toBe(0);
  });

  test("derives current trace and stack frame snapshot", () => {
    expect(getCurrentTraceStep(1, analysis).variables.n).toBe(1);
    expect(getCurrentStackFrames(1, analysis)[0]?.functionName).toBe("fib");
  });
});
```

- [ ] **Step 2: Run web tests to verify RED**

Run:

```powershell
npm run test:web -- src/__tests__/playback.test.ts
```

Expected: FAIL with module-not-found for `../playback`.

- [ ] **Step 3: Create frontend domain types**

Create `apps/web/src/types.ts` by mirroring API response types needed by the UI:

```ts
export type PrimitiveValue = string | number | boolean | null;
export type Source = "lanxin" | "mock" | "fallback";
export type ActiveTab = "workbench" | "examples" | "practice" | "about";
export type ActiveView = "timeline" | "stack" | "recursion";

export type CodeExample = {
  id: string;
  title: string;
  category: "recursion" | "binary-search" | "stack" | "dfs" | "dp";
  difficulty: "beginner" | "intermediate" | "advanced";
  concepts: string[];
  code: string;
  stdin?: string;
  expectedVisualization: Array<"timeline" | "stack" | "recursion-tree" | "variables">;
};

export type TraceStep = {
  step: number;
  line: number;
  event: string;
  description: string;
  variables: Record<string, PrimitiveValue>;
  changedVariables: string[];
  stdout?: string;
  activeFrameId?: string;
  activeRecursionNodeId?: string;
};

export type StackFrame = {
  id: string;
  functionName: string;
  line: number;
  params: Record<string, PrimitiveValue>;
  locals: Record<string, PrimitiveValue>;
  status: "active" | "waiting" | "returned";
  returnValue?: PrimitiveValue;
};

export type CodeAnalyzeResponse = {
  requestId: string;
  language: "python";
  title: string;
  summary: string;
  detectedConcepts: string[];
  complexity: { time: string; space: string; explanation: string };
  lineExplanations: Array<{ line: number; code: string; explanation: string; role: string }>;
  traceSteps: TraceStep[];
  stackFrames: Array<{ step: number; frames: StackFrame[] }>;
  recursionTree?: {
    rootId: string;
    nodes: Array<{
      id: string;
      label: string;
      functionName: string;
      args: Record<string, PrimitiveValue>;
      status: "pending" | "active" | "returned";
      returnValue?: PrimitiveValue;
      enterStep: number;
      exitStep?: number;
    }>;
    edges: Array<{ from: string; to: string; label?: string }>;
  };
  recommendations: Array<{
    id: string;
    title: string;
    difficulty: "beginner" | "intermediate" | "advanced";
    concepts: string[];
    reason: string;
    visualizationHint: string;
    starterPrompt?: string;
  }>;
  warnings: Array<{ code: string; message: string }>;
  source: Source;
};

export type TutorMessage = {
  role: "user" | "assistant";
  content: string;
  referencedSteps?: number[];
};
```

- [ ] **Step 4: Create API client**

Create `apps/web/src/api.ts`:

```ts
import type { CodeAnalyzeResponse, CodeExample } from "./types";

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "请求失败");
  }
  return payload as T;
}

export async function fetchHealth(): Promise<{ ok: boolean; service: string; llmMode: string; version: string }> {
  return parseJson(await fetch("/api/health"));
}

export async function fetchExamples(): Promise<CodeExample[]> {
  const response = await parseJson<{ examples: CodeExample[] }>(await fetch("/api/examples"));
  return response.examples;
}

export async function analyzeCode(code: string): Promise<CodeAnalyzeResponse> {
  return parseJson(await fetch("/api/analyze-code", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ language: "python", code, visualizationFocus: "auto", userLevel: "beginner" })
  }));
}

export async function askTutor(params: {
  requestId: string;
  code: string;
  currentStep?: number;
  analysisSummary: string;
  question: string;
}): Promise<{ answer: string; referencedSteps: number[]; suggestedFollowups: string[]; source: string }> {
  return parseJson(await fetch("/api/tutor-chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params)
  }));
}
```

- [ ] **Step 5: Implement playback helpers**

Create `apps/web/src/playback.ts`:

```ts
import type { CodeAnalyzeResponse, StackFrame, TraceStep } from "./types";

export function clampStepIndex(index: number, analysis?: CodeAnalyzeResponse): number {
  if (!analysis || analysis.traceSteps.length === 0) return 0;
  return Math.min(Math.max(index, 0), analysis.traceSteps.length - 1);
}

export function nextStepIndex(index: number, analysis?: CodeAnalyzeResponse): number {
  return clampStepIndex(index + 1, analysis);
}

export function previousStepIndex(index: number, analysis?: CodeAnalyzeResponse): number {
  return clampStepIndex(index - 1, analysis);
}

export function getCurrentTraceStep(index: number, analysis: CodeAnalyzeResponse): TraceStep {
  return analysis.traceSteps[clampStepIndex(index, analysis)];
}

export function getCurrentStackFrames(index: number, analysis: CodeAnalyzeResponse): StackFrame[] {
  const step = getCurrentTraceStep(index, analysis).step;
  return analysis.stackFrames.find((snapshot) => snapshot.step === step)?.frames ?? [];
}
```

- [ ] **Step 6: Run web tests to verify GREEN**

Run:

```powershell
npm run test:web -- src/__tests__/playback.test.ts
```

Expected: PASS for playback helper tests.

- [ ] **Step 7: Commit web core helpers**

Run:

```powershell
git add apps/web/src/types.ts apps/web/src/api.ts apps/web/src/playback.ts apps/web/src/__tests__/playback.test.ts
git commit -m "feat(web): add api client and playback helpers"
```

---

### Task 6: Mobile Web Application UI

**Files:**
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/App.css`

- [ ] **Step 1: Create React entry**

Create `apps/web/src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 2: Implement the mobile UI**

Create `apps/web/src/App.tsx` with these component boundaries:

```tsx
import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, Code2, GitBranch, Info, Layers, Pause, Play, Sparkles, StepBack, StepForward } from "lucide-react";
import { analyzeCode, askTutor, fetchExamples, fetchHealth } from "./api";
import { getCurrentStackFrames, getCurrentTraceStep, nextStepIndex, previousStepIndex } from "./playback";
import type { ActiveTab, ActiveView, CodeAnalyzeResponse, CodeExample, TutorMessage } from "./types";

const defaultCode = `def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

print(fib(4))`;

export default function App() {
  const [tab, setTab] = useState<ActiveTab>("workbench");
  const [view, setView] = useState<ActiveView>("timeline");
  const [code, setCode] = useState(defaultCode);
  const [examples, setExamples] = useState<CodeExample[]>([]);
  const [analysis, setAnalysis] = useState<CodeAnalyzeResponse | undefined>();
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<0.5 | 1 | 1.5>(1);
  const [status, setStatus] = useState("checking");
  const [error, setError] = useState("");
  const [tutorQuestion, setTutorQuestion] = useState("");
  const [messages, setMessages] = useState<TutorMessage[]>([]);

  useEffect(() => {
    fetchHealth().then((health) => setStatus(health.llmMode)).catch(() => setStatus("offline"));
    fetchExamples().then(setExamples).catch(() => setExamples([]));
  }, []);

  useEffect(() => {
    if (!playing || !analysis) return;
    const timeout = window.setTimeout(() => {
      setCurrentStep((step) => {
        const next = nextStepIndex(step, analysis);
        if (next === step) setPlaying(false);
        return next;
      });
    }, 900 / speed);
    return () => window.clearTimeout(timeout);
  }, [analysis, currentStep, playing, speed]);

  const validation = useMemo(() => {
    if (!code.trim()) return "请先粘贴 Python 算法代码。";
    if (code.length > 12000) return "首版适合分析 12000 字符以内的代码。";
    if (code.split(/\r?\n/).length > 200) return "首版适合分析 200 行以内的代码。";
    return "";
  }, [code]);

  const activeStep = analysis ? getCurrentTraceStep(currentStep, analysis) : undefined;
  const frames = analysis ? getCurrentStackFrames(currentStep, analysis) : [];

  async function runAnalyze() {
    if (validation) {
      setError(validation);
      return;
    }
    setError("");
    setPlaying(false);
    const response = await analyzeCode(code);
    setAnalysis(response);
    setCurrentStep(0);
    setMessages([]);
  }

  async function sendTutorQuestion(question = tutorQuestion) {
    if (!analysis || !question.trim()) return;
    const userMessage: TutorMessage = { role: "user", content: question };
    setMessages((current) => [...current, userMessage]);
    setTutorQuestion("");
    const response = await askTutor({
      requestId: analysis.requestId,
      code,
      currentStep: activeStep?.step,
      analysisSummary: analysis.summary,
      question
    });
    setMessages((current) => [...current, {
      role: "assistant",
      content: response.answer,
      referencedSteps: response.referencedSteps
    }]);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>CodeMotion</h1>
          <p>让代码和算法动起来的 AI 可视化导师</p>
        </div>
        <span className={`status status-${status}`}>{status}</span>
      </header>

      {tab === "workbench" && (
        <section className="screen">
          <div className="task-strip">{analysis ? analysis.title : "粘贴代码或选择示例开始学习"}</div>
          <section className="panel">
            <div className="panel-title">
              <span><Code2 size={18} /> 代码输入</span>
              <small>{code.split(/\r?\n/).length} 行</small>
            </div>
            <textarea aria-label="Python code input" value={code} onChange={(event) => setCode(event.target.value)} />
            <div className="actions">
              <button type="button" onClick={() => setCode(defaultCode)}>恢复示例</button>
              <button type="button" className="primary" disabled={Boolean(validation)} onClick={runAnalyze}><Sparkles size={16} /> {analysis ? "重新分析" : "AI 分析"}</button>
            </div>
            {(error || validation) && <p className="inline-error">{error || validation}</p>}
          </section>

          {analysis && activeStep ? (
            <section className="panel visualizer">
              <div className="panel-title">
                <span><Sparkles size={18} /> 执行可视化</span>
                <small>步骤 {activeStep.step} / {analysis.traceSteps.length}</small>
              </div>
              <div className="segmented">
                <button className={view === "timeline" ? "active" : ""} onClick={() => setView("timeline")}>时间轴</button>
                <button className={view === "stack" ? "active" : ""} onClick={() => setView("stack")}>调用栈</button>
                <button className={view === "recursion" ? "active" : ""} onClick={() => setView("recursion")}>递归树</button>
              </div>
              {view === "timeline" && <TimelineView analysis={analysis} activeStep={activeStep} />}
              {view === "stack" && <StackView frames={frames} />}
              {view === "recursion" && <TreeView analysis={analysis} setCurrentStep={setCurrentStep} />}
            </section>
          ) : (
            <section className="panel empty-state">执行 trace 会在这里显示。</section>
          )}

          {analysis && (
            <section className="panel tutor">
              <h2>AI 导师</h2>
              <p>{analysis.summary}</p>
              <div className="quick-questions">
                {["为什么这里会返回？", "这个变量什么时候变化？", "给我一道相似练习"].map((item) => (
                  <button key={item} onClick={() => sendTutorQuestion(item)}>{item}</button>
                ))}
              </div>
              <div className="messages">{messages.map((message, index) => <p key={index} className={message.role}>{message.content}</p>)}</div>
              <div className="question-row">
                <input value={tutorQuestion} onChange={(event) => setTutorQuestion(event.target.value)} maxLength={500} placeholder="继续追问当前步骤" />
                <button onClick={() => sendTutorQuestion()}>发送</button>
              </div>
            </section>
          )}
        </section>
      )}

      {tab === "examples" && <Examples examples={examples} loadExample={(example) => { setCode(example.code); setTab("workbench"); }} />}
      {tab === "practice" && <Practice analysis={analysis} />}
      {tab === "about" && <About status={status} />}

      {analysis && (
        <div className="playback">
          <button aria-label="上一步" onClick={() => setCurrentStep((step) => previousStepIndex(step, analysis))}><StepBack /></button>
          <button aria-label={playing ? "暂停" : "播放"} onClick={() => setPlaying((value) => !value)}>{playing ? <Pause /> : <Play />}</button>
          <button aria-label="下一步" onClick={() => setCurrentStep((step) => nextStepIndex(step, analysis))}><StepForward /></button>
          <select value={speed} onChange={(event) => setSpeed(Number(event.target.value) as 0.5 | 1 | 1.5)}>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={1.5}>1.5x</option>
          </select>
        </div>
      )}

      <nav className="bottom-nav">
        <button className={tab === "workbench" ? "active" : ""} onClick={() => setTab("workbench")}><Code2 />工作台</button>
        <button className={tab === "examples" ? "active" : ""} onClick={() => setTab("examples")}><GitBranch />示例</button>
        <button className={tab === "practice" ? "active" : ""} onClick={() => setTab("practice")}><BookOpenCheck />练习</button>
        <button className={tab === "about" ? "active" : ""} onClick={() => setTab("about")}><Info />作品</button>
      </nav>
    </main>
  );
}
```

Also define `TimelineView`, `StackView`, `TreeView`, `Examples`, `Practice`, and `About` in the same file below `App`. Keep each component under 60 lines and render the fields already present in `analysis`.

- [ ] **Step 3: Implement CSS**

Create `apps/web/src/App.css` with mobile-first rules:

```css
:root {
  color: #111827;
  background: #f6f8fb;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* { box-sizing: border-box; }
body { margin: 0; background: #f6f8fb; }
button, input, textarea, select { font: inherit; }
button { min-height: 44px; border-radius: 8px; border: 1px solid #d1d5db; background: #fff; color: #111827; }
.app-shell { max-width: 430px; min-height: 100vh; margin: 0 auto; padding: 0 0 calc(80px + env(safe-area-inset-bottom)); background: #f6f8fb; }
.topbar { position: sticky; top: 0; z-index: 5; display: flex; justify-content: space-between; gap: 12px; padding: 14px 16px; background: rgba(255,255,255,.96); border-bottom: 1px solid #e5e7eb; }
.topbar h1 { margin: 0; font-size: 20px; letter-spacing: 0; }
.topbar p { margin: 4px 0 0; color: #6b7280; font-size: 12px; }
.status { align-self: start; border-radius: 999px; padding: 5px 9px; font-size: 12px; color: #2563eb; background: #eff6ff; }
.screen { padding: 12px; }
.task-strip { margin-bottom: 10px; padding: 10px 12px; border-radius: 8px; background: #eff6ff; color: #1d4ed8; font-size: 13px; }
.panel { margin-bottom: 12px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; }
.panel-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.panel-title span { display: inline-flex; align-items: center; gap: 6px; font-weight: 650; }
textarea { width: 100%; min-height: 220px; max-height: 360px; resize: vertical; border: 0; border-radius: 8px; padding: 12px; color: #e5e7eb; background: #111827; font: 13px/1.55 Consolas, Menlo, monospace; }
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
.primary { display: inline-flex; align-items: center; justify-content: center; gap: 6px; color: #fff; background: #2563eb; border-color: #2563eb; }
.primary:disabled { opacity: .55; }
.inline-error { color: #dc2626; font-size: 13px; }
.empty-state { min-height: 120px; display: grid; place-items: center; color: #6b7280; border-style: dashed; }
.segmented { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 10px; }
.segmented .active { color: #fff; background: #2563eb; border-color: #2563eb; }
.code-line { padding: 6px 8px; border-left: 4px solid transparent; background: #f9fafb; font: 13px/1.5 Consolas, Menlo, monospace; }
.code-line.active { border-left-color: #2563eb; background: #dbeafe; }
.variables, .stack-list, .tree-list { display: grid; gap: 8px; margin-top: 10px; }
.variable, .frame, .tree-node, .example-card, .practice-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; }
.changed { color: #16a34a; font-size: 12px; margin-left: 6px; }
.quick-questions { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
.messages .user { color: #111827; }
.messages .assistant { color: #2563eb; }
.question-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; margin-top: 10px; }
.question-row input { min-width: 0; border: 1px solid #d1d5db; border-radius: 8px; padding: 0 10px; }
.playback { position: fixed; left: 50%; bottom: calc(62px + env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 10; width: min(410px, calc(100vw - 20px)); height: 52px; display: grid; grid-template-columns: 52px 52px 52px 1fr; gap: 8px; align-items: center; padding: 6px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; box-shadow: 0 8px 24px rgba(15,23,42,.16); }
.playback button { display: grid; place-items: center; min-height: 40px; }
.playback svg, .bottom-nav svg { width: 18px; height: 18px; }
.bottom-nav { position: fixed; left: 50%; bottom: 0; transform: translateX(-50%); z-index: 9; width: min(430px, 100vw); height: calc(58px + env(safe-area-inset-bottom)); display: grid; grid-template-columns: repeat(4, 1fr); padding-bottom: env(safe-area-inset-bottom); border-top: 1px solid #e5e7eb; background: #fff; }
.bottom-nav button { min-height: 58px; border: 0; border-radius: 0; display: grid; place-items: center; gap: 2px; font-size: 12px; color: #6b7280; }
.bottom-nav button.active { color: #2563eb; }
```

- [ ] **Step 4: Build web app**

Run:

```powershell
npm run build --workspace apps/web
```

Expected: PASS. If TypeScript reports missing component names from Step 2, add those components in `App.tsx` and rerun until build passes.

- [ ] **Step 5: Commit mobile UI**

Run:

```powershell
git add apps/web/src/main.tsx apps/web/src/App.tsx apps/web/src/App.css
git commit -m "feat(web): build mobile codemotion interface"
```

---

### Task 7: Documentation And Delivery Guides

**Files:**
- Create: `README.md`
- Create: `docs/deployment.md`
- Create: `docs/demo-script.md`
- Create: `docs/test-report.md`

- [ ] **Step 1: Create README**

Create `README.md` with:

```md
# CodeMotion

CodeMotion 是一款面向计算机课程学习者和算法竞赛入门者的 AI 可视化学习工具。它把 Python 算法片段转化为可播放的执行 trace、变量变化、调用栈、递归树、AI 讲解和相似练习推荐。

## Core Features

- 移动端优先 Web 工作台
- Python 代码输入和内置示例
- Mock/real 蓝心大模型接入框架
- 时间轴、调用栈、递归树
- AI 导师追问
- 相似练习推荐

## Architecture

```text
apps/web  -> React mobile Web
apps/api  -> Express API, mock provider, Lanxin adapter
docs      -> deployment, demo script, test report
spec      -> product and acceptance requirements
```

## Local Start

```powershell
npm install
npm run dev:api
npm run dev:web
```

Open `http://localhost:5173`.

## Lanxin Mode

The API defaults to `LLM_MODE=mock`. For real mode, configure only server-side environment variables in `apps/api/.env`:

```env
LLM_MODE=real
LANXIN_API_URL=https://your-lanxin-endpoint.example.com
LANXIN_APP_ID=your_app_id
LANXIN_APP_KEY=your_app_key
```

Do not put real keys in Web source, screenshots, docs, or APK artifacts.
```

- [ ] **Step 2: Create deployment guide**

Create `docs/deployment.md` with sections:

```md
# CodeMotion Deployment Guide

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- Android Studio and Android SDK only if building APK through Capacitor

## Backend

```powershell
cd apps/api
copy .env.example .env
npm run dev
```

Verify:

```powershell
Invoke-WebRequest http://localhost:3000/api/health -UseBasicParsing
```

## Frontend

```powershell
cd apps/web
npm run dev
```

Open `http://localhost:5173`.

## Mock And Real Modes

`LLM_MODE=mock` uses deterministic examples and is the default. `LLM_MODE=real` reads `LANXIN_API_URL`, `LANXIN_APP_ID`, and `LANXIN_APP_KEY` on the backend.

## Production Build

```powershell
npm run build
npm run start --workspace apps/api
```

Serve `apps/web/dist` with Nginx, Vercel, Netlify, or any static hosting service and route `/api` to the backend.

## APK Packaging Tutorial

The current Option A deliverable does not generate an APK artifact. To package later:

```powershell
cd apps/web
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init CodeMotion com.codemotion.app --web-dir dist
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

In Android Studio, set the app name to `CodeMotion`, configure the backend URL for the WebView build, then build a signed APK.

## Secret Scan

```powershell
$secretPrefix = "sk" + "-xuanji"
Select-String -Path .\apps\api\src\*,.\apps\web\src\*,.\README.md,.\docs\*.md -Pattern $secretPrefix -ErrorAction SilentlyContinue
Select-String -Path .\apps\web\dist\**\* -Pattern "LANXIN_APP_KEY",$secretPrefix -ErrorAction SilentlyContinue
```
```

- [ ] **Step 3: Create demo script and test report**

Create `docs/demo-script.md` with 3-minute and 8-minute flows from the acceptance spec.

Create `docs/test-report.md` using the acceptance table with current status fields initialized to `PENDING` and evidence paths under `evidence/`.

- [ ] **Step 4: Commit docs**

Run:

```powershell
git add README.md docs/deployment.md docs/demo-script.md docs/test-report.md
git commit -m "docs: add codemotion delivery guides"
```

---

### Task 8: Final Verification

**Files:**
- Modify only files needed to fix verification failures.

- [ ] **Step 1: Run full test suite**

Run:

```powershell
npm test
```

Expected: PASS for API and Web tests.

- [ ] **Step 2: Run production build**

Run:

```powershell
npm run build
```

Expected: PASS for API TypeScript build and Web Vite build.

- [ ] **Step 3: Run backend smoke check**

Run in one terminal:

```powershell
npm run dev:api
```

Run in another terminal:

```powershell
Invoke-WebRequest http://localhost:3000/api/health -UseBasicParsing
Invoke-WebRequest http://localhost:3000/api/examples -UseBasicParsing
```

Expected: `/api/health` returns `ok: true`; `/api/examples` returns five examples.

- [ ] **Step 4: Run frontend locally**

Run:

```powershell
npm run dev:web
```

Open `http://localhost:5173` and verify:

- Workbench loads without login.
- AI Analyze returns mock analysis.
- Playback next/previous changes current step.
- Timeline, stack, and recursion tree views render.
- Tutor quick question returns an answer.
- Examples tab loads at least five examples.
- Practice and About tabs render.

- [ ] **Step 5: Run secret scan**

Run:

```powershell
$secretPrefix = "sk" + "-xuanji"
$encodedMarker = "SEN" + "1bXpq"
Select-String -Path .\README.md,.\docs\*.md,.\apps\api\src\*.ts,.\apps\api\src\providers\*.ts,.\apps\web\src\*.ts,.\apps\web\src\*.tsx -Pattern $secretPrefix,$encodedMarker,"LANXIN_APP_KEY=.*[^example]" -ErrorAction SilentlyContinue
```

Expected: no matches containing the real key value.

- [ ] **Step 6: Commit verification fixes**

If any verification fix was needed, run:

```powershell
git add package.json package-lock.json apps/api apps/web README.md docs/deployment.md docs/demo-script.md docs/test-report.md
git commit -m "fix: pass codemotion verification"
```

If no fix was needed, no commit is required.

---

## Plan Self-Review

Spec coverage:

- Mobile-first Web app: Task 6.
- API service: Tasks 2 and 3.
- Mock/real Lanxin integration: Tasks 2 and 4.
- Stable examples: Task 2.
- Trace playback and view switching: Tasks 5 and 6.
- Tutor chat: Tasks 2, 3, and 6.
- Practice recommendations: Tasks 2 and 6.
- Documentation: Task 7.
- Tests and verification: Tasks 2, 3, 4, 5, and 8.
- Secret safety: Tasks 1, 4, 7, and 8.
- APK tutorial without APK artifact: Task 7.

Type consistency:

- API and Web both use `CodeAnalyzeResponse`, `TraceStep`, stack frame snapshots, and `source`.
- Playback state uses a zero-based `currentStep` index in the frontend and reads one-based `TraceStep.step` values from API data.
- API provider functions return schema-validated `CodeAnalyzeResponse` or `TutorChatResponse`.

Execution note:

- Run each task in order.
- Use TDD for Tasks 2, 3, 4, and 5.
- Keep commits scoped to each task.
