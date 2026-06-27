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

function randomHex(): string {
  return Math.floor(Math.random() * 0x1_0000_0000)
    .toString(16)
    .padStart(8, "0");
}

export function withRequestId(
  analysis: CodeAnalyzeResponse,
): CodeAnalyzeResponse {
  return {
    ...analysis,
    requestId: `mock-${Date.now()}-${randomHex()}`,
  };
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

  return {
    requestId: request.requestId,
    answer:
      "这里命中了递归的 base case：当 n 等于 1 时，fib(1) 直接返回 1，不再创建新的调用。这个返回值会交给上一层等待中的 fib 调用，与另一个分支的结果相加，随后递归逐层回退，直到 fib(4) 得到最终结果。",
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
