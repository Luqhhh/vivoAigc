import { z } from "zod";

const primitiveValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

const primitiveRecordSchema = z.record(primitiveValueSchema);
const sourceSchema = z.enum(["lanxin", "mock", "fallback"]);
const nonBlankString = (maxLength: number) =>
  z
    .string()
    .min(1)
    .max(maxLength)
    .refine((value) => value.trim().length > 0, {
      message: "不得仅包含空白字符。",
    });

export const codeAnalyzeRequestSchema = z
  .object({
    language: z.literal("python"),
    code: nonBlankString(12_000),
    stdin: z.string().max(4_000).optional(),
    visualizationFocus: z
      .enum(["auto", "recursion", "stack", "variables", "dp"])
      .default("auto"),
    userLevel: z.enum(["beginner", "intermediate"]).default("beginner"),
  })
  .strict();

export const tutorChatRequestSchema = z
  .object({
    requestId: nonBlankString(500),
    code: nonBlankString(12_000),
    currentStep: z.number().int().positive().optional(),
    analysisSummary: nonBlankString(3_000),
    question: nonBlankString(500),
  })
  .strict();

export const lineExplanationSchema = z
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

export const traceStepSchema = z
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

export const stackFrameSchema = z
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

export const stackFrameSnapshotSchema = z
  .object({
    step: z.number().int().positive(),
    frames: z.array(stackFrameSchema),
  })
  .strict();

export const recursionNodeSchema = z
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

export const recursionTreeSchema = z
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

export const practiceRecommendationSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    difficulty: z.enum(["beginner", "intermediate", "advanced"]),
    concepts: z.array(z.string()),
    reason: z.string(),
    visualizationHint: z.string(),
    starterPrompt: z.string().optional(),
  })
  .strict();

export const analysisWarningSchema = z
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

export const codeAnalyzeResponseSchema = z
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

export const tutorChatResponseSchema = z
  .object({
    requestId: z.string().min(1),
    answer: z.string(),
    referencedSteps: z.array(z.number().int().positive()),
    suggestedFollowups: z.array(z.string()),
    source: sourceSchema,
  })
  .strict();

export type ParsedCodeAnalyzeRequest = z.infer<
  typeof codeAnalyzeRequestSchema
>;
export type ParsedTutorChatRequest = z.infer<typeof tutorChatRequestSchema>;
