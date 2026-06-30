# CodeMotion Real Lanxin Render and APK Design

## 1. Goal

Deliver an installable Android APK that judges can run remotely and use for real model-backed CodeMotion analysis. The APK contains the React application, calls a public Render-hosted API over HTTPS, and falls back visibly to deterministic mock results when the upstream model is unavailable.

The delivery includes a signed APK, checksum, signing verification, cloud-device installation evidence, real-provider evidence, and updated deployment/test documentation.

## 2. Confirmed External Contract

The competition documentation defines the text-generation endpoint as:

```text
POST https://api-ai.vivo.com.cn/v1/chat/completions
Authorization: Bearer <AppKey>
Content-Type: application/json
```

Required request fields used by CodeMotion:

```json
{
  "requestId": "unique-request-id",
  "model": "Doubao-Seed-2.0-mini",
  "messages": [
    { "role": "user", "content": "<CodeMotion structured prompt>" }
  ],
  "temperature": 0.2,
  "stream": false
}
```

The provider reads the assistant text from `choices[0].message.content`, extracts the requested JSON object, validates it with the existing Zod response schema, and forces `source: "lanxin"` only after validation succeeds.

The model is configurable through `LANXIN_MODEL`; the default is `Doubao-Seed-2.0-mini`. The endpoint is configurable through `LANXIN_API_URL`, with the documented production endpoint used in Render.

References:

- Competition usage guide: `https://aigc.vivo.com.cn/#/document/index?id=1746`
- Authentication guide: `https://aigc.vivo.com.cn/#/document/index?id=1677`
- Large-model API: `https://aigc.vivo.com.cn/#/document/index?id=1745`

## 3. Architecture

```text
Judge's Android device / cloud device
              |
              | HTTPS, /api/*
              v
Render Web Service (Express API)
              |
              | HTTPS, Bearer AppKey
              v
Competition text-generation gateway
```

The APK uses Capacitor's local `https://localhost` origin and sets `VITE_API_BASE_URL` to the Render service origin at build time. The APK never depends on a separately hosted Web frontend.

Render stores runtime configuration as environment variables. No deployment credential values are committed to Git or compiled into the Web bundle.

## 4. API Changes

### 4.1 Environment

Add `LANXIN_MODEL` to the API environment schema with default `Doubao-Seed-2.0-mini`.

Render runtime variables:

```text
NODE_ENV=production
LLM_MODE=real
LANXIN_API_URL=https://api-ai.vivo.com.cn/v1/chat/completions
LANXIN_APP_ID=<configured in Render>
LANXIN_APP_KEY=<configured in Render>
LANXIN_MODEL=Doubao-Seed-2.0-mini
FRONTEND_ORIGIN=https://localhost
```

Render supplies `PORT`.

### 4.2 Provider Request

Replace the generic request envelope with the confirmed competition contract:

- Generate a unique upstream `requestId` for every model call.
- Send `model`, `messages`, `temperature`, and `stream: false`.
- Keep `Authorization: Bearer <AppKey>`.
- Do not send undocumented headers or body fields.
- Keep the 45-second provider timeout.
- Convert non-2xx responses, malformed JSON, missing content, invalid model JSON, and schema failures into `LanxinProviderError`.

The Express route keeps the existing fallback behavior. A failed real call returns the same stable analysis with `source: "fallback"` and a visible warning; it must never be labeled `lanxin`.

### 4.3 Public Service Controls

Keep the current 64 KB payload and 200-line source limits. Add a conservative per-IP rate limit for analysis and tutor routes, with Render proxy handling configured so client IPs are interpreted correctly. Health and example catalog routes remain available for diagnostics.

Request logs remain metadata-only and include request ID, route, status, duration, and response source.

## 5. Render Deployment

Add a root `render.yaml` defining one Node Web Service:

- Build: enable Corepack, install the frozen pnpm workspace with development dependencies, and build `@codemotion/api`.
- Start: run `@codemotion/api`'s compiled server.
- Health check: `/api/health`.
- Runtime: supported Node 22 release.
- Branch: `main` after the feature branch is reviewed and merged.

The deployment sequence is:

