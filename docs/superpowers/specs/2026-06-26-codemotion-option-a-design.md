# CodeMotion Option A Design

Date: 2026-06-26

Status: Approved for planning

## Goal

Build the first deliverable slice for CodeMotion: a runnable mobile-first Web app, a runnable API service, a mock/real Lanxin LLM integration framework, and complete deployment and testing documentation. This scope intentionally does not require producing an Android APK artifact in this pass, but the deployment guide must document the Capacitor APK packaging path and prerequisites.

## Source Requirements

This design is based on:

- `demand.md`
- `spec/01-interface-design.md`
- `spec/02-functional-design.md`
- `spec/03-delivery-content.md`
- `spec/04-acceptance-criteria-and-test-evidence.md`

The app must present CodeMotion as "让代码和算法动起来的 AI 可视化导师" for education and algorithm learning. The core value is turning Python algorithm code into visible, traceable, interactive execution explanations.

## Scope

### In Scope

- Mobile-first Web application.
- Backend API service.
- Stable mock data for Fibonacci, binary search, stack matching, DFS grid, and climbing stairs DP.
- Real Lanxin provider adapter controlled by server environment variables.
- API endpoints for health, examples, code analysis, and tutor chat.
- Trace playback with timeline, variables, call stack, and recursion tree views.
- AI tutor follow-up flow scoped to current code and current step.
- Practice recommendation display.
- Work, examples, practice, and project/about tabs.
- README, deployment guide, demo script, and test report.
- Security guidance and secret-scan instructions.

### Out of Scope For This Pass

- Actually generating `CodeMotion-1.0.0.apk`.
- User accounts, login, cloud history, online judging, community sharing.
- Running untrusted user code.
- Full support for non-Python languages.
- A confirmed production Lanxin endpoint unless one is supplied through environment configuration.

## External Lanxin Research Result

Public search found vivo's official developer portal and a Lanxin product route at:

- `https://developers.vivo.com/`
- `https://developers.vivo.com/product/ai/bluelm`

The public portal confirms a "蓝心大模型" product entry, but the publicly loaded page assets did not expose a stable HTTP endpoint, authentication signature, request schema, or response schema. To avoid blocking delivery on missing public API details, the implementation will provide a real-mode adapter with configurable endpoint and credentials:

- `LLM_MODE=mock | real`
- `LANXIN_API_URL`
- `LANXIN_APP_ID`
- `LANXIN_APP_KEY`

The adapter will be the only file that depends on the final Lanxin HTTP contract. Mock mode remains the default and must be fully demonstrable.

## Product Structure

The first screen is the working learning surface, not a landing page.

Bottom navigation has four tabs:

- Workbench
- Examples
- Practice
- About

### Workbench

Before analysis, the workbench shows:

- Top bar with CodeMotion title, language tag, and service status.
- Current task hint.
- Code input area with line count, clear/reset controls, example selection, and AI analyze button.
- Preview area for pending visualization.

After analysis, the same page shows:

- Analysis summary and warning source indicator.
- View switcher for timeline, call stack, and recursion tree.
- Current highlighted code step.
- Variable panel derived from the current trace step.
- Current step explanation.
- AI tutor panel.
- Fixed playback controls for previous, play/pause, next, speed, and progress.

### Examples

The examples tab provides a fast demo path for review and learning. It must include:

- Fibonacci recursion.
- Binary search.
- Bracket matching.
- DFS grid traversal.
- Climbing stairs DP.

Each example has title, category, difficulty, concepts, code, expected visualization types, and a stable mock analysis result.

### Practice

The practice tab shows recommendations from the latest analysis or default curated practice cards. Each card includes title, difficulty, concepts, recommendation reason, visualization hint, and an action to analyze user code in the workbench.

### About

The about tab explains the product value, technical route, delivery status, Web/API mode, and Lanxin integration approach. It must never display the real AppKEY.

## Architecture

Use a simple monorepo layout:

```text
apps/
  web/
  api/
docs/
  deployment.md
  demo-script.md
  test-report.md
spec/
evidence/
```

### Frontend

Use React, TypeScript, Vite, and CSS suited for mobile-first rendering. Use a small local state layer with React Context or Zustand-style store. The frontend responsibilities are:

- Render the mobile interface.
- Validate input length before API calls.
- Call API endpoints.
- Store current analysis, playback step, active view, service status, and tutor messages.
- Derive code highlighting, variables, call stack, and recursion tree state from `analysis + currentStep`.
- Provide recoverable empty, loading, and error states.
- Avoid exposing credentials or executing user code.

### Backend

Use Node, Express, TypeScript, and Zod. The backend responsibilities are:

