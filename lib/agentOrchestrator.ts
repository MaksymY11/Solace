// Three-agent sequential pipeline: Triage → Research (streaming) → Feedback

import { auditLog } from "./auditLog";
import { getClient } from "./foundryClient";
import { StreamParser } from "./streamParser";
import { translateResponse } from "./translator";
import { TriageEvent, ErrorEvent, ContentEvent, FeedbackEvent, DoneEvent, ToolActivityEvent, SectionEvent, TranslateEvent, TriageResult } from "./types";

const solace_triage = process.env.AZURE_TRIAGE_AGENT_ID!;
const solace_research = process.env.AZURE_RESEARCH_AGENT_ID!;
const solace_feedback = process.env.AZURE_FEEDBACK_AGENT_ID!;


export function orchestrate(message:string, history: {role: string, content: string}[], distress: boolean): ReadableStream {
    return new ReadableStream({async start(controller) {

        const history_formatted = history.length > 0
            ? `CONVERSATION HISTORY:\n${history.map(m => `${m.role}: ${m.content}`).join("\n")}\n\n`
            : ""

        //Triage Agent (non-streaming)
        const triage_input = 
        `${history_formatted}

        USER QUESTION:
        ${message}
        `
        const client = getClient();
        let openai = client.getOpenAIClient({
            azureConfig: {agentName:solace_triage, allowPreview: true},
        });

        let triageResult: TriageResult;
        try {
            const triage_response = await openai.responses.create({
                model: "gpt-4.1-mini",
                input: triage_input,
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
            let event: ErrorEvent
            if (e != null && typeof e === "object" && "status" in e && e.status === 400) {
                event = {
                    type: "error",
                    data: {message:"I can't help with that request. I'm here to provide information about legal immigration pathways."},
                };
                auditLog({
                    user: {query: message, distressDetected: distress},
                    errors: {contentFiltered: true, error: event.data.message},
                })
            } else {
                event = {
                    type: "error", 
                    data: {message:`Triage agent failed: ${e}`},
                }; 
                auditLog({
                    user: {query: message, distressDetected: distress},
                    errors: {contentFiltered: false, error: event.data.message},
                })
            }
            controller.enqueue(`data: ${JSON.stringify(event)}\n\n`)
            controller.close();
            return;
        }

        // Non-immigration or greeting queries: triage returns a friendly redirect, skip research + feedback
        if (triageResult.skip_research) {
            const event: ContentEvent = {
                type: "content",
                data: {text: triageResult.skip_research_summary},
            };
            controller.enqueue(`data: ${JSON.stringify(event)}\n\n`)

            const done: DoneEvent = {type:"done"};
            controller.enqueue(`data: ${JSON.stringify(done)}\n\n`);
            controller.close()
            return
        }

        // Foundry MCP tools (Web Search, KB) send mcp_approval_request chunks and halt
        // until approved. This helper auto-approves and continues streaming.
        let approvalReqId = ""
        let responseId = ""
        const parser = new StreamParser()
        const toolEvents: ToolActivityEvent[] = [] // for logging

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async function streamResearch(researchResponse: AsyncIterable<Record<string, any>>) {
            for await (const chunk of researchResponse) {
                if (chunk.type === "response.output_text.delta") {
                    researchResult += chunk.delta;
                    const events = parser.accept(chunk.delta);
                    for (const event of events) {
                        if (event.type === "content") {
                            const contentEvent: ContentEvent = {
                                type: "content",
                                data: {text: event.text, section: event.section || undefined},
                            };
                            controller.enqueue(`data: ${JSON.stringify(contentEvent)}\n\n`);
                        } else if (event.type === "section") {
                            const sectionEvent: SectionEvent = {
                                type: "section",
                                data: {name: event.section as SectionEvent["data"]["name"]},
                            };
                            controller.enqueue(`data: ${JSON.stringify(sectionEvent)}\n\n`);
                        }
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
                    toolEvents.push(event)
                    controller.enqueue(`data: ${JSON.stringify(event)}\n\n`)
                }
                if (chunk.type === "response.output_item.added" && chunk.item.type === "web_search_call") {
                    const event: ToolActivityEvent = {
                        type: "tool_activity",
                        data: {tool: chunk.item.type, status: "started", query: triageResult.summary}}
                    toolEvents.push(event)
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
        `${history_formatted}

        TRIAGE JSON:
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

            // Re-stream after each MCP tool approval until no more approvals are pending
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
            auditLog({
                user: {query: message, distressDetected: distress},
                assistant: {triage: triageResult, research: {result: researchResult, toolCalls: toolEvents}},
                errors: {contentFiltered: false, error: event.data.message},
            })
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
            auditLog({
                user: {query: message, distressDetected: distress},
                assistant: {triage: triageResult, research: {result: researchResult, toolCalls: toolEvents}, feedback: feedbackResult}, 
                errors: {contentFiltered: false, error: event.data.message},
            })
            controller.enqueue(`data: ${JSON.stringify(event)}\n\n`)
            controller.close();
            return;
        }

        // Logging relevant information
        const entry = {
            user: {
                query: message,
                distressDetected: distress,
            },
            assistant: {
                triage: triageResult,
                research: {
                    result: researchResult,
                    toolCalls: toolEvents,
                },
                feedback: feedbackResult,
            },
        }
        auditLog(entry)

        // Translating Contents (non-streaming)
        try {
            const translation = await translateResponse(message, triageResult, researchResult, feedbackResult)
            if (translation) {
                const event: TranslateEvent = {type: "translate", data: translation }
                controller.enqueue(`data: ${JSON.stringify(event)}\n\n`)
            }
        } catch (e) {
            console.error("Translation failed, serving English response:", e)
        }

        // Done Flag
        const event: DoneEvent = {
            type: "done"
        };
        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`)
        controller.close();

    }})
}