1. Push the deployment configuration.
2. Create the Render service from the repository Blueprint.
3. Enter the runtime variables in the Render dashboard.
4. Wait for `/api/health` to return `ok: true` and `llmMode: "real"`.
5. Call `/api/analyze-code` with the fixed Fibonacci dataset and require `source: "lanxin"`.
6. Record the Render service origin for the APK build.

Render free instances can cold-start after inactivity. The Web client will retry health checks with bounded backoff and expose an explicit checking/offline state. Before judging, the service should be warmed with `/api/health`. Mock fallback remains available if the upstream model fails after the API is awake.

## 6. Android APK

Add Capacitor 8 to `apps/web` and create the Android project with:

```text
appId: com.codemotion.visualizer
appName: CodeMotion
webDir: dist
```

No remote `server.url` is used. The workflow is:

1. Build the Web app with `VITE_API_BASE_URL=<Render HTTPS origin>`.
2. Sync the built files into the Android project.
3. Build a release APK.
4. Sign with a dedicated local competition release keystore.
5. Verify the signature with `apksigner`.
6. Produce a SHA-256 checksum.
7. Scan the unpacked APK for deployment credential patterns.

The keystore and password material live in an ignored local release directory and are not committed. The final deliverable is `dist/CodeMotion-1.0.0.apk` plus its checksum and verification evidence.

## 7. Cloud-Device Acceptance

Use the competition platform's cloud-device service for final Android evidence:

1. Install `CodeMotion-1.0.0.apk`.
2. Launch to the workbench and confirm no blank screen or horizontal overflow.
3. Confirm the service state becomes real-service ready after any cold-start retry.
4. Analyze fixed Fibonacci dataset A.
5. Require a schema-valid response with `source: "lanxin"`.
6. Play the trace, switch to call stack and recursion tree, and ask one tutor question.
7. Capture install, home, analysis, recursion-tree, and tutor screenshots.
8. Temporarily force an invalid upstream configuration in a separate test deployment and verify visible `fallback` behavior without exposing upstream details.

Cloud-device evidence supplements, but does not replace, API response JSON, Render deployment logs, signature verification, checksum, and APK secret-scan evidence.

## 8. Testing Strategy

### Automated

- Provider request test asserts endpoint call, Bearer authorization, requestId, configured model, non-streaming mode, and absence of undocumented fields.
- Provider response tests cover valid content, fenced JSON, malformed gateway JSON, invalid model JSON, schema mismatch, HTTP error, network failure, and timeout.
- Route tests cover `lanxin`, `fallback`, rate limiting, and safe request logging.
- Web tests cover health retry success, retry exhaustion, real-service state, and existing analysis behavior.
- Existing API and Web suites remain green.

### Deployment and APK

- `pnpm test`
- `pnpm build`
- Render health and real Fibonacci smoke test
- Browser smoke against the Render API
- Gradle release build
- `apksigner verify --verbose --print-certs`
- SHA-256 generation
- APK unpacked secret-pattern scan
- Cloud-device installation and end-to-end workflow

## 9. Error Handling

- Render unavailable: APK shows service unavailable and allows retry.
- Render cold start: bounded health retries continue before declaring offline.
- Upstream HTTP/network/timeout error: API returns explicit fallback data.
- Model returns prose or invalid JSON: provider rejects it and the API falls back.
- Model response fails Zod validation: provider rejects it and the API falls back.
- Rate limit exceeded: API returns a recoverable 429 response with a user-facing retry message.
- APK cannot reach Render: no upstream internals or runtime credentials are displayed.

## 10. Acceptance Criteria

The work is complete only when all of the following are true:

1. GitHub contains no runtime credential value in the current tracked tree.
2. Render `/api/health` is publicly reachable over HTTPS in real mode.
3. A fixed Fibonacci request returns `source: "lanxin"` and schema-valid visualization data.
4. A forced upstream failure returns visible `source: "fallback"` data.
5. The signed APK installs and launches on the competition cloud device.
6. The APK completes analysis, playback, recursion-tree, and tutor workflows.
7. Signature verification, SHA-256, APK scan, API JSON, logs, and screenshots exist under `evidence/`.
8. The test report records executed results without promoting unexecuted checks to PASS.

## 11. Out of Scope

- Production Web hosting.
- App-store submission.
- User accounts, billing, persistent databases, or analytics.
- Executing arbitrary Python code on the server.
- Long-term multi-region production operations or an uptime SLA.