- Keep Lanxin credentials server-side only.
- Validate all incoming requests.
- Serve examples and stable mock analysis data.
- Proxy real Lanxin requests when configured.
- Normalize and validate model output into `CodeAnalyzeResponse`.
- Return stable API errors without stack traces.
- Log request IDs, route, status, duration, and response source with secrets redacted.

## API Contract

Implement these endpoints:

- `GET /api/health`
- `GET /api/examples`
- `POST /api/analyze-code`
- `POST /api/tutor-chat`

`/api/health` returns service name, version, and current `llmMode`.

`/api/examples` returns the five required examples.

`/api/analyze-code` accepts Python code, optional stdin, visualization focus, and user level. It returns `CodeAnalyzeResponse` with summary, line explanations, trace steps, stack frame snapshots, optional recursion tree, recommendations, warnings, and source.

`/api/tutor-chat` accepts the current request ID, code, current step, analysis summary, and question. It returns an answer, referenced steps, follow-up suggestions, and source.

## Data Flow

1. User enters code or loads an example.
2. Frontend validates non-empty input, maximum 200 lines, and maximum 12000 characters.
3. Frontend calls `POST /api/analyze-code`.
4. Backend chooses provider by `LLM_MODE`.
5. Mock provider returns deterministic analysis data.
6. Real provider builds a schema-constrained prompt, calls `LANXIN_API_URL`, extracts JSON, validates it, and normalizes it.
7. If real provider fails and fallback is allowed, backend returns mock/fallback data with an explicit warning.
8. Frontend stores the analysis and resets `currentStep` to the first trace step.
9. Timeline, variables, stack, tree, and explanation derive from `currentStep`.
10. Tutor chat sends code, current step, and analysis summary to the backend.

`currentStep` is the only playback state source. View switching does not mutate it.

## Error Handling

Frontend validation errors are inline:

- Empty code.
- Too many lines.
- Too many characters.
- Tutor question too long.

API errors use:

```ts
type ApiError = {
  requestId: string;
  error: {
    code: string;
    message: string;
    recoverable: boolean;
    suggestion?: string;
  };
};
```

Backend error cases include:

- `INVALID_INPUT`
- `CODE_TOO_LONG`
- `LLM_UNAVAILABLE`
- `LLM_FORMAT_INVALID`
- `UNSUPPORTED_LANGUAGE`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

The frontend must never show raw stack traces or raw provider responses. It should offer retry and example demonstration where recovery is possible.

## Security

- `LANXIN_APP_KEY` is only read by the backend process.
- `.env.example` contains placeholders only.
- Frontend source, frontend build output, screenshots, and docs must not include the real AppKEY.
- Logs redact credentials and authorization headers.
- The backend does not execute user code.
- CORS is configurable through `FRONTEND_ORIGIN`.
- Delivery docs include secret-scan commands.

## Testing And Evidence

Automated backend tests should cover:

- Health endpoint.
- Examples endpoint.
- Mock code analysis.
- Mock tutor chat.
- Empty input.
- Overlong code.
- Invalid provider output handling where practical.

Frontend tests should cover:

- Trace step navigation.
- Playback stops at the final step.
- View switching preserves current step.
- Variable derivation from the current step.
- Error-state rendering.

Manual verification should cover:

- 360px mobile layout for all tabs.
- Fibonacci recursion tree.
- Binary search variable changes.
- Tutor question around a current step.
- Practice recommendation display.
- Service failure or fallback state.
- Secret scanning.

Evidence paths should follow the existing acceptance spec under `evidence/`.

## Delivery Documents

Create:

- `README.md`
- `docs/deployment.md`
- `docs/demo-script.md`
- `docs/test-report.md`

`docs/deployment.md` must include:

- System requirements.
- API environment variables.
- Backend startup.
- Frontend startup.
- Production frontend build.
- Web deployment notes.
- Lanxin `mock` and `real` modes.
- How to verify `/api/health`.
- How to run tests.
- Capacitor APK packaging tutorial and Android SDK prerequisites.
- Secret-scan commands.

## Implementation Boundaries

Keep the implementation intentionally small and reviewable:

- Shared types can live in the API and be mirrored in the Web app, or extracted later if duplication becomes costly.
- Mock data should be complete enough for the five examples but not over-abstracted.
- Lanxin real-mode logic belongs in one provider file plus prompt utilities.
- UI components should be split by domain: code input, visualizer, playback controls, tutor panel, examples, practice, about.
- Avoid adding unrelated features such as accounts, history sync, or online judge integration.

## Acceptance For This Design

The design is complete when:

- The Web app can run locally.
- The API can run locally.
- Mock mode demonstrates the complete learning loop.
- Real mode has a documented adapter and environment variables.
- Docs explain deployment, testing, demo flow, and APK packaging steps.
- No real AppKEY is committed.
