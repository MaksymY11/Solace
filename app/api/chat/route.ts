// SSE Streaming endpoint for chat

import { NextRequest } from "next/server";
import { orchestrate } from "@/lib/agentOrchestrator";

export async function POST(req: NextRequest) {
    const {message} = await req.json();

    if (!message || typeof message!=="string") {
        return new Response(JSON.stringify({error: "Message is required"}), {
            status: 400,
            headers: {"Content-Type": "application/json"},
        });
    }

    const stream = orchestrate(message);

    return new Response(stream, {
        status: 200,
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    })
}