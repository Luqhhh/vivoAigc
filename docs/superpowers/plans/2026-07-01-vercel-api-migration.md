# Vercel API Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the blocked Render deployment with a tested Vercel Hobby deployment and produce a verified real Lanxin API origin for the APK build.

**Architecture:** Vercel imports `apps/api` as the project Root Directory and uses zero-config Express detection for the default-exported app in `src/server.ts`, with Fluid Compute enabled by default. The server module retains local port listening outside Vercel. `vercel.json` is schema-only and deliberately omits a traditional `functions` mapping. The API uses Node 22.x, the repository pins pnpm 10.34.4, and the Lanxin provider enforces a 45-second upstream timeout. Live verification records health, real-provider, and local fallback evidence without persisting credentials.

**Tech Stack:** TypeScript, Express 4, Vitest 2, pnpm 10.34.4, Vercel Hobby Node.js 22, PowerShell.

**Build-evidence correction:** The production build for commit `5ed8d1d` failed because the `src/server.ts` pattern in `functions` did not match a Serverless Function inside an `api` directory. The corrected handoff removes that mapping and does not claim a successful live redeploy yet.

---

## File Map

- Modify `apps/api/src/server.ts`: export the Express app and avoid listening inside Vercel.
- Create `apps/api/vercel.json`: retain only the official schema for zero-config Express detection.
- Modify `apps/api/package.json`: declare Node 22.x.
- Create `apps/api/src/__tests__/vercelConfig.test.ts`: guard Vercel runtime configuration.
- Create `apps/api/src/__tests__/server.test.ts`: guard Vercel export and listener behavior.
- Delete `apps/api/src/__tests__/renderConfig.test.ts`: remove the obsolete deployment contract.
- Delete `render.yaml`: remove the blocked deployment target.
- Modify `docs/deployment.md`: replace active Render steps with Vercel setup and verification.
- Create `evidence/vercel/health-real.json`: record verified production health.
- Create `evidence/vercel/analyze-fibonacci-real.json`: record a real provider result.
- Create `evidence/vercel/fallback-fibonacci-local.json`: record controlled fallback behavior.

### Task 1: Add the Vercel Express Runtime Contract

**Files:**
- Modify: `apps/api/src/server.ts`
- Create: `apps/api/vercel.json`
- Modify: `apps/api/package.json`
- Create: `apps/api/src/__tests__/vercelConfig.test.ts`
- Create: `apps/api/src/__tests__/server.test.ts`
- Delete: `apps/api/src/__tests__/renderConfig.test.ts`
- Delete: `render.yaml`

- [ ] **Step 1: Write the failing Vercel configuration test**

Create `apps/api/src/__tests__/vercelConfig.test.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const apiRoot = new URL("../../", import.meta.url);
const vercel = JSON.parse(
  readFileSync(new URL("vercel.json", apiRoot), "utf8"),
) as {
  $schema?: string;
  functions?: unknown;
};
const packageJson = JSON.parse(
  readFileSync(new URL("package.json", apiRoot), "utf8"),
) as { engines?: { node?: string } };
const repositoryPackageJson = JSON.parse(
  readFileSync(new URL("../../../../package.json", import.meta.url), "utf8"),
) as { packageManager?: string };

describe("Vercel API deployment", () => {
  it("uses zero-config Express detection without traditional function globs", () => {
    expect(vercel.$schema).toBe("https://openapi.vercel.sh/vercel.json");
    expect(vercel.functions).toBeUndefined();
  });

  it("uses a Vercel-compatible pnpm version", () => {
    expect(repositoryPackageJson.packageManager).toBe("pnpm@10.34.4");
  });

  it("uses Node 22 and removes the blocked Render blueprint", () => {
    expect(packageJson.engines?.node).toBe("22.x");
    expect(
      existsSync(new URL("../../../../render.yaml", import.meta.url)),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the configuration test and verify RED**

Run:

```powershell
$env:PATH = 'C:\Users\lqh22\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:PATH
pnpm --filter @codemotion/api test -- vercelConfig.test.ts
```

Expected: FAIL because `apps/api/vercel.json` still contains a traditional `functions` mapping. The schema, Node 22.x, pnpm 10.34.4, and removed `render.yaml` assertions should pass.

- [ ] **Step 3: Write the failing Vercel server-module test**

Create `apps/api/src/__tests__/server.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const listen = vi.fn();
  return {
    app: { listen },
    env: { PORT: 3001, LLM_MODE: "real" },
    listen,
  };
});

