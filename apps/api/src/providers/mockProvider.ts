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

function isBinarySearchCode(code: string): boolean {
  return (
    code.includes("binary_search") ||
    (code.includes("left") && code.includes("mid"))
  );
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

  if (isBinarySearchCode(code)) {
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
  const code = request.code.toLowerCase();
  let answer: string;
  let suggestedFollowups: string[];

  if (isBinarySearchCode(code)) {
    answer = `当前第 ${step} 步属于二分查找过程。请结合这一时刻的 left 和 right 理解当前搜索边界，并观察 mid 如何把区间分成两部分；mock 回答不会在请求未提供时猜测具体变量值。`;
    suggestedFollowups = [
      "left 和 right 如何决定当前搜索区间？",
      "mid 为什么能帮助排除一半区间？",
      "下一轮应该保留哪一侧区间？",
    ];
  } else if (code.includes("fib")) {
    const baseCaseReturnValue = BASE_CASE_RETURN_VALUE_BY_STEP.get(step);
    answer =
      baseCaseReturnValue === undefined
        ? `当前步骤不是 base case。真正的 base case 返回发生在第 7、9、12、16、18 步：fib(1) 直接返回 1，fib(0) 直接返回 0，不再创建新调用；这些返回值随后交给等待中的上一层调用相加，使递归逐层回退。`
        : `当前步骤是 base case 返回：fib(${baseCaseReturnValue}) 直接返回 ${baseCaseReturnValue}，不再创建新调用。这个返回值会交给等待中的上一层 fib 调用参与相加，使递归逐层回退。`;
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
    referencedSteps: [step],
    suggestedFollowups,
    source: "mock",
  };
}

export { examples };
