# Real Lanxin Render APK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy CodeMotion's API to Render with the official competition model contract, then build and verify a signed Capacitor Android APK that judges can run on the competition cloud-device service.

**Architecture:** The Capacitor APK packages the existing Vite application and calls a Render-hosted Express API over HTTPS. The API sends schema-constrained prompts to the competition endpoint, validates every model response, and preserves the existing explicit mock fallback. Render configuration, Android signing, cloud-device evidence, and final acceptance reporting are separate, auditable stages.

**Tech Stack:** TypeScript, Express 4, Zod 3, React 18, Vite 6, Vitest 2, Render Blueprint, Capacitor 8.4.1, Android Studio 2025.2.1+, Android SDK API 36, Gradle, PowerShell.

---

## File Map

**API contract and controls**

- Modify `apps/api/src/env.ts`: add the configurable competition model.
- Modify `apps/api/src/app.ts`: normalize the model setting, trust the Render proxy, and apply AI-route limiting.
- Modify `apps/api/src/providers/lanxinProvider.ts`: send the official request envelope.
- Create `apps/api/src/rateLimit.ts`: own rate-limit configuration and 429 response formatting.
- Modify `apps/api/src/__tests__/lanxinProvider.test.ts`: verify the official upstream contract and failures.
- Modify `apps/api/src/__tests__/api.test.ts`: verify route limiting and fallback integration.
- Modify `apps/api/.env.example`: document safe non-secret configuration names.
- Modify `apps/api/package.json` and `pnpm-lock.yaml`: add `express-rate-limit@8.5.2`.

**Web cold-start handling**

- Modify `apps/web/src/api.ts`: add bounded health retry.
- Modify `apps/web/src/App.tsx`: use retrying health detection.
- Modify `apps/web/src/__tests__/api.test.ts`: verify retry success and exhaustion.
- Modify `apps/web/src/__tests__/App.test.tsx`: verify final service badge state.

**Render deployment**

- Create `.node-version`: pin Node 22 for Render and Capacitor.
- Create `render.yaml`: define the API Web Service and health check.
- Create `apps/api/src/__tests__/renderConfig.test.ts`: guard Blueprint commands and secret declarations.
- Modify `docs/deployment.md`: record exact Render setup and smoke commands.

**Android application**

- Modify `apps/web/package.json` and `pnpm-lock.yaml`: add Capacitor 8.4.1 and asset tooling 3.0.5.
- Create `apps/web/capacitor.config.ts`: define application identity and local Web assets.
- Create `apps/web/src/__tests__/capacitorConfig.test.ts`: guard app ID, name, and Web directory.
- Create `apps/web/assets/icon-only.png`: 1024px bitmap app icon generated through the image tool.
- Create `apps/web/assets/icon-foreground.png`: 1024px adaptive foreground bitmap.
- Create `apps/web/assets/icon-background.png`: 1024px solid background bitmap.
- Create `apps/web/assets/splash.png`: 2732px bitmap splash asset.
- Create `apps/web/android/**`: generated Capacitor Android project.
- Modify `apps/web/android/app/build.gradle`: load ignored release-signing properties.
- Modify `.gitignore`: ignore local signing material and generated delivery APKs while retaining evidence metadata.

**Evidence and delivery**

- Create `evidence/render/health-real.json`.
- Create `evidence/render/analyze-fibonacci-real.json`.
- Create `evidence/render/fallback-fibonacci.json`.
- Create `evidence/apk/sha256.txt`.
- Create `evidence/apk/signature-verification.txt`.
- Create `evidence/security/apk-secret-scan-summary.json`.
- Create `evidence/screenshots/cloud-device/*.png`.
- Modify `docs/test-report.md`: record only executed results.
- Modify `README.md`: link the APK artifact and real-service instructions only after verification.

---

### Task 1: Implement the Official Competition Model Contract

**Files:**
- Modify: `apps/api/src/env.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/providers/lanxinProvider.ts`
- Modify: `apps/api/src/__tests__/lanxinProvider.test.ts`
- Modify: `apps/api/.env.example`