vi.mock("../app.js", () => ({
  createApp: vi.fn(() => mocks.app),
}));
vi.mock("../env.js", () => ({
  loadEnv: vi.fn(() => mocks.env),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  mocks.listen.mockClear();
});

describe("server entry", () => {
  it("exports the app without opening a listener on Vercel", async () => {
    vi.stubEnv("VERCEL", "1");

    const module = await import("../server.js");

    expect(module.default).toBe(mocks.app);
    expect(mocks.listen).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run the server test and verify RED**

Run:

```powershell
pnpm --filter @codemotion/api test -- server.test.ts
```

Expected: FAIL because `server.ts` has no default export and always calls `listen`.

- [ ] **Step 5: Implement the minimal Vercel entry and configuration**

Replace the startup section in `apps/api/src/server.ts` with:

```ts
const env = loadEnv();
const app = createApp(env);

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
```

Create `apps/api/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json"
}
```

Add to `apps/api/package.json`:

```json
"engines": {
  "node": "22.x"
}
```

Delete `render.yaml` and `apps/api/src/__tests__/renderConfig.test.ts`.

- [ ] **Step 6: Run the complete API verification**

Run:

```powershell
pnpm --filter @codemotion/api test
pnpm --filter @codemotion/api build
```

Expected: all API tests PASS and TypeScript exits 0.

- [ ] **Step 7: Commit the Vercel runtime contract**

```powershell
git add apps/api/src/server.ts apps/api/vercel.json apps/api/package.json apps/api/src/__tests__/vercelConfig.test.ts apps/api/src/__tests__/server.test.ts apps/api/src/__tests__/renderConfig.test.ts render.yaml
git commit -m "feat(deploy): migrate api runtime to vercel"
```

### Task 2: Replace Render Deployment Documentation

**Files:**
- Modify: `docs/deployment.md`

- [ ] **Step 1: Replace the active deployment section**

Document these exact Vercel settings:

```text
Repository: Luqhhh/vivoAigc
Root Directory: apps/api
Production Branch: codex/real-lanxin-apk
Framework Preset: Express or automatic detection
Node.js Version: 22.x
```

Document these production environment variable names and non-secret values:

```text
LLM_MODE=real
LANXIN_API_URL=https://api-ai.vivo.com.cn/v1/chat/completions
LANXIN_MODEL=Doubao-Seed-2.0-mini
FRONTEND_ORIGIN=https://localhost
```

Enter `LANXIN_APP_ID` and `LANXIN_APP_KEY` as separate sensitive values in the Vercel dashboard; do not place either value in the document or repository.

Include the dashboard flow:

1. Import `Luqhhh/vivoAigc` from GitHub.
2. Set Root Directory to `apps/api` before deployment.
3. Add all production environment variables without placing values in files or screenshots.
4. In Project Settings > Git, set Production Branch to `codex/real-lanxin-apk`.
5. Create or redeploy production from that branch.
6. Warm and verify `/api/health` before packaging the APK.

State that the in-memory AI limiter is per Vercel function instance and is not a global quota.

- [ ] **Step 2: Remove active Render instructions**

Run:

```powershell
Select-String -Path docs\deployment.md -Pattern 'New > Blueprint|Render HTTPS origin|render.yaml'
```

Expected: no active deployment instruction tells the reader to create a Render service. Historical explanation may state that Render was replaced because account verification was unavailable.

- [ ] **Step 3: Run documentation and repository checks**

```powershell
git diff --check
$SecretFiles = @(git grep -l -I -E 'sk-xuanji-|LANXIN_APP_KEY=sk-' -- 2>$null)
if ($SecretFiles.Count -ne 0) { throw 'Tracked secret pattern found' }
pnpm --filter @codemotion/api test
```

Expected: no whitespace errors, no tracked secret values, and all API tests PASS.

- [ ] **Step 4: Commit the Vercel deployment guide**

```powershell
git add docs/deployment.md
git commit -m "docs: replace render deployment with vercel"
```

### Task 3: Deploy and Verify the Real Vercel API

**Files:**
- Create: `evidence/vercel/health-real.json`
- Create: `evidence/vercel/analyze-fibonacci-real.json`
- Create: `evidence/vercel/fallback-fibonacci-local.json`

- [ ] **Step 1: Fast-forward and push the delivery branch**

From the primary checkout on `codex/real-lanxin-apk`:

```powershell
git merge --ff-only codex/real-lanxin-apk-impl
git push origin codex/real-lanxin-apk
```

Expected: GitHub contains the Vercel runtime and documentation commits.

- [ ] **Step 2: Configure the Vercel project**

In Vercel Dashboard:

1. Choose **Add New > Project** and import `Luqhhh/vivoAigc`.
2. Set **Root Directory** to `apps/api`.
3. Add the six environment variables documented in Task 2 for Production.
4. Deploy the project.
5. Open **Settings > Git**, set Production Branch to `codex/real-lanxin-apk`, and redeploy that branch if the first deployment used `main`.

Do not paste credential values into commands, source files, issues, logs, or screenshots.

- [ ] **Step 3: Capture production health**

```powershell
$VercelOrigin = Read-Host 'Vercel production HTTPS origin, without trailing slash'
$health = Invoke-RestMethod "$VercelOrigin/api/health"
if (-not $health.ok -or $health.llmMode -ne 'real') {
  throw 'Vercel health is not real-mode ready'
}
New-Item -ItemType Directory -Force -Path evidence\vercel | Out-Null
$health | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 evidence\vercel\health-real.json
```

Expected: `ok: true`, `llmMode: real`, and version `1.0.0`.

- [ ] **Step 4: Execute the fixed real Fibonacci smoke test**

```powershell
$code = "def fib(n):`n    if n <= 1:`n        return n`n    return fib(n - 1) + fib(n - 2)`n`nprint(fib(4))"
$body = @{ language='python'; code=$code } | ConvertTo-Json
$analysis = Invoke-RestMethod -Method Post -Uri "$VercelOrigin/api/analyze-code" -ContentType 'application/json' -Body $body
if ($analysis.source -ne 'lanxin') {
  throw "Expected lanxin source, got $($analysis.source)"
}
if ($analysis.traceSteps.Count -lt 2) {
  throw 'Real analysis trace is incomplete'
}
$analysis | ConvertTo-Json -Depth 100 | Set-Content -Encoding utf8 evidence\vercel\analyze-fibonacci-real.json
```

Expected: `source: lanxin` and schema-valid visualization arrays.

- [ ] **Step 5: Capture controlled local fallback evidence**

Build and start the API locally in real mode with a loopback URL that refuses connections. Dummy non-empty configuration values satisfy startup validation without using the real competition credentials:

```powershell
$node = 'C:\Users\lqh22\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
pnpm --filter @codemotion/api build
$apiJob = Start-Job -ScriptBlock {
  param($repositoryRoot, $nodeExe)
  Set-Location $repositoryRoot
  $env:PORT = '3001'
  $env:NODE_ENV = 'test'
  $env:LLM_MODE = 'real'
  $env:LANXIN_API_URL = 'http://127.0.0.1:9/unreachable'
  $env:LANXIN_APP_ID = 'local-fallback-app'
  $env:LANXIN_APP_KEY = 'local-fallback-key'
  $env:LANXIN_MODEL = 'Doubao-Seed-2.0-mini'
  $env:FRONTEND_ORIGIN = '*'
  & $nodeExe 'apps/api/dist/server.js'
} -ArgumentList $PWD.Path, $node

try {
  $ready = $false
  foreach ($attempt in 1..30) {
    try {
      Invoke-RestMethod 'http://127.0.0.1:3001/api/health' | Out-Null
      $ready = $true
      break
    } catch {
      Start-Sleep -Milliseconds 200
    }
  }
  if (-not $ready) { throw 'Local fallback API did not become ready' }

  $fallback = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:3001/api/analyze-code' -ContentType 'application/json' -Body $body
  if ($fallback.source -ne 'fallback') { throw 'Expected local fallback source' }
  if (@($fallback.warnings | Where-Object { $_.code -eq 'MOCK_USED' }).Count -eq 0) {
    throw 'Fallback warning is missing'
  }
  $fallback | ConvertTo-Json -Depth 100 | Set-Content -Encoding utf8 evidence\vercel\fallback-fibonacci-local.json
} finally {
  Stop-Job -Job $apiJob -ErrorAction SilentlyContinue
  Remove-Job -Job $apiJob -Force -ErrorAction SilentlyContinue
}
```

The local process uses only transient dummy values and is stopped after the response is captured.

- [ ] **Step 6: Commit redacted Vercel evidence**

```powershell
git add evidence/vercel/health-real.json evidence/vercel/analyze-fibonacci-real.json evidence/vercel/fallback-fibonacci-local.json
git commit -m "test: record real vercel provider evidence"
```

- [ ] **Step 7: Resume APK delivery**

Continue at Task 6 of `docs/superpowers/plans/2026-06-30-real-lanxin-render-apk.md`, replacing every later `$RenderOrigin` prompt and label with the verified `$VercelOrigin`. Tasks 6-10 remain responsible for Capacitor assets, release signing, APK build, cloud-device acceptance, final verification, and delivery records.
