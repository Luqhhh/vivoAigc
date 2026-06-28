import { z } from "zod";

import type {
  AnalysisWarning,
  CodeAnalyzeResponse,
  CodeExample,
  HealthResponse,
  LineExplanation,
  PracticeRecommendation,
  PrimitiveValue,
  RecursionNode,
  RecursionTree,
  StackFrame,
  StackFrameSnapshot,
  TraceStep,
  TutorChatResponse,
} from "./types";

const primitiveValueSchema: z.ZodType<PrimitiveValue> = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

const primitiveRecordSchema: z.ZodType<Record<string, PrimitiveValue>> =
  z.record(primitiveValueSchema);

const sourceSchema = z.enum(["lanxin", "mock", "fallback"]);
const difficultySchema = z.enum(["beginner", "intermediate", "advanced"]);

export const healthResponseSchema: z.ZodType<HealthResponse> = z
  .object({
    ok: z.boolean(),
    service: z.string(),
    llmMode: z.enum(["mock", "real"]),
    version: z.string(),
  })
  .strict();

export const codeExampleSchema: z.ZodType<CodeExample> = z
  .object({
    id: z.string(),
    title: z.string(),
    category: z.enum(["recursion", "binary-search", "stack", "dfs", "dp"]),
    difficulty: difficultySchema,
    concepts: z.array(z.string()),
    code: z.string(),
    stdin: z.string().optional(),
    expectedVisualization: z.array(
      z.enum(["timeline", "stack", "recursion-tree", "variables"]),
    ),
  })
  .strict();

export const examplesResponseSchema: z.ZodType<{
  examples: CodeExample[];
}> = z
  .object({
    examples: z.array(codeExampleSchema),
  })
  .strict();

const lineExplanationSchema: z.ZodType<LineExplanation> = z
  .object({
    line: z.number().int().positive(),
    code: z.string(),
    explanation: z.string(),
    role: z.enum([
      "input",
      "condition",
      "loop",
      "recursive-call",
      "return",
      "state-update",
      "output",
      "other",
    ]),
  })
  .strict();

const traceStepSchema: z.ZodType<TraceStep> = z
  .object({
    step: z.number().int().positive(),
    line: z.number().int().positive(),
    event: z.enum([
      "start",
      "assign",
      "condition",
      "call",
      "return",
      "loop",
      "push",
      "pop",
      "output",
      "end",
    ]),
    description: z.string(),
    variables: primitiveRecordSchema,
    changedVariables: z.array(z.string()),
    stdout: z.string().optional(),
    activeFrameId: z.string().optional(),
    activeRecursionNodeId: z.string().optional(),
  })
  .strict();

const stackFrameSchema: z.ZodType<StackFrame> = z
  .object({
    id: z.string(),
    functionName: z.string(),
    line: z.number().int().positive(),
    params: primitiveRecordSchema,
    locals: primitiveRecordSchema,
    status: z.enum(["active", "waiting", "returned"]),
    returnValue: primitiveValueSchema.optional(),
  })
  .strict();

const stackFrameSnapshotSchema: z.ZodType<StackFrameSnapshot> = z
  .object({
    step: z.number().int().positive(),
    frames: z.array(stackFrameSchema),
  })
  .strict();

const recursionNodeSchema: z.ZodType<RecursionNode> = z
  .object({
    id: z.string(),
    label: z.string(),
    functionName: z.string(),
    args: primitiveRecordSchema,
    status: z.enum(["pending", "active", "returned"]),
    returnValue: primitiveValueSchema.optional(),
    enterStep: z.number().int().positive(),
    exitStep: z.number().int().positive().optional(),
  })
  .strict();

const recursionTreeSchema: z.ZodType<RecursionTree> = z
  .object({
    rootId: z.string(),
    nodes: z.array(recursionNodeSchema),
    edges: z.array(
      z
        .object({
          from: z.string(),
          to: z.string(),
          label: z.string().optional(),
        })
        .strict(),
    ),
  })
  .strict();

const practiceRecommendationSchema: z.ZodType<PracticeRecommendation> = z
  .object({
    id: z.string(),
    title: z.string(),
    difficulty: difficultySchema,
    concepts: z.array(z.string()),
    reason: z.string(),
    visualizationHint: z.string(),
    starterPrompt: z.string().optional(),
  })
  .strict();

const analysisWarningSchema: z.ZodType<AnalysisWarning> = z
  .object({
    code: z.enum([
      "CODE_TOO_LONG",
      "UNSUPPORTED_LANGUAGE",
      "TRACE_PARTIAL",
      "MODEL_FORMAT_REPAIRED",
      "VISUALIZATION_LIMITED",
      "MOCK_USED",
    ]),
    message: z.string(),
  })
  .strict();

export const codeAnalyzeResponseSchema: z.ZodType<CodeAnalyzeResponse> = z
  .object({
    requestId: z.string().min(1),
    language: z.literal("python"),
    title: z.string(),
    summary: z.string(),
    detectedConcepts: z.array(z.string()),
    complexity: z
      .object({
        time: z.string(),
        space: z.string(),
        explanation: z.string(),
      })
      .strict(),
    lineExplanations: z.array(lineExplanationSchema),
    traceSteps: z.array(traceStepSchema).min(1),
    stackFrames: z.array(stackFrameSnapshotSchema),
    recursionTree: recursionTreeSchema.optional(),
    recommendations: z.array(practiceRecommendationSchema),
    warnings: z.array(analysisWarningSchema),
    source: sourceSchema,
  })
  .strict();

export const tutorChatResponseSchema: z.ZodType<TutorChatResponse> = z
  .object({
    requestId: z.string().min(1),
    answer: z.string(),
    referencedSteps: z.array(z.number().int().positive()),
    suggestedFollowups: z.array(z.string()),
    source: sourceSchema,
  })
  .strict();
