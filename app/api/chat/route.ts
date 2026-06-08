// SSE Streaming endpoint for chat

import { NextRequest } from "next/server";
import { orchestrate } from "@/lib/agentOrchestrator";
import { detectDistress, sanitizeInput } from "@/lib/safety";
import { DistressEvent } from "@/lib/types";

export async function POST(req: NextRequest) {
    let {message, history} = await req.json();
    message = sanitizeInput(message)

    if (!message || typeof message!=="string") {
        return new Response(JSON.stringify({error: "Message is required"}), {
            status: 400,
            headers: {"Content-Type": "application/json"},
        });
    }

    const distress = detectDistress(message);
    const stream = orchestrate(message, history, distress.isDistress);
    const bodyStream = distress.isDistress
        ? new ReadableStream({
            async start(controller) {
                const event: DistressEvent = {
                    type: "distress",
                    data: {resources: distress.resources},
                };
                controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
                const reader = stream.getReader();
                while (true) {
                    const {done, value} = await reader.read();
                    if (done) break;
                    controller.enqueue(value);
                }
                controller.close();
            }
        })
        : stream;

    return new Response(bodyStream, {
        status: 200,
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    })
}