export type PrimitiveValue = string | number | boolean | null;

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
  role:
    | "input"
    | "condition"
    | "loop"
    | "recursive-call"
    | "return"
    | "state-update"
    | "output"
    | "other";
}

export interface TraceStep {
  step: number;
  line: number;
  event:
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
  status: "active" | "waiting" | "returned";
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
  status: "pending" | "active" | "returned";
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
  difficulty: "beginner" | "intermediate" | "advanced";
  concepts: string[];
  reason: string;
  visualizationHint: string;
  starterPrompt?: string;
}

export interface AnalysisWarning {
  code:
    | "CODE_TOO_LONG"
    | "UNSUPPORTED_LANGUAGE"
    | "TRACE_PARTIAL"
    | "MODEL_FORMAT_REPAIRED"
    | "VISUALIZATION_LIMITED"
    | "MOCK_USED";
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
  source: "lanxin" | "mock" | "fallback";
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
  source: "lanxin" | "mock" | "fallback";
}
