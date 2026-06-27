import type { CodeAnalyzeRequest, TutorChatRequest } from "./types.js";

export function buildAnalysisPrompt(request: CodeAnalyzeRequest): string {
  const userLevel = request.userLevel ?? "beginner";
  const visualizationFocus = request.visualizationFocus ?? "auto";
  const stdin = request.stdin ?? "未提供";

  return `你是 CodeMotion 的中文 Python 代码可视化导师。
只分析一份 Python 单文件代码，绝对不要执行代码。请根据代码静态推演执行过程，并为学习者生成可视化分析。

用户水平：${userLevel}
可视化重点：${visualizationFocus}
标准输入 stdin：${stdin}

必须只返回严格有效的 JSON 对象，不要使用 Markdown、代码围栏或任何 JSON 之外的文字。
返回对象必须完整符合 CodeAnalyzeResponse：包含 requestId、language、title、summary、detectedConcepts、complexity、lineExplanations、traceSteps、stackFrames、可选 recursionTree、recommendations、warnings、source。
language 必须是 python；traceSteps 至少一项；所有行号和步骤号必须为正整数；不要编造代码中不存在的行为。

Python 代码：
${request.code}`;
}

export function buildTutorPrompt(request: TutorChatRequest): string {
  const currentStep = request.currentStep ?? 1;

  return `你是 CodeMotion 的中文 AI 编程导师。请围绕当前代码和已有分析回答学习者问题。
当前步骤：第 ${currentStep} 步
分析摘要：${request.analysisSummary}
学习者问题：${request.question}

只能依据给出的代码、当前步骤和分析摘要回答。不要编造不存在的代码行，不要编造未提供的变量或变量值。
必须只返回严格有效的 TutorChatResponse JSON 对象，不要使用 Markdown 或代码围栏。对象包含 requestId、answer、referencedSteps、suggestedFollowups、source。

当前代码：
${request.code}`;
}
