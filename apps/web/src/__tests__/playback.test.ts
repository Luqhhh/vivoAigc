import { describe, expect, test } from "vitest";

import {
  clampStepIndex,
  getCurrentStackFrames,
  getCurrentTraceStep,
  nextStepIndex,
  previousStepIndex,
} from "../playback";
import type { CodeAnalyzeResponse } from "../types";

const analysis: CodeAnalyzeResponse = {
  requestId: "req-playback",
  language: "python",
  title: "Playback test",
  summary: "A small trace for playback helper tests.",
  detectedConcepts: [],
  complexity: {
    time: "O(1)",
    space: "O(1)",
    explanation: "Constant work.",
  },
  lineExplanations: [],
  traceSteps: [
    {
      step: 10,
      line: 1,
      event: "start",
      description: "Start execution.",
      variables: {},
      changedVariables: [],
    },
    {
      step: 20,
      line: 2,
      event: "assign",
      description: "Assign n.",
      variables: { n: 1 },
      changedVariables: ["n"],
    },
  ],
  stackFrames: [
    {
      step: 20,
      frames: [
        {
          id: "frame-20",
          functionName: "fib",
          line: 2,
          params: { n: 1 },
          locals: {},
          status: "active",
        },
      ],
    },
    {
      step: 999,
      frames: [
        {
          id: "unrelated-frame",
          functionName: "unrelated",
          line: 99,
          params: {},
          locals: {},
          status: "waiting",
        },
      ],
    },
  ],
  recommendations: [],
  warnings: [],
  source: "mock",
};

describe("playback helpers", () => {
  test("clamps negative and oversized indexes to trace bounds", () => {
    expect(clampStepIndex(-1, analysis)).toBe(0);
    expect(clampStepIndex(99, analysis)).toBe(1);
  });

  test("moves next and previous without leaving trace bounds", () => {
    expect(nextStepIndex(0, analysis)).toBe(1);
    expect(nextStepIndex(1, analysis)).toBe(1);
    expect(previousStepIndex(1, analysis)).toBe(0);
    expect(previousStepIndex(0, analysis)).toBe(0);
  });

  test("clamps to zero without analysis or trace steps", () => {
    expect(clampStepIndex(5)).toBe(0);
    expect(clampStepIndex(5, { ...analysis, traceSteps: [] })).toBe(0);
  });

  test("returns the selected trace step after clamping", () => {
    expect(getCurrentTraceStep(99, analysis)).toBe(analysis.traceSteps[1]);
  });

  test("finds a stack snapshot by trace step number", () => {
    expect(getCurrentStackFrames(1, analysis)).toEqual(
      analysis.stackFrames[0].frames,
    );
  });

  test("returns no frames when the selected trace step has no snapshot", () => {
    expect(getCurrentStackFrames(0, analysis)).toEqual([]);
  });
});