- [ ] **Step 1: Write the failing provider-contract test**

Update the test `parses an OpenAI-style analysis response and sends real credentials` so the test environment includes:

```ts
LANXIN_MODEL: "Doubao-Seed-2.0-mini",
```

Replace its request assertions with:

```ts
const headers = init?.headers as Record<string, string>;
expect(headers).toMatchObject({
  "content-type": "application/json",
  Authorization: `Bearer ${env.LANXIN_APP_KEY}`,
});
expect(headers).not.toHaveProperty("x-lanxin-app-id");

const body = JSON.parse(String(init?.body));
expect(body).toMatchObject({
  model: "Doubao-Seed-2.0-mini",
  temperature: 0.2,
  stream: false,
  messages: [{ role: "user", content: expect.stringContaining(fibonacciCode) }],
});
expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
expect(body).not.toHaveProperty("appId");
```

Add an environment test:

```ts
it("uses the documented default competition model", () => {
  expect(loadEnv({} as NodeJS.ProcessEnv).LANXIN_MODEL)
    .toBe("Doubao-Seed-2.0-mini");
});
```

- [ ] **Step 2: Run the provider tests and verify RED**

Run:

```powershell
pnpm --filter @codemotion/api test -- lanxinProvider.test.ts
```

Expected: FAIL because `LANXIN_MODEL`, `model`, `requestId`, and `stream` do not exist and the old undocumented fields are still sent.

- [ ] **Step 3: Add model configuration and the official request envelope**

In `apps/api/src/env.ts`, add:

```ts
LANXIN_MODEL: z.string().min(1).default("Doubao-Seed-2.0-mini"),
```

In `normalizeEnv` in `apps/api/src/app.ts`, add:

```ts
LANXIN_MODEL: options.LANXIN_MODEL ?? defaults.LANXIN_MODEL,
```

In `apps/api/src/providers/lanxinProvider.ts`, import and use `randomUUID`:

```ts
import { randomUUID } from "node:crypto";
```

Extend `LanxinConfig` and `ensureConfig`:

```ts
interface LanxinConfig {
  url: string;
  appId: string;
  appKey: string;
  model: string;
}

return {
  url: env.LANXIN_API_URL,
  appId: env.LANXIN_APP_ID,
  appKey: env.LANXIN_APP_KEY,
  model: env.LANXIN_MODEL,
};
```

Replace the upstream headers and body with:

```ts
headers: {
  "content-type": "application/json",
  Authorization: `Bearer ${config.appKey}`,
},
body: JSON.stringify({
  requestId: randomUUID(),
  model: config.model,
  messages: [{ role: "user", content: prompt }],
  temperature: 0.2,
  stream: false,
}),
```

Add to `apps/api/.env.example`:

```env
LANXIN_MODEL=Doubao-Seed-2.0-mini
```

- [ ] **Step 4: Run provider tests and the API build**

Run:

```powershell
pnpm --filter @codemotion/api test -- lanxinProvider.test.ts
pnpm --filter @codemotion/api build
```

Expected: all provider tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit the official provider contract**

```powershell
git add apps/api/src/env.ts apps/api/src/app.ts apps/api/src/providers/lanxinProvider.ts apps/api/src/__tests__/lanxinProvider.test.ts apps/api/.env.example
git commit -m "feat(api): use official competition model contract"
```

---

### Task 2: Add Public AI Route Rate Limiting

