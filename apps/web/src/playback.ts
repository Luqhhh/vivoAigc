import type { CodeAnalyzeResponse, StackFrame, TraceStep } from "./types";

export function clampStepIndex(
  index: number,
  analysis?: CodeAnalyzeResponse,
): number {
  if (!analysis || analysis.traceSteps.length === 0) {
    return 0;
  }

  const normalizedIndex = Number.isFinite(index) ? Math.trunc(index) : 0;

  return Math.min(
    Math.max(normalizedIndex, 0),
    analysis.traceSteps.length - 1,
  );
}

export function nextStepIndex(
  index: number,
  analysis?: CodeAnalyzeResponse,
): number {
  return clampStepIndex(index + 1, analysis);
}

export function previousStepIndex(
  index: number,
  analysis?: CodeAnalyzeResponse,
): number {
  return clampStepIndex(index - 1, analysis);
}

export function getCurrentTraceStep(
  index: number,
  analysis: CodeAnalyzeResponse,
): TraceStep | undefined {
  return analysis.traceSteps[clampStepIndex(index, analysis)];
}

export function getCurrentStackFrames(
  index: number,
  analysis: CodeAnalyzeResponse,
): StackFrame[] {
  const traceStep = getCurrentTraceStep(index, analysis);
  if (!traceStep) {
    return [];
  }

  return (
    analysis.stackFrames.find((snapshot) => snapshot.step === traceStep.step)
      ?.frames ?? []
  );
}
