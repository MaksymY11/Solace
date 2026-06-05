// SSE Event Types for the Streaming Pipeline

export type Intent = "work_authorization" | "visa_status" | "asylum" | 
                     "enforcement" | "family" | "naturalization" | "other"

export interface Message {
    id: string,
    role: "user" | "assistant",
    content: string,
    triage?: TriageResult,
    feedback?: FeedbackResult,
    loading?: boolean,
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

export interface FeedbackResult {
    gaps: string[],
    follow_up_questions: string[],
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
        step: "UNDERSTANDING" | "RESEARCHING" | "APPLYING" | "CONFIDENCE" | "ANSWER",
        content: string,
    },
}

export interface ContentEvent {
    type: "content",
    data: string,
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
                       CitationEvent | FeedbackEvent | ErrorEvent | DoneEvent