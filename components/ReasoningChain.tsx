
import { TriageResult } from "@/lib/types"
import { useState } from "react"

export function ReasoningChain(props: {
    triage: TriageResult | undefined
    loading: boolean
    reasoningSteps?: {type: "section" | "tool", label: string, detail?:string}[]
    sectionContent?: Record<string, string>
}) {
    const [toggled, setToggled] = useState(false)
    const expanded = props.loading || toggled

    return (
        <section aria-label="Reasoning chain">
            {expanded && (
                <div>
                    {props.triage && (
                        <div className="text-sm mb-3 p-3 bg-[#efe5cb] rounded-md">
                            <p><strong>Intent: </strong>{props.triage.intent}</p>
                            {Object.entries(props.triage.facts)
                                .filter(([, value]) => value != null)
                                .map(([key, value]) => (
                                    <p key={key}><strong>{key}: </strong>{value}</p>
                                ))}
                            <p><strong>Complexity: </strong>{props.triage.complexity}</p>
                            <p><strong>Summary: </strong>{props.triage.summary}</p>
                        </div>
                    )}
                    {(props.reasoningSteps ?? []).filter(s => s.label !== "Answering..." && s.label !== "Citations...").map((step, i, arr) => {
                        const isLast = i === arr.length - 1
                        const detail = step.type === "tool"
                            ? step.detail
                            : (props.sectionContent?.[step.label] ?? null)
                        return (
                            <div key={i} className="mb-2 text-sm">
                                <p className="flex items-center gap-1.5">
                                    {props.loading && isLast
                                        ? <span className="squishy-loader inline-block w-3 h-3 shrink-0" style={{background: "#017b80"}}/>
                                        : <span className="inline-block w-2 h-2 shrink-0 rounded-full bg-[#017b80]"></span>
                                    }
                                    {step.label}
                                </p>
                                {detail && <p className="text-xs text-gray-500 ml-5 whitespace-pre-wrap animate-fade-in">{detail}</p>}
                            </div>
                        )
                    })}
                </div>
            )}
            {!props.loading && (
                <div>
                    <button
                        type="button"
                        onClick={() => setToggled(prev => !prev)}
                        className="text-sm px-2 py-1 mb-2 rounded-md border border-[#017b80] bg-[#017b80] text-[#fff7e1] hover:bg-[#015f63]"
                    >
                        {toggled ? "Hide reasoning" : "Show reasoning"}
                    </button>
                </div>
            )}
        </section>
    )
}