// Scrollable message list with auto-scroll on new content

import { Message } from "@/lib/types"
import { useRef,useEffect } from "react"
import { ReasoningChain } from "./ReasoningChain"

export function ChatMessages(props: {
    messages: Message[]
}) {

    const bottomRef = useRef<HTMLDivElement>(null)
    const lastMsg = props.messages[props.messages.length-1]
    const isLoading = lastMsg?.loading === true
    
    useEffect(() => {
        if (!isLoading && props.messages.length > 0) {
            bottomRef.current?.scrollIntoView({behavior:"smooth"})
        }}, [isLoading])

    return (
        <div className="flex-1 overflow-y-auto pb-92">
            {props.messages.map(msg => {
                return (
                    <div key={msg.id} className={msg.role === "user" ? "flex justify-end" : "text-left"}>
                        <div className={msg.role === "user"
                            ? "inline-flex items-start justify-start bg-[#6bc6af] text-black rounded-lg px-4 py-2 text-left whitespace-pre-wrap"
                            : "text-black py-2 whitespace-pre-wrap"}>
                        {msg.role === "assistant" ? (
                            <>
                                <ReasoningChain
                                    triage={msg.triage}
                                    loading={msg.loading ?? false}
                                    reasoningSteps={msg.reasoningSteps}
                                    sectionContent={msg.sectionContent}
                                />
                                {msg.loading ? null : (msg.sectionContent?.["Answering..."] ?? msg.content)}
                            </>
                        ) : (
                            msg.content
                        )}
                        {msg.feedback && (
                            <>
                                {msg.feedback.needs_attorney && (
                                    <div className="rounded-lg border-l-4 border-[#f79f7b] bg-[#efe5cb] p-4 mt-4">
                                        <p className="mt-1 text-sm">{msg.feedback.next_steps[0]}</p>
                                    </div>
                                )}

                                {msg.feedback.next_steps.length > 0 && (
                                    <div className="mt-4">
                                        <p className="font-semibold text-sm">Next steps</p>
                                        <ol className="list-decimal pl-5 mt-1 text-sm space-y-1">
                                            {(msg.feedback.needs_attorney 
                                                ? msg.feedback.next_steps.slice(1)
                                                : msg.feedback.next_steps
                                            ).map((step, i) => (<li key={i}>{step}</li>))}
                                        </ol>
                                    </div>
                                )}

                                {msg.feedback.follow_up_questions.some(q => q.options !== null) && (
                                    <p className="mt-4 text-sm italic text-gray-600">
                                        To provide better guidance, please answer the questions below.
                                    </p>
                                )}
                            </>
                        )}
                        {msg.loading && <div className="loader mt-4" />}
                        </div>
                    </div>
                )
            })}
            <div ref={bottomRef} />
        </div>
    )
}