// Structured JSON audit log for every interaction. Outputs to console.log (viewable in
// Vercel logs in production). Partial logs are written on early pipeline failure.

import { TriageResult, FeedbackResult, ToolActivityEvent } from "./types"

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