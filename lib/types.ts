// Shared types for SSE streaming pipeline and chat messages

export type Intent = "work_authorization" | "visa_status" | "asylum" | 
                     "enforcement" | "family" | "naturalization" | "other"

export interface Message {
    id: string,
    role: "user" | "assistant",
    content: string,
    triage?: TriageResult,
    feedback?: FeedbackResult,
    loading?: boolean,
    reasoningSteps?: {
        type: "section" | "tool",
        label: string,
        detail?: string
    }[],
    sectionContent?: Record<string, string>
}

export interface ToolActivityEvent {
    type: "tool_activity",
    data: {
        tool: string,
        status: "started" | "completed",
        query?: string
    }
}

export interface SectionEvent {
    type: "section",
    data: {
        name: "Analyzing your question..." | "Researching sources..." | "Applying to your situation..." | "Evaluating confidence..." | "Answering..."
    }
}

export interface TriageResult {
    intent: Intent,
    facts: {
        visa_type?: string,
        status?: string,
        dates?: string,
        employer?: string,
        family?: string,
        state?: string,
        country_of_origin?: string,
    },
    complexity: "simple" | "moderate" | "complex",
    summary: string,
}

export interface FollowUpQuestion {
    question: string,
    options: string[] | null,
}

export interface FeedbackResult {
    gaps: string[],
    follow_up_questions: FollowUpQuestion[],
    next_steps: string[],
    needs_attorney: boolean,
}

export interface TriageEvent {
    type: "triage",
    data: TriageResult
}

export interface ReasoningStepEvent {
    type: "reasoning_step",
    data: {
        step: "Analyzing your question..." | "Researching sources..." | "Applying to your situation..." | "Evaluating confidence..." | "Answering...",
        content: string,
    },
}

export interface ContentEvent {
    type: "content",
    data: {
        text: string,
        section?: string,
    },
}

export interface CitationEvent {
    type: "citation",
    data: {
        index: number,
        url: string,
        title: string,
    },
}

export interface FeedbackEvent {
    type: "feedback"
    data: FeedbackResult,
}

export interface ErrorEvent {
    type: "error",
    data: {message:string},
}

export interface DoneEvent {
    type: "done",
}

export type SSEEvent = TriageEvent | ReasoningStepEvent | ContentEvent |
                       CitationEvent | FeedbackEvent | ErrorEvent | DoneEvent |
                       ToolActivityEvent | SectionEvent