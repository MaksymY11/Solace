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
        <>
            {props.showStarters && (
                <div className="flex flex-wrap gap-2">
                    {[
                        "What are my rights if I'm detained by ICE?",
                        "Can I work while my green card is pending?",
                        "How do I apply for asylum?",
                        "What is VAWA and am I eligible?",
                    ].map(q => (
                        <button className="border border-[#017b80] text-black rounded-full px-3 py-1 text-sm hover:bg-[#015f63]"
                            key={q} onClick={() => props.setInput(q)}
                        >
                            {q}
                        </button>
                    ))}
                </div>
            )}
            <textarea className="w-full border border-[#017b80] rounded p-3 focus:outline-none focus:ring-2 focus:ring-[#017b80]"
            value={props.input}
            onChange={(e)=>props.setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={props.showStarters ? "Ask about your immigration rights..." : ""}
            />
            <button className="bg-[#017b80] text-[#fff7e1] rounded px-4 py-2 disabled:opacity-50 hover:bg-[#015f63]"
            onClick={props.onSend}
            disabled={props.loading || !props.input.trim()}
            >
            {props.loading ? "Thinking..." : "Send"}
            </button>
        </>
    )
}
