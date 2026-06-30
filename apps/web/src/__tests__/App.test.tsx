import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import App from "../App";
import type {
  CodeAnalyzeResponse,
  CodeExample,
  HealthResponse,
  TutorChatResponse,
} from "../types";

const originalFetch = globalThis.fetch;

const health: HealthResponse = {
  ok: true,
  service: "codemotion-api",
  llmMode: "mock",
  version: "1.0.0",
};

const examples: CodeExample[] = [
  {
    id: "binary-search",
    title: "二分查找目标值",
    category: "binary-search",
    difficulty: "beginner",
    concepts: ["二分查找", "循环"],
    code: "items = [1, 3, 5, 7]\nprint(items[2])",
    expectedVisualization: ["timeline", "variables"],
  },
];

const analysis: CodeAnalyzeResponse = {
  requestId: "analysis-1",
  language: "python",
  title: "斐波那契递归",
  summary: "函数通过递归拆分问题，并在基础条件处返回。",
  detectedConcepts: ["递归", "基础条件"],
  complexity: {
    time: "O(2^n)",
    space: "O(n)",
    explanation: "递归分支重复计算，调用深度随 n 增长。",
  },
  lineExplanations: [
    {
      line: 1,
      code: "def fibonacci(n):",
      explanation: "定义递归函数。",
      role: "other",
    },
    {
      line: 2,
      code: "    if n <= 1:",
      explanation: "检查基础条件。",
      role: "condition",
    },
    {
      line: 4,
      code: "    return fibonacci(n - 1) + fibonacci(n - 2)",
      explanation: "继续拆分为两个子问题。",
      role: "recursive-call",
    },
  ],
  traceSteps: [
    {
      step: 1,
      line: 1,
      event: "start",
      description: "准备调用 fibonacci(3)。",
      variables: { n: 3 },
      changedVariables: ["n"],
      activeFrameId: "fib-3",
      activeRecursionNodeId: "node-3",
    },
    {
      step: 2,
      line: 4,
      event: "call",
      description: "进入 fibonacci(2)。",
      variables: { n: 2, branch: "left" },
      changedVariables: ["n", "branch"],
      activeFrameId: "fib-2",
      activeRecursionNodeId: "node-2",
    },
    {
      step: 3,
      line: 2,
      event: "return",
      description: "基础条件返回 1。",
      variables: { n: 1, result: 1 },
      changedVariables: ["result"],
      stdout: "2\n",
      activeFrameId: "fib-1",
      activeRecursionNodeId: "node-1",
    },
  ],
  stackFrames: [
    {
      step: 1,
      frames: [
        {
          id: "fib-3",
          functionName: "fibonacci",
          line: 1,
          params: { n: 3 },
          locals: {},
          status: "active",
        },
      ],
    },
    {
      step: 2,
      frames: [
        {
          id: "fib-3",
          functionName: "fibonacci",
          line: 4,
          params: { n: 3 },
          locals: {},
          status: "waiting",
        },
        {
          id: "fib-2",
          functionName: "fibonacci",
          line: 4,
          params: { n: 2 },
          locals: { branch: "left" },
          status: "active",
        },
      ],
    },
    {
      step: 3,
      frames: [
        {
          id: "fib-1",
          functionName: "fibonacci",
          line: 2,
          params: { n: 1 },
          locals: {},
          status: "returned",
          returnValue: 1,
        },
      ],
    },
  ],
  recursionTree: {
    rootId: "node-3",
    nodes: [
      {
        id: "node-3",
        label: "fib(3)",
        functionName: "fibonacci",
        args: { n: 3 },
        status: "active",
        enterStep: 1,
      },
      {
        id: "node-2",
        label: "fib(2)",
        functionName: "fibonacci",
        args: { n: 2 },
        status: "active",
        enterStep: 2,
      },
      {
        id: "node-1",
        label: "fib(1)",
        functionName: "fibonacci",
        args: { n: 1 },
        status: "returned",
        returnValue: 1,
        enterStep: 3,
        exitStep: 3,
      },
    ],
    edges: [
      { from: "node-3", to: "node-2", label: "n - 1" },
      { from: "node-2", to: "node-1", label: "n - 1" },
    ],
  },
  recommendations: [
    {
      id: "memoization",
      title: "为递归添加记忆化",
      difficulty: "intermediate",
      concepts: ["递归", "动态规划"],
      reason: "减少重复子问题计算。",
      visualizationHint: "比较缓存命中前后的调用树规模。",
      starterPrompt: "使用字典缓存 fibonacci 的结果。",
    },
  ],
  warnings: [{ code: "MOCK_USED", message: "当前使用本地模拟分析。" }],
  source: "mock",
};

