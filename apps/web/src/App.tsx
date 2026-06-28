import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Bot,
  Braces,
  ChevronLeft,
  ChevronRight,
  CirclePlay,
  Code2,
  Dumbbell,
  FolderOpen,
  Layers3,
  LoaderCircle,
  MessageCircleQuestion,
  Network,
  Pause,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  TerminalSquare,
  Waypoints,
} from "lucide-react";

import { analyzeCode, askTutor, fetchExamples, fetchHealth } from "./api";
import {
  getCurrentStackFrames,
  getCurrentTraceStep,
  nextStepIndex,
  previousStepIndex,
} from "./playback";
import type {
  ActiveTab,
  ActiveView,
  CodeAnalyzeResponse,
  CodeExample,
  PracticeRecommendation,
  PrimitiveValue,
  RecursionNode,
  TutorMessage,
} from "./types";

const DEFAULT_CODE = `def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

print(fibonacci(6))`;

type ServiceStatus = "checking" | "mock" | "real" | "offline";
type Speed = 0.5 | 1 | 1.5;

const difficultyLabels = {
  beginner: "初级",
  intermediate: "中级",
  advanced: "进阶",
};

const sourceLabels = {
  mock: "模拟分析",
  lanxin: "蓝心分析",
  fallback: "降级分析",
};

const categoryLabels: Record<CodeExample["category"], string> = {
  recursion: "递归",
  "binary-search": "二分查找",
  stack: "栈",
  dfs: "深度优先搜索",
  dp: "动态规划",
};

const visualizationLabels: Record<CodeExample["expectedVisualization"][number], string> = {
  timeline: "时间轴",
  stack: "调用栈",
  "recursion-tree": "递归树",
  variables: "变量",
};

function formatValue(value: PrimitiveValue): string {
  if (typeof value === "string") return `"${value}"`;
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  return String(value);
}

function KeyValues({ values }: { values: Record<string, PrimitiveValue> }) {
  const entries = Object.entries(values);
  if (entries.length === 0) return <span className="muted">无</span>;
  return (
    <span className="inline-values">
      {entries.map(([key, value]) => `${key}=${formatValue(value)}`).join(", ")}
    </span>
  );
}

function ServiceBadge({ status }: { status: ServiceStatus }) {
  const labels = {
    checking: "服务检查中",
    mock: "模拟服务",
    real: "真实服务",
    offline: "服务离线",
  };
  return <span className={`service-badge status-${status}`}>{labels[status]}</span>;
}

interface CodeEditorProps {
  code: string;
  loading: boolean;
  error?: string;
  onChange: (code: string) => void;
  onAnalyze: () => void;
  onReset: () => void;
}