**Files:**
- Create: `apps/api/src/rateLimit.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/__tests__/api.test.ts`
- Modify: `apps/api/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Add the dependency**

Run:

```powershell
pnpm --filter @codemotion/api add express-rate-limit@8.5.2
```

Expected: `apps/api/package.json` and `pnpm-lock.yaml` include version 8.5.2.

- [ ] **Step 2: Write the failing route-limit test**

Add to `apps/api/src/__tests__/api.test.ts`:

```ts
it("rate limits public model routes without limiting health", async () => {
  const app = createApp({ llmMode: "mock", aiRateLimit: 2 });
  const input = { language: "python", code: fibonacciCode };

  await request(app).post("/api/analyze-code").send(input).expect(200);
  await request(app).post("/api/analyze-code").send(input).expect(200);
  const limited = await request(app)
    .post("/api/analyze-code")
    .send(input)
    .expect(429);

  expect(limited.body.error).toMatchObject({
    code: "RATE_LIMITED",
    recoverable: true,
  });
  await request(app).get("/api/health").expect(200);
});
```

- [ ] **Step 3: Run the test and verify RED**

Run:

```powershell
pnpm --filter @codemotion/api test -- api.test.ts
```

Expected: FAIL because `aiRateLimit` is not an `AppOptions` property and no limiter exists.

- [ ] **Step 4: Implement the focused limiter module**

Create `apps/api/src/rateLimit.ts`:

```ts
import { rateLimit } from "express-rate-limit";

