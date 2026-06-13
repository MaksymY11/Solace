// Post-response translation via Azure Translator API.
// All translatable strings (triage, research sections, feedback, UI chrome) are batched
// into a single API call, then sliced back into their original structures.
// Called by agentOrchestrator after streaming completes; returns null for English input.

import { FeedbackResult, FollowUpQuestion, TranslateEvent, TriageResult } from "./types"


export async function detectLanguage(text:string) {
    const response = await fetch(
        "https://api.cognitive.microsofttranslator.com/detect?api-version=3.0",
        {
            method: "POST",
            headers: {
                "Ocp-Apim-Subscription-Key": process.env.AZURE_TRANSLATOR_KEY!,
                "Ocp-Apim-Subscription-Region": process.env.AZURE_TRANSLATOR_REGION!,
                "Content-Type": "application/json",
            },
            body: JSON.stringify([{Text: text}]),
        }
    )
    const data = await response.json()
    return data[0].language
}

export async function translateTexts(texts: string[], targetLang: string) {
    const response = await fetch(
        `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${targetLang}`,
        {
            method: "POST",
            headers: {
                "Ocp-Apim-Subscription-Key": process.env.AZURE_TRANSLATOR_KEY!,
                "Ocp-Apim-Subscription-Region": process.env.AZURE_TRANSLATOR_REGION!,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(texts.map(t => ({Text: t}))),
        }
    )
    const data = await response.json()
    return data.map((d: {translations: {text: string}[]}) => d.translations[0].text)
}

export async function translateResponse(
    message: string,
    triageResult: TriageResult,
    researchResult: string,
    feedbackResult: FeedbackResult,
): Promise<TranslateEvent["data"] | null> {
    const user_lang = await detectLanguage(message)
    if (user_lang === "en") return null

    const sectionNames = [
        "Analyzing your question...",
        "Researching sources...",
        "Applying to your situation...",
        "Evaluating confidence...",
        "Answering...",
    ]

    // Extract section content from raw research result
    const sectionContent: Record<string, string> = {}
    for (let i = 0; i < sectionNames.length; i++) {
        const start = researchResult.indexOf(`[${sectionNames[i]}]`)
        if (start === -1) continue
        const contentStart = start + sectionNames[i].length + 2
        const nextSection = sectionNames[i + 1]
            ? researchResult.indexOf(`[${sectionNames[i + 1]}]`)
            : researchResult.indexOf("[Citations...]")
        const content = nextSection !== -1
            ? researchResult.slice(contentStart, nextSection)
            : researchResult.slice(contentStart)
        sectionContent[sectionNames[i]] = content.trim()
    }

    // Build flat array for a single batch translate call
    const texts: string[] = []

    // 1. Triage strings: summary + non-null fact values
    texts.push(triageResult.summary)
    const factKeys = Object.keys(triageResult.facts) as (keyof TriageResult["facts"])[]
    const factKeysWithValues = factKeys.filter(k => triageResult.facts[k] != null)
    for (const key of factKeysWithValues) {
        texts.push(triageResult.facts[key]!)
    }

    // 2. Research section content
    const sectionKeys = Object.keys(sectionContent)
    for (const key of sectionKeys) {
        texts.push(sectionContent[key])
    }

    // 3. Feedback strings
    const nextSteps = feedbackResult?.next_steps ?? []
    const gaps = feedbackResult?.gaps ?? []
    const questions = feedbackResult?.follow_up_questions ?? []
    const questionTexts = questions.map(q => q.question)
    const optionArrays = questions.map(q => q.options ?? [])
    const allOptions = optionArrays.flat()

    texts.push(...nextSteps, ...gaps, ...questionTexts, ...allOptions)

    // 4. Hardcoded UI strings
    const uiKeys = [
        "Consult an attorney",
        "Next steps",
        "To provide better guidance, please answer the questions below.",
        "Show reasoning",
        "Hide reasoning",
        "Your answer",
        "Skip",
        "Write a message...",
        "This is general legal information, not legal advice. For guidance specific to your situation, consult a qualified immigration attorney.",
    ]
    texts.push(...uiKeys)

    if (texts.length === 0) return null

    const translated = await translateTexts(texts, user_lang)
    let idx = 0

    // Rebuild triage
    const tSummary = translated[idx++]
    const tFacts = { ...triageResult.facts }
    for (const key of factKeysWithValues) {
        tFacts[key] = translated[idx++]
    }
    const tTriage: TriageResult = {
        ...triageResult,
        summary: tSummary,
        facts: tFacts,
    }

    // Rebuild section content
    const translatedSections: Record<string, string> = {}
    for (const key of sectionKeys) {
        translatedSections[key] = translated[idx++]
    }

    // Rebuild feedback
    const tNextSteps = translated.slice(idx, idx + nextSteps.length); idx += nextSteps.length
    const tGaps = translated.slice(idx, idx + gaps.length); idx += gaps.length
    const tQuestionTexts = translated.slice(idx, idx + questionTexts.length); idx += questionTexts.length
    const tOptions = [...translated.slice(idx, idx + allOptions.length)]; idx += allOptions.length

    const tQuestions: FollowUpQuestion[] = questions.map((q, i) => ({
        question: tQuestionTexts[i],
        options: q.options
            ? tOptions.splice(0, q.options.length)
            : null,
    }))

    // Rebuild UI strings
    const tUi: Record<string, string> = {}
    for (const key of uiKeys) {
        tUi[key] = translated[idx++]
    }

    return {
        triage: tTriage,
        sectionContent: translatedSections,
        feedback: feedbackResult ? {
            next_steps: tNextSteps,
            gaps: tGaps,
            follow_up_questions: tQuestions,
            needs_attorney: feedbackResult.needs_attorney,
        } : undefined,
        ui: tUi,
    }
}
