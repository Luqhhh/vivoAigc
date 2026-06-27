import {
  binarySearchAnalysis,
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

function randomHex(): string {
  return Math.floor(Math.random() * 0x1_0000_0000)
    .toString(16)
    .padStart(8, "0");
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
  const code = request.code.toLowerCase();

  if (code.includes("binary_search") || (code.includes("left") && code.includes("mid"))) {
    return withRequestId(binarySearchAnalysis);
  }

  if (code.includes("fib") || request.visualizationFocus === "recursion") {
    return withRequestId(fibonacciAnalysis);
  }

  return withRequestId({
    ...fibonacciAnalysis,
    title: "Python 算法片段演示",
    summary: "当前使用稳定 mock 分析结果演示 CodeMotion 的执行可视化能力。",
    warnings: [FALLBACK_WARNING],
  });
}

export function answerWithMockTutor(
  request: TutorChatRequest,
): TutorChatResponse {
  const step = request.currentStep ?? 1;
  const baseCaseReturnValue = BASE_CASE_RETURN_VALUE_BY_STEP.get(step);
  const answer =
    baseCaseReturnValue === undefined
      ? `当前步骤不是 base case。真正的 base case 返回发生在第 7、9、12、16、18 步：fib(1) 直接返回 1，fib(0) 直接返回 0，不再创建新调用；这些返回值随后交给等待中的上一层调用相加，使递归逐层回退。`
      : `当前步骤是 base case 返回：fib(${baseCaseReturnValue}) 直接返回 ${baseCaseReturnValue}，不再创建新调用。这个返回值会交给等待中的上一层 fib 调用参与相加，使递归逐层回退。`;

  return {
    requestId: request.requestId,
    answer,
    referencedSteps: [step],
    suggestedFollowups: [
      "fib(0) 为什么返回 0？",
      "返回 1 后调用栈如何变化？",
      "怎样避免重复计算 fib(2)？",
    ],
    source: "mock",
  };
}

export { examples };
