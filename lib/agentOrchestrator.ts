// Three-agent sequential pipeline: Triage → Research (streaming) → Feedback

import { getClient } from "./foundryClient";
import { TriageEvent, ErrorEvent, ContentEvent, FeedbackEvent, DoneEvent, ToolActivityEvent, SectionEvent } from "./types";

const solace_triage = process.env.AZURE_TRIAGE_AGENT_ID!;
const solace_research = process.env.AZURE_RESEARCH_AGENT_ID!;
const solace_feedback = process.env.AZURE_FEEDBACK_AGENT_ID!;

export function orchestrate(message:string): ReadableStream {
    return new ReadableStream({async start(controller) {

        //Triage Agent (non-streaming)
        const client = getClient();
        let openai = client.getOpenAIClient({
            azureConfig: {agentName:solace_triage, allowPreview: true},
        });

        let triageResult;
        try {
            const triage_response = await openai.responses.create({
                model: "gpt-4.1-mini",
                input: message,
            });

            const triage_text = triage_response.output
                .filter((item): item is typeof item & {type: "message"} => item.type === "message")
                .flatMap((item) => item.content)
                .filter((c): c is typeof c & {type: "output_text"} => c.type === "output_text")
                .map((c) => c.text)
                .join("");

            triageResult = JSON.parse(triage_text);
            const event: TriageEvent = {
                type: "triage", 
                data: triageResult,
            };
            controller.enqueue(`data: ${JSON.stringify(event)}\n\n`)
        }
        catch (e) {
            const event: ErrorEvent = {
                type: "error", 
                data: {message:`Triage agent failed: ${e}`},
            };
            controller.enqueue(`data: ${JSON.stringify(event)}\n\n`)
            controller.close();
            return;
        }

        // Research agent helper
        // Research agent requires MCP tool approval for Web Search and Knowledge Base
        let approvalReqId = ""
        let responseId = ""
        let currentSection = ""
        let lastSentLength = 0

        async function streamResearch(researchResponse:any) {
            for await (const chunk of researchResponse) {
                if (chunk.type === "response.output_text.delta") {
                    researchResult += chunk.delta;
                    const sectionMatch = researchResult.match(/\[([^\]]+\.\.\.)\]/g)
                    if (sectionMatch) {
                        const latestSection = sectionMatch[sectionMatch.length - 1].replace(/[\[\]]/g, "")
                        if (latestSection !== currentSection) {
                            currentSection = latestSection
                            const event: SectionEvent = {type: "section", data: {name: currentSection as any}}
                            controller.enqueue(`data: ${JSON.stringify(event)}\n\n`)
                        }
                    }
                    const cleanedFull = researchResult
                        .replace(/\[[^\]]+\.\.\.\]/g, "")
                        .replace(/\[[^\]]*$/, "")
                    const newContent = cleanedFull.slice(lastSentLength)
                    if (newContent) {
                        lastSentLength = cleanedFull.length
                        const event: ContentEvent = {type: "content", data: {text: newContent, section: currentSection || undefined}};
                        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`)
                    }
                }
                if (chunk.type === "response.output_item.added" && chunk.item.type === "mcp_approval_request") {
                    approvalReqId = chunk.item.id
                    const toolName = chunk.item.name ?? "tool"
                    let query: string | undefined
                    try {
                        const args = JSON.parse(chunk.item.arguments ?? "{}")
                        query = args.queries?.[0] ?? args.query ?? undefined
                    } catch {}
                    const event: ToolActivityEvent = {
                        type: "tool_activity", 
                        data: {tool: toolName, status: "started", query}}
                    controller.enqueue(`data: ${JSON.stringify(event)}\n\n`)
                }
                if (chunk.type === "response.completed") {
                    responseId = chunk.response.id
                }
            }
        }

        // Research Agent (streaming)
        openai = client.getOpenAIClient({
            azureConfig: {agentName: solace_research, allowPreview: true},
        });
        const research_input = 
        `TRIAGE JSON:
        ${JSON.stringify(triageResult)}

        USER QUESTION:
        ${message}
        `
        let researchResult = ""
        try {
            let researchResponse = await openai.responses.create({
                model: "gpt-4.1",
                input: research_input,
                stream: true
            })

            await streamResearch(researchResponse)

            while (approvalReqId) {
                const reqId = approvalReqId
                approvalReqId = ""
                researchResponse = await openai.responses.create({
                    model: "gpt-4.1",
                    previous_response_id: responseId,
                    input: [{
                        type: "mcp_approval_response",
                        approval_request_id: reqId,
                        approve: true
                    }],
                    stream: true,
                })
                await streamResearch(researchResponse)
            }

            if (researchResult.length === 0) {
                const event: ContentEvent = {
                    type: "content",
                    data: {text: "I wasn't able to research this topic. Please try rephrasing your question with more detail."}
                };
                controller.enqueue(`data: ${JSON.stringify(event)}\n\n`)
            }
        }
        catch (e) {
            const event: ErrorEvent = {
                type: "error", 
                data: {message:`Research agent failed: ${e}`},
            };
            controller.enqueue(`data: ${JSON.stringify(event)}\n\n`)
            controller.close();
            return;
        }

        // Feedback Agent (non-streaming)
        openai = client.getOpenAIClient({
            azureConfig: {agentName: solace_feedback, allowPreview: true},
        });

        const feedback_input = 
        `TRIAGE JSON:
        ${JSON.stringify(triageResult)}

        USER QUESTION:
        ${message}

        RESEARCH RESPONSE TEXT:
        ${researchResult}
        `

        let feedbackResult;
        try {
            const feedback_response = await openai.responses.create({
                model: "gpt-4.1-mini",
                input: feedback_input,
            });

            const feedback_text = feedback_response.output
                .filter((item): item is typeof item & {type: "message"} => item.type === "message")
                .flatMap((item) => item.content)
                .filter((c): c is typeof c & {type: "output_text"} => c.type === "output_text")
                .map((c) => c.text)
                .join("");

            feedbackResult = JSON.parse(feedback_text);
            const event: FeedbackEvent = {
                type: "feedback", 
                data: feedbackResult,
            };
            controller.enqueue(`data: ${JSON.stringify(event)}\n\n`)
        }
        catch (e) {
            const event: ErrorEvent = {
                type: "error", 
                data: {message:`Feedback agent failed: ${e}`},
            };
            controller.enqueue(`data: ${JSON.stringify(event)}\n\n`)
            controller.close();
            return;
        }

        // Done Flag
        const event: DoneEvent = {
            type: "done"
        };
        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`)
        controller.close();

    }})
}
