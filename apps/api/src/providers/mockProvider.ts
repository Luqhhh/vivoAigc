import {
  binarySearchAnalysis,
  bracketStackAnalysis,
  climbingStairsAnalysis,
  depthFirstSearchAnalysis,
  examples,
  fibonacciAnalysis,
} from "../mockData.js";
import type {
  CodeAnalyzeRequest,
  CodeAnalyzeResponse,
  TutorChatRequest,
  TutorChatResponse,
} from "../types.js";

const FALLBACK_WARNING = {
  code: "MOCK_USED" as const,
  message: "未识别到专用示例，当前返回稳定 mock 演示结果。",
};

const BASE_CASE_RETURN_VALUE_BY_STEP = new Map<number, number>([
  [7, 1],
  [9, 0],
  [12, 1],
  [16, 1],
  [18, 0],
]);

const ANALYSIS_BY_EXAMPLE_ID = new Map<string, CodeAnalyzeResponse>([
  ["fibonacci-recursion", fibonacciAnalysis],
  ["binary-search", binarySearchAnalysis],
  ["bracket-stack", bracketStackAnalysis],
  ["depth-first-search", depthFirstSearchAnalysis],
  ["climbing-stairs", climbingStairsAnalysis],
]);

function randomHex(): string {
  return Math.floor(Math.random() * 0x1_0000_0000)
    .toString(16)
    .padStart(8, "0");
}

function normalizeNewlines(code: string): string {
  return code.replace(/\r\n|\r/g, "\n");
}

function exampleForCode(code: string) {
  const normalizedCode = normalizeNewlines(code);

  return examples.find(
    ({ code: exampleCode }) =>
      normalizeNewlines(exampleCode) === normalizedCode,
  );
}

function analysisForExampleCode(
  code: string,
): CodeAnalyzeResponse | undefined {
  const example = exampleForCode(code);

  return example ? ANALYSIS_BY_EXAMPLE_ID.get(example.id) : undefined;
}

function createGenericAnalysis(code: string): CodeAnalyzeResponse {
  const sourceLines = normalizeNewlines(code).split("\n");
  const lineExplanations: CodeAnalyzeResponse["lineExplanations"] =
    sourceLines.flatMap((sourceLine, index) =>
      sourceLine.trim().length === 0
        ? []
        : [
            {
              line: index + 1,
              code: sourceLine,
              explanation:
                "该行来自本次请求；稳定 mock 仅标记源代码位置，不推断运行状态。",
              role: "other" as const,
            },
          ],
    );
  const firstLine = lineExplanations[0]?.line ?? 1;
  const lastLine = lineExplanations.at(-1)?.line ?? firstLine;

  return {
    requestId: "mock-generic-base",
    language: "python",
    title: "Python 算法片段演示",
    summary:
      "未识别到专用示例；以下内容仅按提交的代码行提供静态说明，不推断运行结果或返回值。",
    detectedConcepts: ["静态代码浏览"],
    complexity: {
      time: "未知",
      space: "未知",
      explanation: "稳定 mock 未执行这段自定义代码，因此不推断复杂度。",
    },
    lineExplanations,
    traceSteps: [
      {
        step: 1,
        line: firstLine,
        event: "start",
        description: "开始静态查看本次请求提交的代码。",
        variables: { lineCount: sourceLines.length },
        changedVariables: ["lineCount"],
      },
      {
        step: 2,
        line: lastLine,
        event: "end",
        description: "静态查看结束；未执行代码或推断运行结果。",
        variables: { lineCount: sourceLines.length },
        changedVariables: [],
      },
    ],
    stackFrames: [],
    recommendations: [],
    warnings: [FALLBACK_WARNING],
    source: "mock",
  };
}

export function withRequestId(
  analysis: CodeAnalyzeResponse,
): CodeAnalyzeResponse {
  const response = structuredClone(analysis);
  response.requestId = `mock-${Date.now()}-${randomHex()}`;
  return response;
}

export function analyzeWithMock(
  request: CodeAnalyzeRequest,
): CodeAnalyzeResponse {
  const exampleAnalysis = analysisForExampleCode(request.code);

  if (exampleAnalysis) {
    return withRequestId(exampleAnalysis);
  }

  return withRequestId(createGenericAnalysis(request.code));
}

export function answerWithMockTutor(
  request: TutorChatRequest,
): TutorChatResponse {
  const step = request.currentStep ?? 1;
  const exampleId = exampleForCode(request.code)?.id;
  let answer: string;
  let referencedSteps = [step];
  let suggestedFollowups: string[];

  if (exampleId === "binary-search") {
    answer = `当前第 ${step} 步属于二分查找过程。请结合这一时刻的 left 和 right 理解当前搜索边界，并观察 mid 如何把区间分成两部分；mock 回答不会在请求未提供时猜测具体变量值。`;
    suggestedFollowups = [
      "left 和 right 如何决定当前搜索区间？",
      "mid 为什么能帮助排除一半区间？",
      "下一轮应该保留哪一侧区间？",
    ];
  } else if (exampleId === "fibonacci-recursion") {
    const baseCaseReturnValue = BASE_CASE_RETURN_VALUE_BY_STEP.get(step);
    answer =
      baseCaseReturnValue === undefined
        ? `当前步骤不是 base case。真正的 base case 返回发生在第 7、9、12、16、18 步：fib(1) 直接返回 1，fib(0) 直接返回 0，不再创建新调用；这些返回值随后交给等待中的上一层调用相加，使递归逐层回退。`
        : `当前步骤是 base case 返回：fib(${baseCaseReturnValue}) 直接返回 ${baseCaseReturnValue}，不再创建新调用。这个返回值会交给等待中的上一层 fib 调用参与相加，使递归逐层回退。`;
    if (baseCaseReturnValue === undefined) {
      referencedSteps = [step, ...BASE_CASE_RETURN_VALUE_BY_STEP.keys()];
    }
    suggestedFollowups = [
      "fib(0) 为什么返回 0？",
      "返回值产生后调用栈如何变化？",
      "怎样避免重复计算 fib(2)？",
    ];
  } else {
    answer = `当前第 ${step} 步需要结合已有分析理解。分析摘要：${request.analysisSummary} 你的问题是“${request.question}”。当前 mock 不补充代码中未提供的行号或变量值。`;
    suggestedFollowups = [
      "这一步执行前后的状态有什么变化？",
      "当前条件会如何影响下一步？",
      "可以用更小的输入手动跟踪吗？",
    ];
  }

  return {
    requestId: request.requestId,
    answer,
    referencedSteps,
    suggestedFollowups,
    source: "mock",
  };
}

export { examples };