function CodeEditor(props: CodeEditorProps) {
  const lineCount = props.code.split("\n").length;
  return (
    <section className="tool-panel code-panel" aria-labelledby="editor-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">代码输入</p>
          <h2 id="editor-title">Python 编辑器</h2>
        </div>
        <span className="line-count">{lineCount} 行</span>
      </div>
      <textarea
        aria-label="Python 代码"
        className="code-editor"
        value={props.code}
        onChange={(event) => props.onChange(event.target.value)}
        spellCheck={false}
      />
      {props.error && <p className="inline-error" role="alert">{props.error}</p>}
      <div className="editor-actions">
        <button className="secondary-command" type="button" onClick={props.onReset} disabled={props.loading} aria-label="恢复默认代码" title="恢复默认代码">
          <RotateCcw aria-hidden="true" /><span>恢复默认代码</span>
        </button>
        <button
          className="primary-command"
          type="button"
          onClick={props.onAnalyze}
          disabled={props.loading}
          aria-label={props.loading ? "分析中" : props.error?.startsWith("分析暂时") ? "重新分析" : "分析代码"}
        >
          {props.loading ? <LoaderCircle className="spin" aria-hidden="true" /> : props.error?.startsWith("分析暂时") ? <RotateCcw aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
          <span>{props.loading ? "分析中" : props.error?.startsWith("分析暂时") ? "重新分析" : "分析代码"}</span>
        </button>
      </div>
    </section>
  );
}

interface TimelineViewProps {
  analysis?: CodeAnalyzeResponse;
  stepIndex: number;
}

function TimelineView({ analysis, stepIndex }: TimelineViewProps) {
  if (!analysis) return <EmptyState text="运行分析后，这里会显示执行时间轴。" />;
  const step = getCurrentTraceStep(stepIndex, analysis);
  if (!step) return <EmptyState text="本次分析没有可播放的执行步骤。" />;
  return (
    <div className="timeline-layout">
      <ol className="code-lines" aria-label="代码行解释">
        {analysis.lineExplanations.map((item) => (
          <li key={`${item.line}-${item.code}`} className={item.line === step.line ? "is-active" : ""}>
            <span className="line-number">{item.line}</span>
            <div><code className={item.line === step.line ? "is-active" : ""}>{item.code}</code><p>{item.explanation}</p></div>
          </li>
        ))}
      </ol>
      <div className="step-detail">
        <strong>{step.description}</strong>
        <div className="variable-grid" aria-label="当前变量">
          {Object.entries(step.variables).map(([key, value]) => (
            <code key={key} data-changed={step.changedVariables.includes(key)}>{key} = {formatValue(value)}</code>
          ))}
          {Object.keys(step.variables).length === 0 && <span className="muted">当前没有变量</span>}
        </div>
        {step.stdout && <pre className="stdout"><span>输出</span>{step.stdout}</pre>}
      </div>
    </div>
  );
}

function StackView({ analysis, stepIndex }: TimelineViewProps) {
  if (!analysis) return <EmptyState text="分析代码后，可在这里检查调用栈。" />;
  const frames = getCurrentStackFrames(stepIndex, analysis);
  if (frames.length === 0) return <EmptyState text="当前步骤没有调用栈帧。" />;
  const statusLabels = { active: "执行中", waiting: "等待", returned: "已返回" };
  return (
    <ol className="stack-list" aria-label="调用栈，按调用顺序排列">
      {frames.map((frame, index) => (
        <li key={frame.id} className={`stack-frame frame-${frame.status}`}>
          <div className="frame-title"><span>#{index + 1} {frame.functionName}</span><em>{statusLabels[frame.status]}</em></div>
          <p>参数 <KeyValues values={frame.params} /></p>
          <p>局部变量 <KeyValues values={frame.locals} /></p>
          {frame.returnValue !== undefined && <p>返回值 <code>{formatValue(frame.returnValue)}</code></p>}
        </li>
      ))}
    </ol>
  );
}

function getTreeDepths(nodes: RecursionNode[], edges: Array<{ from: string; to: string }>, rootId: string) {
  const depths = new Map<string, number>([[rootId, 0]]);
  const visit = (parent: string, depth: number) => {
    edges.filter((edge) => edge.from === parent).forEach((edge) => {
      if (!depths.has(edge.to)) { depths.set(edge.to, depth); visit(edge.to, depth + 1); }
    });
  };
  visit(rootId, 1);
  nodes.forEach((node) => { if (!depths.has(node.id)) depths.set(node.id, 0); });
  return depths;
}

interface TreeViewProps extends TimelineViewProps {
  onJump: (step: number) => void;
}

function TreeView({ analysis, stepIndex, onJump }: TreeViewProps) {
  const tree = analysis?.recursionTree;
  if (!tree || tree.nodes.length === 0) return <EmptyState text="这段代码没有识别到递归调用树。" />;
  const activeNode = getCurrentTraceStep(stepIndex, analysis)?.activeRecursionNodeId;
  const depths = getTreeDepths(tree.nodes, tree.edges, tree.rootId);
  return (
    <div className="tree-view" aria-label="递归调用树">
      {tree.nodes.map((node) => (
        <div key={node.id} className={`tree-row ${node.id === activeNode ? "is-active" : ""}`} style={{ "--tree-depth": depths.get(node.id) ?? 0 } as React.CSSProperties}>
          <span className="tree-branch" aria-hidden="true">{depths.get(node.id) ? "└" : "●"}</span>
          <button type="button" onClick={() => onJump(node.enterStep)} aria-label={`跳转到 ${node.label} 的进入步骤`}>
            <strong>{node.label}</strong><span>{node.status === "returned" ? `返回 ${formatValue(node.returnValue ?? null)}` : node.status === "active" ? "执行中" : "等待"}</span>
          </button>
          <small>参数 <KeyValues values={node.args} /></small>
        </div>
      ))}
      <div className="edge-summary">连接：{tree.edges.map((edge) => `${edge.from} → ${edge.to}${edge.label ? ` (${edge.label})` : ""}`).join("；")}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state"><CirclePlay aria-hidden="true" /><p>{text}</p></div>;
}

interface VisualizerProps {
  analysis?: CodeAnalyzeResponse;
  view: ActiveView;
  stepIndex: number;
  onViewChange: (view: ActiveView) => void;
  onJump: (step: number) => void;
}

function Visualizer(props: VisualizerProps) {
  const views: Array<{ id: ActiveView; label: string; icon: typeof Waypoints }> = [
    { id: "timeline", label: "时间轴", icon: Waypoints },
    { id: "stack", label: "调用栈", icon: Layers3 },
    { id: "recursion", label: "递归树", icon: Network },
  ];
  return (
    <section className="tool-panel visualizer-panel" aria-labelledby="visualizer-title">
      <div className="panel-heading"><div><p className="eyebrow">执行可视化</p><h2 id="visualizer-title">代码如何运行</h2></div></div>
      <div className="segmented" role="group" aria-label="可视化视图">
        {views.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={props.view === id} onClick={() => props.onViewChange(id)}><Icon aria-hidden="true" />{label}</button>)}
      </div>
      <div className="visualizer-content">
        {props.view === "timeline" && <TimelineView analysis={props.analysis} stepIndex={props.stepIndex} />}
        {props.view === "stack" && <StackView analysis={props.analysis} stepIndex={props.stepIndex} />}
        {props.view === "recursion" && <TreeView analysis={props.analysis} stepIndex={props.stepIndex} onJump={props.onJump} />}
      </div>
    </section>
  );
}

interface TutorPanelProps {
  messages: TutorMessage[];
  question: string;
  loading: boolean;
  error?: string;
  disabled: boolean;
  onQuestionChange: (question: string) => void;
  onSend: (question?: string) => void;
  onStepClick: (step: number) => void;
}

function TutorPanel(props: TutorPanelProps) {
  return (
    <section className="tutor-panel" aria-labelledby="tutor-title">
      <div className="panel-heading"><div><p className="eyebrow">AI 导师</p><h2 id="tutor-title">理解当前步骤</h2></div><Bot aria-hidden="true" /></div>
      <div className="quick-questions"><button type="button" disabled={props.disabled || props.loading} onClick={() => props.onSend("这一步发生了什么？")}>这一步发生了什么？</button><button type="button" disabled={props.disabled || props.loading} onClick={() => props.onSend("变量为什么这样变化？")}>变量为什么这样变化？</button></div>
      <div className="message-list" aria-live="polite">
        {props.messages.length === 0 && <p className="muted">完成一次分析后，可以围绕当前步骤提问。</p>}
        {props.messages.map((message, index) => <div key={`${message.role}-${index}`} className={`message message-${message.role}`}><span>{message.role === "user" ? "你" : "导师"}</span><p>{message.content}</p>{message.referencedSteps?.map((step) => <button key={step} type="button" aria-label={`转到第 ${step} 步`} onClick={() => props.onStepClick(step)}>步骤 {step}</button>)}</div>)}
        {props.loading && <p className="loading-state"><LoaderCircle className="spin" aria-hidden="true" />导师正在整理回答…</p>}
      </div>
      {props.error && <p className="inline-error" role="alert">{props.error}</p>}
      <div className="tutor-input"><input aria-label="向导师提问" maxLength={500} value={props.question} disabled={props.disabled || props.loading} onChange={(event) => props.onQuestionChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") props.onSend(); }} placeholder="输入关于代码的问题" /><button type="button" aria-label="发送问题" title="发送问题" disabled={props.disabled || props.loading || !props.question.trim()} onClick={() => props.onSend()}><Send aria-hidden="true" /></button></div>
    </section>
  );
}

interface ExamplesProps { examples: CodeExample[]; loading: boolean; onSelect: (example: CodeExample) => void }

function Examples({ examples, loading, onSelect }: ExamplesProps) {
  if (loading) return <PageState icon={LoaderCircle} text="正在载入示例…" spinning />;
  if (examples.length === 0) return <PageState icon={BookOpen} text="暂无可用示例，可继续使用工作台中的默认代码。" />;
  return <section className="page-section"><PageTitle eyebrow="示例库" title="从经典算法开始" description="载入代码后直接回到工作台观察执行过程。" /><div className="item-grid">{examples.map((example) => <article className="item-card" key={example.id}><div className="item-meta"><span>{difficultyLabels[example.difficulty]}</span><span>{categoryLabels[example.category]}</span></div><h2>{example.title}</h2><p>{example.concepts.join(" · ")}</p><small>推荐视图：{example.expectedVisualization.map((item) => visualizationLabels[item]).join(" / ")}</small><button type="button" onClick={() => onSelect(example)} aria-label={`载入${example.title}`}><Code2 aria-hidden="true" />载入示例</button></article>)}</div></section>;
}

function Practice({ recommendations, onReturn }: { recommendations: PracticeRecommendation[]; onReturn: () => void }) {
  return <section className="page-section"><PageTitle eyebrow="练习建议" title="继续巩固当前概念" description={recommendations.length ? "建议根据最近一次分析生成。" : "完成分析后会提供更匹配的练习。"} />{recommendations.length === 0 ? <div className="practice-empty"><Dumbbell aria-hidden="true" /><p>先在工作台分析一段代码，再回来查看针对性练习。</p><button type="button" onClick={onReturn}>返回工作台</button></div> : <div className="item-grid">{recommendations.map((item) => <article className="item-card" key={item.id}><div className="item-meta"><span>{difficultyLabels[item.difficulty]}</span><span>{item.concepts.join(" · ")}</span></div><h2>{item.title}</h2><p>{item.reason}</p><small>{item.visualizationHint}</small><button type="button" onClick={onReturn} aria-label="带着当前代码回到工作台"><ChevronLeft aria-hidden="true" />回到工作台</button></article>)}</div>}</section>;
}

function PageTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="page-title"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></header>;
}

function PageState({ icon: Icon, text, spinning = false }: { icon: typeof BookOpen; text: string; spinning?: boolean }) {
  return <div className="page-state"><Icon className={spinning ? "spin" : ""} aria-hidden="true" /><p>{text}</p></div>;
}

function About({ service }: { service: ServiceStatus }) {
  return <section className="page-section"><PageTitle eyebrow="作品说明" title="CodeMotion" description="把 Python 执行过程转成可操作的时间轴、调用栈和递归树。" /><div className="about-grid"><div><TerminalSquare aria-hidden="true" /><h2>交付范围</h2><p>移动优先 Web 工作台，覆盖代码分析、播放控制、示例、练习和导师问答。</p></div><div><Braces aria-hidden="true" /><h2>服务路径</h2><p>Web 通过 /api 路由访问后端，前端不保存服务凭据。</p></div><div><MessageCircleQuestion aria-hidden="true" /><h2>分析适配器</h2><p>{service === "real" ? "当前连接真实蓝心适配器。" : service === "mock" ? "当前使用可演示的模拟适配器。" : "适配器当前不可用，编辑器仍可离线使用。"}</p></div></div></section>;
}

interface PlaybackProps { analysis?: CodeAnalyzeResponse; index: number; playing: boolean; speed: Speed; onPrevious: () => void; onToggle: () => void; onNext: () => void; onSpeed: (speed: Speed) => void }

function PlaybackControls(props: PlaybackProps) {
  const total = props.analysis?.traceSteps.length ?? 0;
  const atStart = !total || props.index <= 0;
  const atEnd = !total || props.index >= total - 1;
  return <div className="playback" aria-label="播放控制"><button type="button" aria-label="上一步" title="上一步" disabled={atStart} onClick={props.onPrevious}><ChevronLeft aria-hidden="true" /></button><button className="play-toggle" type="button" aria-label={props.playing ? "暂停播放" : "开始播放"} title={props.playing ? "暂停播放" : "开始播放"} disabled={!total || (atEnd && !props.playing)} onClick={props.onToggle}>{props.playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}</button><button type="button" aria-label="下一步" title="下一步" disabled={atEnd} onClick={props.onNext}><ChevronRight aria-hidden="true" /></button><span className="progress-text">{total ? `第 ${props.index + 1} / ${total} 步` : "等待分析"}</span><label>速度<select value={props.speed} onChange={(event) => props.onSpeed(Number(event.target.value) as Speed)}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={1.5}>1.5×</option></select></label></div>;
}

function BottomNavigation({ active, onChange }: { active: ActiveTab; onChange: (tab: ActiveTab) => void }) {
  const tabs: Array<{ id: ActiveTab; label: string; icon: typeof Code2 }> = [{ id: "workbench", label: "工作台", icon: Code2 }, { id: "examples", label: "示例", icon: BookOpen }, { id: "practice", label: "练习", icon: Dumbbell }, { id: "about", label: "作品", icon: FolderOpen }];
  return <nav className="bottom-nav" aria-label="主要导航">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={active === id ? "page" : undefined} onClick={() => onChange(id)}><Icon aria-hidden="true" /><span>{label}</span></button>)}</nav>;
}

