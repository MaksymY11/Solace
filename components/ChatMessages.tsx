// Message list: renders user bubbles, assistant responses (reasoning chain → streaming answer →
// cleaned answer with citations), distress banners, attorney referrals, and follow-up prompts.

import { Message } from "@/lib/types"
import { useRef,useEffect, useState } from "react"
import { ReasoningChain } from "./ReasoningChain"
import { parseCitations } from "@/lib/parseCitations"

export function ChatMessages(props: {
    messages: Message[]
}) {

    const bottomRef = useRef<HTMLDivElement>(null)
    const lastMsg = props.messages[props.messages.length-1]
    const isLoading = lastMsg?.loading === true
    const [announce, setAnnounce] = useState("")
    const lastAssistant = props.messages.filter(m => m.role === "assistant").at(-1)
    
    useEffect(() => {
        if (!isLoading && props.messages.length > 0) {
            bottomRef.current?.scrollIntoView({behavior:"smooth"})
        }
    }, [isLoading])

    // Screen reader announcement: fires once when an assistant message finishes loading
    useEffect(() => {
        if (lastAssistant && !lastAssistant.loading) {
            setAnnounce(lastAssistant.content ?? "New assistant message")
        }
    }, [lastAssistant?.id, lastAssistant?.loading])

    return (
        <div className="flex-1 overflow-y-auto pb-105" role="log" aria-label="Chat messages">
            <div aria-live="polite" className="sr-only">{announce}</div>
            {props.messages.map(msg => {
                return (
                    <article key={msg.id} className={msg.role === "user" ? "flex justify-end" : "text-left"}>
                        <div className={msg.role === "user"
                            ? "inline-flex items-start justify-start bg-[#6bc6af] text-black rounded-lg px-4 py-2 text-left whitespace-pre-wrap"
                            : "text-black py-2 whitespace-pre-wrap"}>
                        {msg.role === "assistant" ? (
                            <>
                                {msg.distress && (
                                    <>
                                        <div className="rounded-lg border-l-4 border-[#017b80] bg-[#efe5cb] p-4 mt-4 mb-4"
                                             style={{animation: "fade-in-blur 0.5s ease-out both"}}>
                                            <p className="font-semibold text-md">❤️ You don&apos;t have to go through this alone. Here are confidential resources available to you:</p>
                                            <ul className="mt-1 text-md list-none">
                                                {msg.distress.map((step, i) => (<li key={i}>{step}</li>))}
                                            </ul>
                                        </div>
                                        <div className="text-center text-xl text-[#017b80] my-4">•  •  •</div>
                                    </>
                                )}
                                {msg.triage && <ReasoningChain
                                    triage={msg.triage}
                                    loading={msg.loading ?? false}
                                    reasoningSteps={msg.reasoningSteps}
                                    sectionContent={msg.sectionContent}
                                />}
                                {/* Stream raw answer text in real-time during loading; replaced by cleaned version on completion */}
                                {msg.loading && msg.sectionContent?.["Answering..."] && (
                                    <p className="mt-4 whitespace-pre-wrap animate-fade-in">
                                        {msg.sectionContent["Answering..."]}
                                    </p>
                                )}
                                {msg.loading ? null : (() => {
                                    const {cleanedText, citations} = parseCitations(msg.sectionContent?.["Answering..."] ?? msg.content, msg.sectionContent?.["Citations..."])
                                    return (
                                        <>
                                            {cleanedText}
                                            {citations.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mt-3">
                                                    {citations.map((c,i) => (
                                                        <a key={i} href={c.url} target="_blank" rel="noopener noreferrer"
                                                           className="inline-flex items-center px-3 py-1 rounded-full border 
                                                           border-[#017b80] text-[#017b80] text-xs hover:bg-[#017b80] hover:text-white transition"
                                                        >
                                                            {c.name}
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )
                                })()}
                            </>
                        ) : (
                            msg.content
                        )}
                        {msg.feedback && (
                            <>
                                {msg.feedback.needs_attorney && (
                                    <div className="rounded-lg border-l-4 border-[#f79f7b] bg-[#efe5cb] p-4 mt-4">
                                        <p className="font-semibold text-md">Consult an attorney</p>
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
                        {msg.loading && <div role="status" aria-label="Loading response" className="loader mt-4" />}
                        </div>
                    </article>
                )
            })}
            <div ref={bottomRef} />
        </div>
    )
}