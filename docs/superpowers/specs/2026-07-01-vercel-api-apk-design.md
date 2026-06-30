# Vercel API and APK Delivery Design

**Date:** 2026-07-01

**Status:** Approved for planning

## Context

The CodeMotion APK needs a public HTTPS API that can call the official Lanxin competition endpoint. Render cannot be used because its account verification requires a payment card that is unavailable for this delivery. Vercel Hobby is the replacement deployment target.

## Goals

- Deploy the existing Express API on Vercel without rewriting its routes or providers.
- Keep all Lanxin credentials in Vercel environment variables.
- Preserve `https://localhost` as the Capacitor application origin.
- Allow real model calls enough time to complete on the Vercel Hobby plan.
- Produce repeatable health, real-provider, fallback, APK, and cloud-device evidence.

## Non-Goals

- No Cloudflare Workers or Edge-runtime rewrite.
- No database or distributed rate-limit store for the competition build.
- No frontend redesign.
- No credential values in Git, APK assets, logs, screenshots, or documentation.

## Architecture

Vercel will import the existing GitHub repository as a monorepo project with `apps/api` as its Root Directory. Vercel's Express detection will use `apps/api/src/server.ts` as the application entry. That file will export the configured Express instance as its default export when running on Vercel and will retain local `app.listen` behavior outside Vercel.

`apps/api/vercel.json` will configure the recognized server entry as one Node.js function with a 60-second maximum duration. `apps/api/package.json` will request Node 22.x. The API routes and response schemas remain unchanged.

The Capacitor application will call the Vercel production origin through `VITE_API_BASE_URL`. Requests flow as follows:

1. The APK sends an HTTPS request to the Vercel production domain.
2. Vercel invokes the Express function.
3. Express validates and rate-limits the request.
4. In real mode, the provider calls the official Lanxin endpoint with the server-side AppKEY.
5. A schema-valid Lanxin result is returned with `source: lanxin`; provider failures retain the existing explicit fallback response.

## Repository Changes

- Modify `apps/api/src/server.ts` to export the Express app and avoid opening a listener on Vercel.
- Create `apps/api/vercel.json` with schema metadata and a 60-second function duration.
- Add Node 22.x to `apps/api/package.json`.
- Replace the Render configuration contract test with a Vercel deployment contract test.
- Remove `render.yaml` from the final delivery tree.
- Rewrite the deployment documentation and evidence paths for Vercel.
- Keep `.node-version` as a repository-level Node 22 development hint; it is not treated as an exact runtime pin.

## Vercel Project Configuration

- Repository: `Luqhhh/vivoAigc`
- Root Directory: `apps/api`
- Production Branch: `codex/real-lanxin-apk`
- Framework Preset: Express or automatic detection
- Node.js: 22.x
- Required production environment variables:
  - `LLM_MODE=real`
  - `LANXIN_API_URL=https://api-ai.vivo.com.cn/v1/chat/completions`
  - `LANXIN_MODEL=Doubao-Seed-2.0-mini`
  - `LANXIN_APP_ID` entered in the dashboard
  - `LANXIN_APP_KEY` entered in the dashboard
  - `FRONTEND_ORIGIN=https://localhost`

Vercel supplies runtime platform variables automatically. No local `.env` file is deployed.

## Rate-Limit Boundary

The current `express-rate-limit` memory store remains useful as per-instance protection and testable request shaping. Vercel can run multiple function instances, so these counters are not globally shared. This limitation is acceptable for the low-volume competition acceptance workflow and must be documented. A distributed store would be required before public scaling.

## Error Handling

- Vercel startup or configuration failures must fail deployment rather than silently switching deployment targets.
- `/api/health` must report `llmMode: real` before APK packaging.
- A real smoke response must contain `source: lanxin`.
- Provider failures continue to return the existing `source: fallback` and `MOCK_USED` warning where applicable.
- The Web health retry remains bounded and abortable for cold starts or transient function activation.

## Testing and Evidence

Automated tests will verify:

- `vercel.json` targets the Express entry and allows 60 seconds.
- `server.ts` exports the Express app without listening when `VERCEL=1`.
- Node 22.x is declared for the API package.
- Removed Render configuration is no longer referenced by active deployment instructions.
- Existing API and Web test suites remain green.

Live acceptance will capture:

- Vercel `/api/health` JSON in real mode.
- A fixed Fibonacci analysis response with `source: lanxin`.
- A controlled fallback response without credentials.
- The final Vercel production origin used to build the APK.
- APK signature, SHA-256, secret scan, and cloud-device screenshots.

## Acceptance Criteria

The migration is accepted only when:

1. Vercel deploys from `codex/real-lanxin-apk` with `apps/api` as Root Directory.
2. `/api/health` returns HTTP 200, `ok: true`, and `llmMode: real`.
3. The fixed Fibonacci request returns a schema-valid `source: lanxin` result.
4. The APK is rebuilt with the verified Vercel HTTPS origin.
5. The signed APK installs and completes the real analysis workflow on the competition cloud device.
6. Tracked files and the unpacked APK contain no Lanxin credential values.
