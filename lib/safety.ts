// Keyword-based crisis detection (DV, self-harm, trafficking) and input sanitization.
// Prompt injection is handled server-side by Azure Foundry's custom content guardrail.

export function detectDistress(input: string): {
    isDistress: boolean,
    resources: string[],
} {
    const keywords = [
        "beats me", "hits me", "being abused", "abuses me", "hurts me", "chokes me", "threatens to kill", 
        "afraid for my life", "afraid of my wife", "afraid of my husband", "afraid of my partner", "violent toward me",
        "kill me", "kill her", "kill him", "kill myself", "end my life", "want to die", "suicide", "suicidal", "hurt myself",
        "held against my will", "won't let me leave", "took my passport", "forced to work", "being trafficked", "trafficking",
    ]

    const resources = [
        "- National DV Hotline: 1-800-799-7233",
        "- Crisis Text Line: text HOME to 741741",
        "- National Human Trafficking Hotline: 1-888-373-7888"
    ]

    const lower = input.toLowerCase()
    const detected = keywords.some(k => lower.includes(k))

    return {
        isDistress: detected,
        resources: detected ? resources : [],
    }
}

// Strip control characters (preserving newline/tab/CR) and cap length. Returns null if empty.
export function sanitizeInput(input: string): string | null {
    const trimmed = input.trim()
    if (!trimmed) return null
    const cleaned = trimmed.replace(/[\x00-\x08\x0C\x0E-\x1F\x7F]/g, "")
    return cleaned.slice(0, 2000)
}