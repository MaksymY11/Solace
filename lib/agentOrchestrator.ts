// Three-agent sequential pipeline

import { getClient } from "./foundryClient";
import { TriageEvent, ErrorEvent, ContentEvent, FeedbackEvent, DoneEvent } from "./types";

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
            const research_response = await openai.responses.create({
                model: "gpt-4.1",
                input: research_input,
                stream: true
            })

            for await (const chunk of research_response) {
                if (chunk.type === "response.output_text.delta") {
                    researchResult += chunk.delta;
                    const event: ContentEvent = {
                        type: "content",
                        data: chunk.delta,
                    };
                    controller.enqueue(`data: ${JSON.stringify(event)}\n\n`)
                }
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
