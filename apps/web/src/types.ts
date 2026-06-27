export type PrimitiveValue = string | number | boolean | null;
export type Source = "lanxin" | "mock" | "fallback";
export type ActiveTab = "workbench" | "examples" | "practice" | "about";
export type ActiveView = "timeline" | "stack" | "recursion";
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type LineRole =
  | "input"
  | "condition"
  | "loop"
  | "recursive-call"
  | "return"
  | "state-update"
  | "output"
  | "other";
export type TraceEvent =
  | "start"
  | "assign"
  | "condition"
  | "call"
  | "return"
  | "loop"
  | "push"
  | "pop"
  | "output"
  | "end";
export type StackFrameStatus = "active" | "waiting" | "returned";
export type RecursionNodeStatus = "pending" | "active" | "returned";
export type AnalysisWarningCode =
  | "CODE_TOO_LONG"
  | "UNSUPPORTED_LANGUAGE"
  | "TRACE_PARTIAL"
  | "MODEL_FORMAT_REPAIRED"
  | "VISUALIZATION_LIMITED"
  | "MOCK_USED";

export interface CodeExample {
  id: string;
  title: string;
  category: "recursion" | "binary-search" | "stack" | "dfs" | "dp";
  difficulty: Difficulty;
  concepts: string[];
  code: string;
  stdin?: string;
  expectedVisualization: Array<
    "timeline" | "stack" | "recursion-tree" | "variables"
  >;
}

export interface CodeAnalyzeRequest {
  language: "python";
  code: string;
  stdin?: string;
  visualizationFocus?: "auto" | "recursion" | "stack" | "variables" | "dp";
  userLevel?: "beginner" | "intermediate";
}

export interface LineExplanation {
  line: number;
  code: string;
  explanation: string;
  role: LineRole;
}

export interface TraceStep {
  step: number;
  line: number;
  event: TraceEvent;
  description: string;
  variables: Record<string, PrimitiveValue>;
  changedVariables: string[];
  stdout?: string;
  activeFrameId?: string;
  activeRecursionNodeId?: string;
}

export interface StackFrame {
  id: string;
  functionName: string;
  line: number;
  params: Record<string, PrimitiveValue>;
  locals: Record<string, PrimitiveValue>;
  status: StackFrameStatus;
  returnValue?: PrimitiveValue;
}

export interface StackFrameSnapshot {
  step: number;
  frames: StackFrame[];
}

export interface RecursionNode {
  id: string;
  label: string;
  functionName: string;
  args: Record<string, PrimitiveValue>;
  status: RecursionNodeStatus;
  returnValue?: PrimitiveValue;
  enterStep: number;
  exitStep?: number;
}

export interface RecursionTree {
  rootId: string;
  nodes: RecursionNode[];
  edges: Array<{
    from: string;
    to: string;
    label?: string;
  }>;
}

export interface PracticeRecommendation {
  id: string;
  title: string;
  difficulty: Difficulty;
  concepts: string[];
  reason: string;
  visualizationHint: string;
  starterPrompt?: string;
}

export interface AnalysisWarning {
  code: AnalysisWarningCode;
  message: string;
}

export interface CodeAnalyzeResponse {
  requestId: string;
  language: "python";
  title: string;
  summary: string;
  detectedConcepts: string[];
  complexity: {
    time: string;
    space: string;
    explanation: string;
  };
  lineExplanations: LineExplanation[];
  traceSteps: TraceStep[];
  stackFrames: StackFrameSnapshot[];
  recursionTree?: RecursionTree;
  recommendations: PracticeRecommendation[];
  warnings: AnalysisWarning[];
  source: Source;
}

export interface TutorMessage {
  role: "user" | "assistant";
  content: string;
  referencedSteps?: number[];
}

export interface TutorChatRequest {
  requestId: string;
  code: string;
  currentStep?: number;
  analysisSummary: string;
  question: string;
}

export interface TutorChatResponse {
  requestId: string;
  answer: string;
  referencedSteps: number[];
  suggestedFollowups: string[];
  source: Source;
}

export interface HealthResponse {
  ok: boolean;
  service: string;
  llmMode: "mock" | "real";
  version: string;
}