function AnalysisSummary({ analysis }: { analysis: CodeAnalyzeResponse }) {
  return <section className="analysis-summary"><div><span className={`source source-${analysis.source}`}>{sourceLabels[analysis.source]}</span><h1>{analysis.title}</h1><p>{analysis.summary}</p></div><dl><div><dt>时间</dt><dd>{analysis.complexity.time}</dd></div><div><dt>空间</dt><dd>{analysis.complexity.space}</dd></div></dl>{analysis.warnings.map((warning) => <p className="warning" key={`${warning.code}-${warning.message}`}><AlertTriangle aria-hidden="true" />{warning.message}</p>)}</section>;
}

export default function App() {
  const [tab, setTab] = useState<ActiveTab>("workbench");
  const [view, setView] = useState<ActiveView>("timeline");
  const [code, setCode] = useState(DEFAULT_CODE);
  const [examples, setExamples] = useState<CodeExample[]>([]);
  const [examplesLoading, setExamplesLoading] = useState(true);
  const [analysis, setAnalysis] = useState<CodeAnalyzeResponse>();
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [service, setService] = useState<ServiceStatus>("checking");
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string>();
  const [tutorLoading, setTutorLoading] = useState(false);
  const [tutorError, setTutorError] = useState<string>();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const analysisGeneration = useRef(0);
  const tutorGeneration = useRef(0);

  useEffect(() => {
    let active = true;
    fetchHealth().then((result) => { if (active) setService(result.ok ? result.llmMode : "offline"); }).catch(() => { if (active) setService("offline"); });
    fetchExamples().then((result) => { if (active) setExamples(result); }).catch(() => { if (active) setExamples([]); }).finally(() => { if (active) setExamplesLoading(false); });
    return () => {
      active = false;
      analysisGeneration.current += 1;
      tutorGeneration.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!playing || !analysis) return;
    if (currentStep >= analysis.traceSteps.length - 1) { setPlaying(false); return; }
    const timer = window.setTimeout(() => setCurrentStep((index) => nextStepIndex(index, analysis)), 900 / speed);
    return () => window.clearTimeout(timer);
  }, [analysis, currentStep, playing, speed]);

  const recommendations = useMemo(() => analysis?.recommendations ?? [], [analysis]);

  async function runAnalyze() {
    const trimmed = code.trim();
    if (!trimmed) { setAnalysisError("请输入 Python 代码。"); return; }
    if (code.length > 12000) { setAnalysisError("代码不能超过 12000 个字符。"); return; }
    if (code.split("\n").length > 200) { setAnalysisError("代码不能超过 200 行。"); return; }
    const generation = ++analysisGeneration.current;
    setAnalysisLoading(true); setAnalysisError(undefined); setPlaying(false);
    try {
      const result = await analyzeCode(code);
      if (generation !== analysisGeneration.current) return;
      tutorGeneration.current += 1;
      setAnalysis(result); setCurrentStep(0); setView("timeline"); setMessages([]); setTutorLoading(false); setTutorError(undefined); setQuestion("");
    } catch {
      if (generation === analysisGeneration.current) setAnalysisError("分析暂时失败，请稍后重试。");
    } finally {
      if (generation === analysisGeneration.current) setAnalysisLoading(false);
    }
  }

  async function sendTutor(prompt = question) {
    const normalized = prompt.trim();
    if (!analysis || tutorLoading || !normalized) return;
    if (normalized.length > 500) { setTutorError("问题不能超过 500 个字符。"); return; }
    const generation = ++tutorGeneration.current;
    const userMessage: TutorMessage = { role: "user", content: normalized };
    setMessages((items) => [...items, userMessage]); setTutorLoading(true); setTutorError(undefined); setQuestion("");
    try {
      const response = await askTutor({ requestId: analysis.requestId, code, currentStep: getCurrentTraceStep(currentStep, analysis)?.step, analysisSummary: analysis.summary, question: normalized });
      if (generation !== tutorGeneration.current) return;
      setMessages((items) => [...items, { role: "assistant", content: response.answer, referencedSteps: response.referencedSteps }]);
    } catch {
      if (generation === tutorGeneration.current) setTutorError("导师暂时无法回答，请稍后重试。");
    } finally {
      if (generation === tutorGeneration.current) setTutorLoading(false);
    }
  }

  function selectExample(example: CodeExample) {
    analysisGeneration.current += 1; tutorGeneration.current += 1;
    setCode(example.code); setAnalysis(undefined); setCurrentStep(0); setPlaying(false); setMessages([]); setAnalysisLoading(false); setAnalysisError(undefined); setTutorLoading(false); setTutorError(undefined); setTab("workbench"); setView("timeline");
  }

  function resetWorkbench() {
    analysisGeneration.current += 1; tutorGeneration.current += 1;
    setCode(DEFAULT_CODE); setAnalysis(undefined); setCurrentStep(0); setPlaying(false); setSpeed(1); setView("timeline"); setMessages([]); setAnalysisLoading(false); setAnalysisError(undefined); setTutorError(undefined); setTutorLoading(false); setQuestion("");
  }

  function jumpToStep(step: number) {
    if (!analysis) return;
    const index = analysis.traceSteps.findIndex((item) => item.step === step);
    if (index >= 0) { setCurrentStep(index); setPlaying(false); }
  }

  return (
    <div className={`app-shell${analysis ? " has-playback" : ""}`}>
      <header className="topbar"><div className="brand"><span className="brand-mark"><Code2 aria-hidden="true" /></span><div><strong>CodeMotion</strong><span>Python 执行实验室</span></div></div><div className="topbar-status"><span className="language-tag">Python</span><ServiceBadge status={service} /></div></header>
      <main>
        {tab === "workbench" && <>{analysis && <AnalysisSummary analysis={analysis} />}<div className="workbench-grid"><CodeEditor code={code} loading={analysisLoading} error={analysisError} onChange={(value) => { setCode(value); setAnalysisError(undefined); }} onAnalyze={runAnalyze} onReset={resetWorkbench} /><Visualizer analysis={analysis} view={view} stepIndex={currentStep} onViewChange={setView} onJump={jumpToStep} /><TutorPanel messages={messages} question={question} loading={tutorLoading} error={tutorError} disabled={!analysis} onQuestionChange={setQuestion} onSend={sendTutor} onStepClick={jumpToStep} /></div></>}
        {tab === "examples" && <Examples examples={examples} loading={examplesLoading} onSelect={selectExample} />}
        {tab === "practice" && <Practice recommendations={recommendations} onReturn={() => setTab("workbench")} />}
        {tab === "about" && <About service={service} />}
      </main>
      {analysis && <PlaybackControls analysis={analysis} index={currentStep} playing={playing} speed={speed} onPrevious={() => { setCurrentStep((index) => previousStepIndex(index, analysis)); setPlaying(false); }} onToggle={() => setPlaying((value) => !value)} onNext={() => { setCurrentStep((index) => nextStepIndex(index, analysis)); setPlaying(false); }} onSpeed={setSpeed} />}
      <BottomNavigation active={tab} onChange={setTab} />
    </div>
  );
}
