// Renders the conversation (scrollable list of user and assistant messages)

import { Message } from "@/lib/types"
import { useRef,useEffect } from "react"

export function ChatMessages(props: {
    messages: Message[]
}) {

    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({behavior:"smooth"})
    }, [props.messages])

    return (
        <div className="flex-1 overflow-y-auto">
            {props.messages.map(msg => (
                <div key={msg.id} className={msg.role === "user" ? "text-right" : "text-left"}>
                    <div className={msg.role === "user"
                        ? "inline-block bg-[#6bc6af] text-black rounded-lg px-4 py-2"
                        : "text-black py-2 whitespace-pre-wrap"}>
                    {msg.content}
                    {msg.loading && "..."}
                    </div>
                </div>
            ))}
            <div ref={bottomRef} />
        </div>
    )
}