export function createAiRateLimiter(limit: number) {
  return rateLimit({
    windowMs: 5 * 60 * 1000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
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
```

Extend `AppOptions` in `apps/api/src/app.ts`:

```ts
aiRateLimit?: number;
```

After creating the Express app:

```ts
app.set("trust proxy", 1);
const aiRateLimiter = createAiRateLimiter(options.aiRateLimit ?? 30);
```

Apply `aiRateLimiter` before each POST handler for `/api/analyze-code` and `/api/tutor-chat`.

- [ ] **Step 5: Run API tests and build**

Run:

```powershell
pnpm --filter @codemotion/api test
pnpm --filter @codemotion/api build
```

Expected: API tests PASS and build exits 0.

- [ ] **Step 6: Commit the limiter**

```powershell
git add apps/api/src/rateLimit.ts apps/api/src/app.ts apps/api/src/__tests__/api.test.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(api): limit public model requests"
```

---

### Task 3: Retry Health Checks During Render Cold Starts

**Files:**
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/__tests__/api.test.ts`
- Modify: `apps/web/src/__tests__/App.test.tsx`

- [ ] **Step 1: Write failing retry tests**

Import `fetchHealthWithRetry` in `apps/web/src/__tests__/api.test.ts` and add:

```ts
test("retries health until Render becomes available", async () => {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockRejectedValueOnce(new TypeError("cold start"))
    .mockResolvedValueOnce(jsonResponse(health));
  globalThis.fetch = fetchMock;
  const sleep = vi.fn().mockResolvedValue(undefined);

  await expect(fetchHealthWithRetry({ attempts: 3, delayMs: 1, sleep }))
    .resolves.toEqual(health);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(sleep).toHaveBeenCalledWith(1);
});

test("fails after the configured health attempts", async () => {
  globalThis.fetch = vi.fn<typeof fetch>()
    .mockRejectedValue(new TypeError("offline"));

  await expect(fetchHealthWithRetry({
    attempts: 3,
    delayMs: 1,
    sleep: () => Promise.resolve(),
  })).rejects.toThrow("offline");
  expect(globalThis.fetch).toHaveBeenCalledTimes(3);
});
```

- [ ] **Step 2: Run the Web API tests and verify RED**

```powershell
pnpm --filter @codemotion/web test -- api.test.ts
```

Expected: FAIL because `fetchHealthWithRetry` does not exist.

- [ ] **Step 3: Implement bounded retry**

Add to `apps/web/src/api.ts`:

```ts
interface HealthRetryOptions {
  attempts?: number;
  delayMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
}

export async function fetchHealthWithRetry({
  attempts = 4,
  delayMs = 2_000,
  sleep = (delay) => new Promise((resolve) => window.setTimeout(resolve, delay)),
}: HealthRetryOptions = {}): Promise<HealthResponse> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchHealth();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(delayMs);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("服务健康检查失败");
}
```

In `apps/web/src/App.tsx`, import and call `fetchHealthWithRetry()` instead of `fetchHealth()`.

- [ ] **Step 4: Add an App-level recovery assertion**

In `apps/web/src/__tests__/App.test.tsx`, configure the route fetch mock so the first health call rejects and the second returns real mode, use fake timers to advance 2 seconds, and assert:

```ts
expect(await screen.findByText("真实服务")).toBeInTheDocument();
```

- [ ] **Step 5: Run all Web tests and build**

```powershell
pnpm --filter @codemotion/web test
pnpm --filter @codemotion/web build
```

Expected: Web tests PASS and Vite build exits 0.

- [ ] **Step 6: Commit cold-start recovery**

```powershell
git add apps/web/src/api.ts apps/web/src/App.tsx apps/web/src/__tests__/api.test.ts apps/web/src/__tests__/App.test.tsx
git commit -m "feat(web): recover from api cold starts"
```

---

### Task 4: Add and Guard the Render Blueprint

**Files:**
- Create: `.node-version`
- Create: `render.yaml`
- Create: `apps/api/src/__tests__/renderConfig.test.ts`
- Modify: `docs/deployment.md`

- [ ] **Step 1: Write the failing Blueprint contract test**

Create `apps/api/src/__tests__/renderConfig.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const blueprint = readFileSync(
  new URL("../../../../render.yaml", import.meta.url),
  "utf8",
);

describe("Render Blueprint", () => {
  it("builds and starts only the API with a health check", () => {
    expect(blueprint).toContain("runtime: node");
    expect(blueprint).toContain("pnpm install --frozen-lockfile --prod=false");
    expect(blueprint).toContain("pnpm --filter @codemotion/api build");
    expect(blueprint).toContain("pnpm --filter @codemotion/api start");
    expect(blueprint).toContain("healthCheckPath: /api/health");
  });

  it.each([
    "LANXIN_APP_ID",
    "LANXIN_APP_KEY",
  ])("requires %s to be entered in Render", (name) => {
    expect(blueprint).toMatch(new RegExp(`key: ${name}\\s+sync: false`));
  });

  it("uses the official endpoint and Capacitor origin", () => {
    expect(blueprint).toContain("https://api-ai.vivo.com.cn/v1/chat/completions");
    expect(blueprint).toContain("value: https://localhost");
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

```powershell
pnpm --filter @codemotion/api test -- renderConfig.test.ts
```

Expected: FAIL with `ENOENT` for `render.yaml`.

- [ ] **Step 3: Create the Render files**

Create `.node-version`:

```text
22
```

Create `render.yaml`:

```yaml
services:
  - type: web
    name: codemotion-api
    runtime: node
    plan: free
    buildCommand: corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm --filter @codemotion/api build
    startCommand: pnpm --filter @codemotion/api start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: LLM_MODE
        value: real
      - key: LANXIN_API_URL
        value: https://api-ai.vivo.com.cn/v1/chat/completions
      - key: LANXIN_MODEL
        value: Doubao-Seed-2.0-mini
      - key: LANXIN_APP_ID
        sync: false
      - key: LANXIN_APP_KEY
        sync: false
      - key: FRONTEND_ORIGIN
        value: https://localhost
```

- [ ] **Step 4: Add exact Render instructions to deployment docs**

Document Blueprint creation, the two dashboard-entered variables, health URL, real `source` check, cold-start warm-up, and fallback interpretation in `docs/deployment.md`. Do not include any credential value.

- [ ] **Step 5: Run the Blueprint test and API build**

```powershell
pnpm --filter @codemotion/api test -- renderConfig.test.ts
pnpm --filter @codemotion/api build
```

Expected: Blueprint tests PASS and build exits 0.

- [ ] **Step 6: Commit Render deployment support**

```powershell
git add .node-version render.yaml apps/api/src/__tests__/renderConfig.test.ts docs/deployment.md
git commit -m "feat(deploy): add render api blueprint"
```

---

### Task 5: Deploy and Verify the Real Render API

**Files:**
- Create: `evidence/render/health-real.json`
- Create: `evidence/render/analyze-fibonacci-real.json`
- Create: `evidence/render/fallback-fibonacci.json`

- [ ] **Step 1: Push the implementation branch**

```powershell
git push -u origin codex/real-lanxin-apk
```

Expected: GitHub reports the branch update without rejected refs.

- [ ] **Step 2: Create the Render Blueprint service**

In Render Dashboard, choose **New > Blueprint**, connect `Luqhhh/vivoAigc`, select branch `codex/real-lanxin-apk`, and apply `render.yaml`. Enter `LANXIN_APP_ID` and `LANXIN_APP_KEY` in the Render form. Do not add those values to a command, file, issue, or screenshot.

- [ ] **Step 3: Capture the Render origin and health response**

```powershell
$RenderOrigin = Read-Host 'Render HTTPS origin, without trailing slash'
$health = Invoke-RestMethod "$RenderOrigin/api/health"
if (-not $health.ok -or $health.llmMode -ne 'real') { throw 'Render health is not real-mode ready' }
New-Item -ItemType Directory -Force -Path evidence\render | Out-Null
$health | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 evidence\render\health-real.json
```

Expected: `ok: true`, `llmMode: real`, version `1.0.0`.

- [ ] **Step 4: Execute the fixed real Fibonacci smoke test**

```powershell
$code = "def fib(n):`n    if n <= 1:`n        return n`n    return fib(n - 1) + fib(n - 2)`n`nprint(fib(4))"
$body = @{ language='python'; code=$code } | ConvertTo-Json
$analysis = Invoke-RestMethod -Method Post -Uri "$RenderOrigin/api/analyze-code" -ContentType 'application/json' -Body $body
if ($analysis.source -ne 'lanxin') { throw "Expected lanxin source, got $($analysis.source)" }
if ($analysis.traceSteps.Count -lt 2) { throw 'Real analysis trace is incomplete' }
$analysis | ConvertTo-Json -Depth 100 | Set-Content -Encoding utf8 evidence\render\analyze-fibonacci-real.json
```

Expected: `source: lanxin` and schema-valid visualization arrays.

- [ ] **Step 5: Verify fallback in a separate Render preview**

Create a temporary preview service with an invalid `LANXIN_API_URL`, call the same Fibonacci route, require `source: fallback` and a `MOCK_USED` warning, and save only the response JSON:

```powershell
$FallbackOrigin = Read-Host 'Temporary fallback preview HTTPS origin'
$fallback = Invoke-RestMethod -Method Post -Uri "$FallbackOrigin/api/analyze-code" -ContentType 'application/json' -Body $body
if ($fallback.source -ne 'fallback') { throw "Expected fallback source, got $($fallback.source)" }
if (@($fallback.warnings | Where-Object { $_.code -eq 'MOCK_USED' }).Count -eq 0) { throw 'Fallback warning is missing' }
$fallback | ConvertTo-Json -Depth 100 | Set-Content -Encoding utf8 evidence\render\fallback-fibonacci.json
```

Delete the temporary preview after evidence is captured.

- [ ] **Step 6: Commit redacted deployment evidence**

```powershell
git add evidence/render/health-real.json evidence/render/analyze-fibonacci-real.json evidence/render/fallback-fibonacci.json
git commit -m "test: record real render provider evidence"
```

---

### Task 6: Add Capacitor 8 and Android Application Assets

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/web/capacitor.config.ts`
- Create: `apps/web/src/__tests__/capacitorConfig.test.ts`
- Create: `apps/web/assets/icon-only.png`
- Create: `apps/web/assets/icon-foreground.png`
- Create: `apps/web/assets/icon-background.png`
- Create: `apps/web/assets/splash.png`
- Create: `apps/web/android/**`

- [ ] **Step 1: Install pinned Capacitor dependencies**

```powershell
pnpm --filter @codemotion/web add @capacitor/core@8.4.1 @capacitor/android@8.4.1
pnpm --filter @codemotion/web add -D @capacitor/cli@8.4.1 @capacitor/assets@3.0.5
```

Expected: all Capacitor packages use 8.4.1 and the asset tool uses 3.0.5.

- [ ] **Step 2: Write the failing configuration test**

Create `apps/web/src/__tests__/capacitorConfig.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import config from "../../capacitor.config";

describe("Capacitor configuration", () => {
  it("packages CodeMotion Web assets without a remote server URL", () => {
    expect(config).toMatchObject({
      appId: "com.codemotion.visualizer",
      appName: "CodeMotion",
      webDir: "dist",
    });
    expect(config.server?.url).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run the configuration test and verify RED**

```powershell
pnpm --filter @codemotion/web test -- capacitorConfig.test.ts
```

Expected: FAIL because `capacitor.config.ts` does not exist.

- [ ] **Step 4: Create the Capacitor configuration**

Create `apps/web/capacitor.config.ts`:

```ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.codemotion.visualizer",
  appName: "CodeMotion",
  webDir: "dist",
};

export default config;
```

- [ ] **Step 5: Generate branded bitmap assets**

Use the image generation tool to create a clean 1024x1024 app icon: cobalt square field, white code brackets and a small execution-path motif, no text, no gradient, high contrast. Generate matching adaptive foreground/background assets and a 2732x2732 white splash with the centered icon. Save the four files under `apps/web/assets/`.

Expected: the icon files are 1024x1024, the splash is 2732x2732, and all four files are non-empty PNG bitmaps. Native resource generation runs in Step 7 after the Android platform exists.

- [ ] **Step 6: Build Web assets using the verified Render origin**

```powershell
$RenderOrigin = Read-Host 'Verified Render HTTPS origin'
$env:VITE_API_BASE_URL = $RenderOrigin
pnpm --filter @codemotion/web build
Remove-Item Env:VITE_API_BASE_URL
```

Expected: Vite exits 0 and `apps/web/dist` contains no credential value.

- [ ] **Step 7: Create and sync the Android platform**

```powershell
pnpm --filter @codemotion/web exec cap add android
pnpm --filter @codemotion/web exec capacitor-assets generate --android
pnpm --filter @codemotion/web exec cap sync android
```

Expected: `apps/web/android` exists and sync reports the copied Web assets.

- [ ] **Step 8: Run Web tests and commit Capacitor scaffolding**

```powershell
pnpm --filter @codemotion/web test
git add apps/web/package.json pnpm-lock.yaml apps/web/capacitor.config.ts apps/web/src/__tests__/capacitorConfig.test.ts apps/web/assets apps/web/android
git commit -m "feat(android): add capacitor application"
```

Expected: Web tests PASS and the generated Android project is committed without signing files.

---

### Task 7: Configure Local Release Signing

**Files:**
- Modify: `.gitignore`
- Modify: `apps/web/android/app/build.gradle`
- Create locally, never commit: `apps/web/.release/codemotion-release.jks`
- Create locally, never commit: `apps/web/android/keystore.properties`

- [ ] **Step 1: Add signing exclusions before generating files**

Append to `.gitignore`:

```gitignore
.release/
**/keystore.properties
*.jks
*.keystore
```

- [ ] **Step 2: Add release signing configuration**

At the top of `apps/web/android/app/build.gradle`, add:

```groovy
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('keystore.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

Inside `android {}`, add:

```groovy
signingConfigs {
    release {
        if (keystorePropertiesFile.exists()) {
            storeFile rootProject.file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
        }
    }
}
```

Inside the existing `buildTypes.release` block, add:

```groovy
signingConfig signingConfigs.release
```

- [ ] **Step 3: Generate the local competition keystore**

```powershell
$ReleaseDir = Join-Path $PWD 'apps\web\.release'
New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null
$Password = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
$Keystore = Join-Path $ReleaseDir 'codemotion-release.jks'
& keytool -genkeypair -v -keystore $Keystore -alias codemotion -keyalg RSA -keysize 4096 -validity 10000 -storepass $Password -keypass $Password -dname 'CN=CodeMotion, OU=Competition, O=CodeMotion, L=Shenzhen, ST=Guangdong, C=CN'
@(
  'storeFile=../.release/codemotion-release.jks'
  "storePassword=$Password"
  'keyAlias=codemotion'
  "keyPassword=$Password"
) | Set-Content -Encoding utf8 apps\web\android\keystore.properties
$Password = $null
```

Expected: keytool reports a 4096-bit RSA key and both files are ignored by Git.

- [ ] **Step 4: Verify exclusions and commit only configuration**

```powershell
git check-ignore apps/web/.release/codemotion-release.jks apps/web/android/keystore.properties
git status --short
git add .gitignore apps/web/android/app/build.gradle
git commit -m "build(android): configure release signing"
```

Expected: signing files appear in `git check-ignore` output and never in `git status`.

---

### Task 8: Install Android Tooling and Build the Signed APK

**Files:**
- Create: `dist/CodeMotion-1.0.0.apk`
- Create: `evidence/apk/sha256.txt`
- Create: `evidence/apk/signature-verification.txt`
- Create: `evidence/security/apk-secret-scan-summary.json`

- [ ] **Step 1: Install the required Android toolchain**

Install Android Studio 2025.2.1 or newer. In **Tools > SDK Manager**, install Android SDK Platform 36, Platform-Tools, Build-Tools, and Command-line Tools. Then set:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
```

Verify:

```powershell
Test-Path "$env:ANDROID_HOME\platforms\android-36"
Get-ChildItem "$env:ANDROID_HOME\build-tools" -Directory
```

Expected: Android 36 exists and at least one Build-Tools directory is listed.

- [ ] **Step 2: Rebuild and sync the verified Render origin**

```powershell
$RenderOrigin = Read-Host 'Verified Render HTTPS origin'
$env:VITE_API_BASE_URL = $RenderOrigin
pnpm --filter @codemotion/web build
pnpm --filter @codemotion/web exec cap sync android
Remove-Item Env:VITE_API_BASE_URL
```

Expected: build and sync exit 0.

- [ ] **Step 3: Build the release APK**

```powershell
Push-Location apps\web\android
.\gradlew.bat clean assembleRelease
Pop-Location
```

Expected: `apps/web/android/app/build/outputs/apk/release/app-release.apk` exists.

- [ ] **Step 4: Verify signature and create the delivery artifact**

```powershell
New-Item -ItemType Directory -Force -Path dist,evidence\apk | Out-Null
Copy-Item apps\web\android\app\build\outputs\apk\release\app-release.apk dist\CodeMotion-1.0.0.apk -Force
$ApkSigner = Get-ChildItem "$env:ANDROID_HOME\build-tools" -Recurse -Filter apksigner.bat | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
& $ApkSigner verify --verbose --print-certs dist\CodeMotion-1.0.0.apk 2>&1 | Tee-Object evidence\apk\signature-verification.txt
Get-FileHash -Algorithm SHA256 dist\CodeMotion-1.0.0.apk | Format-List Algorithm,Hash,Path | Out-File -Encoding utf8 evidence\apk\sha256.txt
```

Expected: `Verified` is reported and SHA-256 is present.

- [ ] **Step 5: Scan the unpacked APK without logging matched content**

```powershell
$ScanRoot = Join-Path $env:TEMP 'codemotion-apk-scan'
if (Test-Path $ScanRoot) { Remove-Item -LiteralPath $ScanRoot -Recurse -Force }
New-Item -ItemType Directory -Path $ScanRoot | Out-Null
Copy-Item dist\CodeMotion-1.0.0.apk (Join-Path $ScanRoot 'app.zip')
Expand-Archive (Join-Path $ScanRoot 'app.zip') (Join-Path $ScanRoot 'unpacked') -Force
$Findings = @(Get-ChildItem (Join-Path $ScanRoot 'unpacked') -Recurse -File | Select-String -Pattern 'LANXIN_APP_KEY','sk-xuanji-' -ErrorAction SilentlyContinue)
@{ MatchedFiles = @($Findings | Select-Object -ExpandProperty Path -Unique).Count; Matches = $Findings.Count } | ConvertTo-Json | Set-Content -Encoding utf8 evidence\security\apk-secret-scan-summary.json
$Findings = $null
Remove-Item -LiteralPath $ScanRoot -Recurse -Force
```

Expected: `MatchedFiles` and `Matches` are both 0.

- [ ] **Step 6: Commit non-binary verification evidence**

Keep `dist/` ignored. Commit evidence only:

```powershell
git add evidence/apk/sha256.txt evidence/apk/signature-verification.txt evidence/security/apk-secret-scan-summary.json
git commit -m "test(android): record signed apk verification"
```

---

### Task 9: Execute Cloud-Device Acceptance

**Files:**
- Create: `evidence/screenshots/cloud-device/apk-install.png`
- Create: `evidence/screenshots/cloud-device/apk-home.png`
- Create: `evidence/screenshots/cloud-device/real-analysis.png`
- Create: `evidence/screenshots/cloud-device/recursion-tree.png`
- Create: `evidence/screenshots/cloud-device/tutor-response.png`
- Create: `evidence/logs/cloud-device-run.md`

- [ ] **Step 1: Upload and install the APK**

Open the competition cloud-device service, upload `dist/CodeMotion-1.0.0.apk`, install it, launch `CodeMotion`, and capture the successful install and home screens.

- [ ] **Step 2: Warm and verify Render**

Open `$RenderOrigin/api/health` before the judged workflow. In the APK, wait until the service badge says `真实服务`. Record elapsed cold-start time in `evidence/logs/cloud-device-run.md`.

- [ ] **Step 3: Execute the real Fibonacci workflow**

Analyze the default `fib(4)` code, require the UI source label `蓝心分析`, step forward, open call stack and recursion tree, and ask `为什么 fib(1) 会直接返回 1？`. Capture the three workflow screenshots.

- [ ] **Step 4: Check the cloud-device console and layout**

Record device model, Android version, viewport, installation result, console errors, horizontal overflow, and workflow result in `evidence/logs/cloud-device-run.md`. Mark any failure explicitly instead of substituting mock screenshots.

- [ ] **Step 5: Commit cloud-device evidence**

```powershell
git add evidence/screenshots/cloud-device evidence/logs/cloud-device-run.md
git commit -m "test(android): record cloud device acceptance"
```

---

### Task 10: Final Verification and Delivery Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/deployment.md`
- Modify: `docs/test-report.md`
- Modify: `evidence/logs/verification-summary.md`

- [ ] **Step 1: Run the complete automated suite**

```powershell
pnpm test
pnpm build
```

Expected: every API and Web test passes; API TypeScript and Web production builds exit 0.

- [ ] **Step 2: Re-run artifact verification**

```powershell
$ApkSigner = Get-ChildItem "$env:ANDROID_HOME\build-tools" -Recurse -Filter apksigner.bat | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
& $ApkSigner verify --verbose --print-certs dist\CodeMotion-1.0.0.apk
Get-FileHash -Algorithm SHA256 dist\CodeMotion-1.0.0.apk
```

Expected: signature verifies and hash equals `evidence/apk/sha256.txt`.

- [ ] **Step 3: Update delivery documentation from actual evidence**

Update README with the local APK path and Render health URL. Update deployment docs with the final Render/Capacitor commands. Update the test report and verification summary using actual test counts, cloud-device results, real/fallback evidence, signature verification, and checksum. Keep every unexecuted criterion `PENDING`.

- [ ] **Step 4: Verify tracked-tree hygiene and documentation links**

```powershell
git diff --check
$SecretFiles = @(git grep -l -I -E 'sk-xuanji-|LANXIN_APP_KEY=sk-' -- 2>$null)
if ($SecretFiles.Count -ne 0) { throw 'Tracked secret pattern found' }
git status --short
```

Expected: no diff errors, no tracked secret-pattern files, and only intended evidence/document changes plus the user's existing untracked `spec/`.

- [ ] **Step 5: Commit final delivery records**

```powershell
git add README.md docs/deployment.md docs/test-report.md evidence/logs/verification-summary.md
git commit -m "docs: complete real apk delivery record"
```

- [ ] **Step 6: Request code review and resolve findings**

Review the branch against `docs/superpowers/specs/2026-06-30-real-lanxin-render-apk-design.md`, prioritizing provider contract mismatches, fallback regressions, Render deployment failures, APK configuration errors, and unsupported PASS claims. Fix every Important finding with a failing test before implementation, then rerun Steps 1, 2, and 4.

- [ ] **Step 7: Push the completed branch**

```powershell
git push origin codex/real-lanxin-apk
```

Expected: remote branch advances to the final verified commit.
