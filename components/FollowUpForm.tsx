import { FollowUpQuestion } from "@/lib/types"
import { useState, useEffect } from "react"

export function FollowUpForm(props: {
    questions: FollowUpQuestion[],
    onSubmit: (formatted: string) => void,
    onDismiss: () => void,
}) {
    const [currIdx, setCurrIdx] = useState(0)
    const [answers, setAnswers] = useState<string[]>(new Array(props.questions.length).fill(""))
    const [inputValue, setInputValue] = useState("")

    function handleAnswer(answer:string) {
        const updated = [...answers]
        updated[currIdx] = answer
        setAnswers(updated)

        // Last question answered -> submit
        if (currIdx === props.questions.length-1) {
            let buffer = ""
            for (let i = 0; i < updated.length; i++) {
                buffer += `Q: ${props.questions[i].question}\nA: ${updated[i]}\n`
            }
            props.onSubmit(buffer.trim())
        }
        else {
            setCurrIdx(prev => prev + 1)
        }
    }

    useEffect(() => {
        const stored = answers[currIdx] || ""
        const isOption = props.questions[currIdx]?.options?.includes(stored)
        setInputValue(isOption || stored === "[No preference]" ? "" : stored)
    }, [currIdx])
    

    return (
        <div className="border border-[#017b80] bg-[#efe5cb] rounded-md p-4 mb-1">
            <div className="flex justify-between items-center mb-3">
                <div className="text-sm font-medium flex-1">{props.questions[currIdx]?.question}</div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => setCurrIdx(prev => prev-1)}
                        disabled={currIdx === 0}
                        className="text-sm text-[#017b80] hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Previous"
                    >
                        ←
                    </button>
                    <div className="text-xs">{currIdx + 1} / {props.questions.length}</div>
                    <button
                        type="button"
                        onClick={() => { handleAnswer('[No preference]'); setInputValue("") }}
                        disabled={currIdx === props.questions.length - 1}
                        className="text-sm text-[#017b80] hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Next (no preference)"
                    >
                        →
                    </button>
                    <button
                        type="button"
                        onClick={props.onDismiss}
                        className="items-center h-6 w-6 rounded-md border border-[#017b80] text-[#017b80] text-md hover:bg-[#017b80] hover:text-white"
                    >
                        {"\u00d7"}
                    </button>
                </div>
            </div>

            <div className="flex flex-col flex-wrap divide-y divide-[#017b80]">
                {props.questions[currIdx]?.options?.map((opt, i) => (
                    <button
                        key={i}
                        type="button"
                        onClick={() => { handleAnswer(opt); setInputValue("") }}
                        className="flex items-center gap-3 w-full text-left px-3 py-2 hover:bg-[#6bc6af] rounded-md"
                    >
                        <span className="text-sm border border-[#017b80] rounded p-2 h-7 w-7 flex items-center justify-center">{i+1}</span>
                        <span className="text-sm">{opt}</span>
                    </button>
                ))}
                <form
                onSubmit={(e) => { e.preventDefault(); handleAnswer(inputValue); setInputValue("") }}
                className="flex items-center gap-3 w-full px-3 py-2"
                >
                    <span className="text-xs text-gray-400 border border-[#017b80] rounded p-2 h-7 w-7 flex items-center justify-center">✎</span>
                    <input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Your answer"
                        className="flex-1 text-sm outline-none bg-transparent"
                    />

                    <button
                        type="button"
                        onClick={() => { handleAnswer('[No preference]'); setInputValue("") }}
                        className="text-sm px-2 py-1 rounded-md border border-[#017b80] bg-[#017b80] text-[#fff7e1] hover:bg-[#015f63]"
                    >
                        Skip
                    </button>
                </form>
            </div>
        </div>
    )
}