// Chat input with inline send button, starter question chips, and Enter-to-send

import type { KeyboardEvent } from "react"

export function ChatInput(props: {
    input: string,
    setInput: (v: string) => void,
    onSend: () => void,
    loading: boolean,
    showStarters: boolean,
}) {

    function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault()
            props.onSend()
        }
    }

    return (
        <div role="form" aria-label="Chat input form">
            <div className="relative">
                <textarea className="w-full border border-[#017b80] bg-[#efe5cb] rounded p-3 focus:outline-none focus:ring-2 focus:ring-[#017b80] resize-none"
                value={props.input}
                onChange={(e)=>props.setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={props.showStarters ? "Ask about your immigration rights..." : "Write a message..."}
                aria-label="Message input"
                />
                {props.input.trim() && (
                    <button 
                        className="absolute right-1 bottom-3 bg-[#017b80] text-[#fff7e1] rounded 
                                   px-3 py-1 hover:bg-[#015f63] text-sm animate-[fade-in-blur_0.5s_ease-out]"
                        onClick={props.onSend}
                        disabled={props.loading}
                        aria-label="Send message"
                    >
                        {props.loading ? "Thinking..." : "Send"}
                    </button>
                )}
            </div>
            {props.showStarters && (
                <div className="flex flex-col sm:flex-row gap-2">
                    {[
                        "What are my rights if I'm detained by ICE?",
                        "How do I apply for asylum?",
                        "What is VAWA?",
                    ].map(q => (
                        <button className="border border-[#017b80] text-black rounded-full px-2 py-1 text-xs hover:bg-[#015f63] hover:text-[#fff7e1] whitespace-nowrap"
                            key={q} onClick={() => props.setInput(q)}
                            aria-label={`Starter question: ${q}`}
                        >
                            {q}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
