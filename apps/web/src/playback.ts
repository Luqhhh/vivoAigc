import type { CodeAnalyzeResponse, StackFrame, TraceStep } from "./types";

export function clampStepIndex(
  index: number,
  analysis?: CodeAnalyzeResponse,
): number {
  if (!analysis || analysis.traceSteps.length === 0) {
    return 0;
  }

  return Math.min(Math.max(index, 0), analysis.traceSteps.length - 1);
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
): TraceStep {
  return analysis.traceSteps[clampStepIndex(index, analysis)];
}

export function getCurrentStackFrames(
  index: number,
  analysis: CodeAnalyzeResponse,
): StackFrame[] {
  const step = getCurrentTraceStep(index, analysis).step;

  return (
    analysis.stackFrames.find((snapshot) => snapshot.step === step)?.frames ?? []
  );
}
