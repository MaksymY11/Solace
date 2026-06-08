import { TriageResult, FeedbackResult, ToolActivityEvent, ErrorEvent } from "./types"

export function auditLog(entry: {
    user: {
        query: string,
        distressDetected?: boolean,
    },
    assistant?: {
        triage?: TriageResult,
        research?: {
            result: string,
            toolCalls: ToolActivityEvent[],
        }
        feedback?: FeedbackResult,
    },
    errors?: {
        contentFiltered?: boolean,
        error?: string,
    },
}): void {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        ...entry,
    }))
}