function jsonResponse(payload: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

let analyzeHandler: () => Promise<Response>;
let tutorHandler: (request: RequestInit | undefined) => Promise<Response>;
let healthHandler: () => Promise<Response>;
let examplesHandler: () => Promise<Response>;

function installRouteFetch(): ReturnType<typeof vi.fn<typeof fetch>> {
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const route =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.pathname
          : input.url;
    if (route === "/api/health") return healthHandler();
    if (route === "/api/examples") return examplesHandler();
    if (route === "/api/analyze-code") return analyzeHandler();
    if (route === "/api/tutor-chat") return tutorHandler(init);
    return jsonResponse({ error: { message: "unknown route" } }, { status: 404 });
  });
  globalThis.fetch = fetchMock;
  return fetchMock;
}

async function analyzeCurrentCode(): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: "分析代码" }));
  await screen.findByText(analysis.summary);
}

beforeEach(() => {
  healthHandler = async () => jsonResponse(health);
  examplesHandler = async () => jsonResponse({ examples });
  analyzeHandler = async () => jsonResponse(analysis);
  tutorHandler = async (init) => {
    const body = JSON.parse(String(init?.body)) as { question: string };
    const response: TutorChatResponse = {
      requestId: analysis.requestId,
      answer:
        body.question === "这一步发生了什么？"
          ? "当前步骤建立了第一次函数调用。"
          : "递归会把规模更小的子问题继续交给同一个函数。",
      referencedSteps: body.question === "这一步发生了什么？" ? [1] : [2],
      suggestedFollowups: ["基础条件有什么作用？"],
      source: "mock",
    };
    return jsonResponse(response);
  };
  installRouteFetch();
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("CodeMotion application", () => {
  test("renders the initial mobile workbench", async () => {
    render(<App />);

    expect(screen.getByText("CodeMotion")).toBeInTheDocument();
    expect(screen.getByText("Python")).toBeInTheDocument();
    expect((screen.getByLabelText("Python 代码") as HTMLTextAreaElement).value)
      .toBe(`def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

print(fib(4))`);
    expect(screen.getByText("6 行")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "分析代码" })).toBeEnabled();
    for (const tab of ["工作台", "示例", "练习", "作品"]) {
      expect(screen.getByRole("button", { name: tab })).toBeInTheDocument();
    }
    expect(await screen.findByText("模拟服务")).toBeInTheDocument();
  });

  test("hides playback controls before code has been analyzed", () => {
    render(<App />);

    expect(screen.queryByLabelText("播放控制")).not.toBeInTheDocument();
  });

  test("restores default code and clears analysis state", async () => {
    render(<App />);
    const editor = screen.getByLabelText("Python 代码") as HTMLTextAreaElement;
    const defaultCode = editor.value;
    fireEvent.change(editor, { target: { value: "print('changed')" } });
    await analyzeCurrentCode();
    fireEvent.click(screen.getByRole("button", { name: "这一步发生了什么？" }));
    expect(await screen.findByText("当前步骤建立了第一次函数调用。"))
      .toBeInTheDocument();
    expect(screen.getByLabelText("播放控制")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "恢复默认代码" }));

    expect(editor).toHaveValue(defaultCode);
    expect(screen.queryByText(analysis.summary)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("播放控制")).not.toBeInTheDocument();
    expect(screen.queryByText("当前步骤建立了第一次函数调用。"))
      .not.toBeInTheDocument();
    expect(screen.getByText("运行分析后，这里会显示执行时间轴。"))
      .toBeInTheDocument();
  });

  test("ignores a tutor response that completes after reset", async () => {
    let resolveTutor!: (response: Response) => void;
    tutorHandler = () =>
      new Promise<Response>((resolve) => {
        resolveTutor = resolve;
      });
    const { container } = render(<App />);
    await analyzeCurrentCode();
    fireEvent.click(screen.getByRole("button", { name: "这一步发生了什么？" }));
    expect(screen.getByText("导师正在整理回答…")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "恢复默认代码" }));
    await act(async () => resolveTutor(jsonResponse({
      requestId: analysis.requestId,
      answer: "这条旧回答不应出现。",
      referencedSteps: [1],
      suggestedFollowups: [],
      source: "mock",
    })));

    expect(screen.queryByText("这条旧回答不应出现。")).not.toBeInTheDocument();
    expect(container.querySelector(".message")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("ignores a tutor error that rejects after reset", async () => {
    let rejectTutor!: (reason: Error) => void;
    tutorHandler = () =>
      new Promise<Response>((_resolve, reject) => {
        rejectTutor = reject;
      });
    const { container } = render(<App />);
    await analyzeCurrentCode();
    fireEvent.click(screen.getByRole("button", { name: "这一步发生了什么？" }));

    fireEvent.click(screen.getByRole("button", { name: "恢复默认代码" }));
    await act(async () => rejectTutor(new Error("stale tutor failure")));

    expect(container.querySelector(".message")).not.toBeInTheDocument();
    expect(screen.queryByText("导师暂时无法回答，请稍后重试。"))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("ignores an analysis response after an example is loaded", async () => {
    let resolveAnalyze!: (response: Response) => void;
    analyzeHandler = () =>
      new Promise<Response>((resolve) => {
        resolveAnalyze = resolve;
      });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "分析代码" }));
    expect(screen.getByRole("button", { name: "分析中" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "示例" }));
    expect(await screen.findByText("二分查找目标值")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "载入二分查找目标值" }));
    expect(screen.getByLabelText("Python 代码")).toHaveValue(examples[0].code);

    await act(async () => resolveAnalyze(jsonResponse(analysis)));

    expect(screen.getByLabelText("Python 代码")).toHaveValue(examples[0].code);
    expect(screen.queryByText(analysis.summary)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("播放控制")).not.toBeInTheDocument();
    expect(screen.getByText("运行分析后，这里会显示执行时间轴。"))
      .toBeInTheDocument();
  });

  test("invalidates a pending analysis success when code is edited", async () => {
    let resolveAnalyze!: (response: Response) => void;
    analyzeHandler = () =>
      new Promise<Response>((resolve) => {
        resolveAnalyze = resolve;
      });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "分析代码" }));
    fireEvent.change(screen.getByLabelText("Python 代码"), {
      target: { value: "print('edited while loading')" },
    });

    expect(screen.getByRole("button", { name: "分析代码" })).toBeEnabled();
    await act(async () => resolveAnalyze(jsonResponse(analysis)));

    expect(screen.queryByText(analysis.summary)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("播放控制")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("invalidates a pending analysis error when code is edited", async () => {
    let rejectAnalyze!: (reason: Error) => void;
    analyzeHandler = () =>
      new Promise<Response>((_resolve, reject) => {
        rejectAnalyze = reject;
      });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "分析代码" }));
    fireEvent.change(screen.getByLabelText("Python 代码"), {
      target: { value: "print('edited before failure')" },
    });

    expect(screen.getByRole("button", { name: "分析代码" })).toBeEnabled();
    await act(async () => rejectAnalyze(new Error("stale analysis failure")));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("播放控制")).not.toBeInTheDocument();
  });

  test("editing analyzed code clears visualization practice and tutor context", async () => {
    const { container } = render(<App />);
    await analyzeCurrentCode();
    fireEvent.click(screen.getByRole("button", { name: "这一步发生了什么？" }));
    expect(await screen.findByText("当前步骤建立了第一次函数调用。"))
      .toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("向导师提问"), {
      target: { value: "尚未发送的问题" },
    });

    fireEvent.change(screen.getByLabelText("Python 代码"), {
      target: { value: "print('new context')" },
    });

    expect(screen.queryByText(analysis.summary)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("播放控制")).not.toBeInTheDocument();
    expect(container.querySelector(".message")).not.toBeInTheDocument();
    expect(screen.getByLabelText("向导师提问")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "练习" }));
    expect(screen.queryByText("为递归添加记忆化")).not.toBeInTheDocument();
    expect(screen.getByText("先在工作台分析一段代码，再回来查看针对性练习。"))
      .toBeInTheDocument();
  });

  test("invalidates a pending tutor success when code is edited", async () => {
    let resolveTutor!: (response: Response) => void;
    tutorHandler = () =>
      new Promise<Response>((resolve) => {
        resolveTutor = resolve;
      });
    const { container } = render(<App />);
    await analyzeCurrentCode();
    fireEvent.click(screen.getByRole("button", { name: "这一步发生了什么？" }));

    fireEvent.change(screen.getByLabelText("Python 代码"), {
      target: { value: "print('changed during tutor')" },
    });
    await act(async () => resolveTutor(jsonResponse({
      requestId: analysis.requestId,
      answer: "这条过期导师回答不应出现。",
      referencedSteps: [1],
      suggestedFollowups: [],
      source: "mock",
    })));

    expect(container.querySelector(".message")).not.toBeInTheDocument();
    expect(screen.queryByText("这条过期导师回答不应出现。"))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("invalidates a pending tutor error when code is edited", async () => {
    let rejectTutor!: (reason: Error) => void;
    tutorHandler = () =>
      new Promise<Response>((_resolve, reject) => {
        rejectTutor = reject;
      });
    const { container } = render(<App />);
    await analyzeCurrentCode();
    fireEvent.click(screen.getByRole("button", { name: "这一步发生了什么？" }));

    fireEvent.change(screen.getByLabelText("Python 代码"), {
      target: { value: "print('changed before tutor failure')" },
    });
    await act(async () => rejectTutor(new Error("stale tutor failure")));

    expect(container.querySelector(".message")).not.toBeInTheDocument();
    expect(screen.queryByText("导师暂时无法回答，请稍后重试。"))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("loads examples and resets prior analysis when an example is selected", async () => {
    render(<App />);
    await analyzeCurrentCode();
    fireEvent.click(screen.getByRole("button", { name: "下一步" }));

    fireEvent.click(screen.getByRole("button", { name: "示例" }));
    expect(await screen.findByText("二分查找目标值")).toBeInTheDocument();
    expect(screen.getByText("二分查找 · 循环")).toBeInTheDocument();
    expect(screen.getByText("初级")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "载入二分查找目标值" }));

    expect(screen.getByLabelText("Python 代码")).toHaveValue(examples[0].code);
    expect(screen.getByRole("button", { name: "分析代码" })).toBeInTheDocument();
    expect(screen.queryByText(analysis.summary)).not.toBeInTheDocument();
    expect(screen.getByText("运行分析后，这里会显示执行时间轴。"))
      .toBeInTheDocument();
  });

  test("analyzes through the real client and renders analysis details", async () => {
    let resolveAnalyze!: (response: Response) => void;
    analyzeHandler = () =>
      new Promise<Response>((resolve) => {
        resolveAnalyze = resolve;
      });
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "分析代码" }));
    expect(screen.getByRole("button", { name: "分析中" })).toBeDisabled();
    await act(async () => resolveAnalyze(jsonResponse(analysis)));

    expect(await screen.findByText(analysis.summary)).toBeInTheDocument();
    expect(screen.getByText("模拟分析")).toBeInTheDocument();
    expect(screen.getByText("当前使用本地模拟分析。")).toBeInTheDocument();
    expect(screen.getByText("第 1 / 3 步")).toBeInTheDocument();
    expect(screen.getByText("准备调用 fibonacci(3)。")).toBeInTheDocument();
    expect(screen.getByText("def fibonacci(n):")).toHaveClass("is-active");
    expect(screen.getByText("n = 3")).toHaveAttribute("data-changed", "true");
    expect(screen.getByLabelText("播放控制")).toBeInTheDocument();
  });

  test("navigates trace data, preserves the step across views, and stops autoplay", async () => {
    render(<App />);
    await analyzeCurrentCode();

    fireEvent.click(screen.getByRole("button", { name: "下一步" }));
    expect(screen.getByText("进入 fibonacci(2)。")).toBeInTheDocument();
    expect(screen.getByText('branch = "left"')).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "调用栈" }));
    expect(screen.getByText("第 2 / 3 步")).toBeInTheDocument();
    expect(screen.getByText("等待")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "递归树" }));
    expect(screen.getByText("第 2 / 3 步")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "跳转到 fib(3) 的进入步骤" }))
      .toBeInTheDocument();

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "开始播放" }));
    expect(screen.getByRole("button", { name: "暂停播放" })).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(900));
    expect(screen.getByText("第 3 / 3 步")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "开始播放" })).toBeDisabled();
  });

  test("derives recursion tree status and return values from the current step", async () => {
    render(<App />);
    await analyzeCurrentCode();
    fireEvent.click(screen.getByRole("button", { name: "递归树" }));

    const root = screen.getByRole("button", { name: "跳转到 fib(3) 的进入步骤" });
    const child = screen.getByRole("button", { name: "跳转到 fib(2) 的进入步骤" });
    const leaf = screen.getByRole("button", { name: "跳转到 fib(1) 的进入步骤" });
    expect(root).toHaveTextContent("执行中");
    expect(child).toHaveTextContent("等待");
    expect(leaf).toHaveTextContent("等待");
    expect(leaf).not.toHaveTextContent("返回 1");

    fireEvent.click(screen.getByRole("button", { name: "下一步" }));
    expect(root).toHaveTextContent("等待");
    expect(child).toHaveTextContent("执行中");
    expect(leaf).toHaveTextContent("等待");

    fireEvent.click(screen.getByRole("button", { name: "下一步" }));
    expect(root).toHaveTextContent("等待");
    expect(child).toHaveTextContent("等待");
    expect(leaf).toHaveTextContent("返回 1");
  });

  test("sends quick and typed tutor questions and exposes referenced steps", async () => {
    render(<App />);
    await analyzeCurrentCode();

    fireEvent.click(screen.getByRole("button", { name: "这一步发生了什么？" }));
    expect(await screen.findByText("当前步骤建立了第一次函数调用。"))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "转到第 1 步" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("向导师提问"), {
      target: { value: "为什么会递归？" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送问题" }));
    expect(screen.getByText("为什么会递归？")).toBeInTheDocument();
    expect(await screen.findByText("递归会把规模更小的子问题继续交给同一个函数。"))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "转到第 2 步" })).toBeInTheDocument();
  });

  test("shows analysis recommendations in practice and preserves editor code", async () => {
    render(<App />);
    const editor = screen.getByLabelText("Python 代码");
    fireEvent.change(editor, { target: { value: "print('keep me')" } });
    await analyzeCurrentCode();

    fireEvent.click(screen.getByRole("button", { name: "练习" }));
    expect(screen.getByText("为递归添加记忆化")).toBeInTheDocument();
    expect(screen.getByText("中级")).toBeInTheDocument();
    expect(screen.getByText("减少重复子问题计算。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "带着当前代码回到工作台" }));
    expect(screen.getByLabelText("Python 代码")).toHaveValue("print('keep me')");
  });

  test("renders a recoverable analyze error without exposing provider details", async () => {
    analyzeHandler = async () =>
      jsonResponse(
        { error: { message: "provider stack: secret upstream failure" } },
        { status: 502 },
      );
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "分析代码" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "分析暂时失败，请稍后重试。",
    );
    expect(screen.queryByText(/provider stack|secret upstream/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新分析" })).toBeEnabled();
  });

  test("blocks empty and oversized code before calling the analysis API", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn<typeof fetch>>;
    render(<App />);
    const editor = screen.getByLabelText("Python 代码");

    fireEvent.change(editor, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "分析代码" }));
    expect(screen.getByRole("alert")).toHaveTextContent("请输入 Python 代码。");

    fireEvent.change(editor, { target: { value: "x\n".repeat(201) } });
    fireEvent.click(screen.getByRole("button", { name: "分析代码" }));
    expect(screen.getByRole("alert")).toHaveTextContent("代码不能超过 200 行");
    expect(
      fetchMock.mock.calls.filter(([input]) => input === "/api/analyze-code"),
    ).toHaveLength(0);
  });

  test("announces service checks example loading and completed analysis politely", async () => {
    let resolveHealth!: (response: Response) => void;
    let resolveExamples!: (response: Response) => void;
    healthHandler = () =>
      new Promise<Response>((resolve) => {
        resolveHealth = resolve;
      });
    examplesHandler = () =>
      new Promise<Response>((resolve) => {
        resolveExamples = resolve;
      });
    render(<App />);

    expect(screen.getByRole("status", { name: "服务状态：服务检查中" }))
      .toHaveAttribute("aria-live", "polite");
    fireEvent.click(screen.getByRole("button", { name: "示例" }));
    expect(screen.getByRole("status", { name: "正在载入示例…" }))
      .toHaveAttribute("aria-live", "polite");
    await act(async () => {
      resolveHealth(jsonResponse(health));
      resolveExamples(jsonResponse({ examples }));
    });

    fireEvent.click(screen.getByRole("button", { name: "工作台" }));
    await analyzeCurrentCode();
    expect(screen.getByRole("status", { name: "分析完成：斐波那契递归" }))
      .toHaveAttribute("aria-live", "polite");
  });

  test("provides meaningful empty and offline states", async () => {
    healthHandler = async () => Promise.reject(new Error("raw health failure"));
    examplesHandler = async () => Promise.reject(new Error("raw examples failure"));
    render(<App />);

    expect(screen.getByText("运行分析后，这里会显示执行时间轴。"))
      .toBeInTheDocument();
    expect(await screen.findByText("服务离线")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "示例" }));
    expect(await screen.findByText("暂无可用示例，可继续使用工作台中的默认代码。"))
      .toBeInTheDocument();
    expect(screen.queryByText(/raw health|raw examples/i)).not.toBeInTheDocument();
  });
});
