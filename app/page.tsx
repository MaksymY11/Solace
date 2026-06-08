"use client"

// TODO: Add conversation memory (pass message history to research agent)

import { useState } from "react"
import { Message, SSEEvent } from "@/lib/types"
import { ChatInput } from "@/components/ChatInput"
import { ChatMessages } from "@/components/ChatMessages"
import { FollowUpForm } from "@/components/FollowUpForm"

export default function Home() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const loading = messages.length > 0 && messages[messages.length-1].loading === true

  async function handleSend(overrideMessage?: string) {
    
    const text = overrideMessage ?? input
    if (!text.trim() || loading) {
      return
    }
    setInput("")

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    }
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      loading: true,
    }
    const assistantId = assistantMessage.id
    setMessages(prev => [...prev, userMessage, assistantMessage])
    try{
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({message:text}),
      })

      // Read loop
      if (!response.body) throw new Error("No response body")
      let buffer = ""
      let error = false
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        if (error) break
        const {done, value} = await reader.read()
        if (done) break
        buffer += decoder.decode(value, {stream: true})
        const parts = buffer.split("\n\n")
        buffer = parts.pop() ?? "" // Last piece of data

        for (const part of parts) {
          if (!part.trim()) continue
          const json = part.replace("data: ", "")
          const event = JSON.parse(json) as SSEEvent
          switch (event.type) {
            case "content": {
              setMessages(prev => prev.map(m => {
                if (m.id !== assistantId) return m
                const updated = {...m, content: m.content + event.data.text}
                if (event.data.section) {
                  const sc = {...(m.sectionContent ?? {})}
                  sc[event.data.section] = (sc[event.data.section] ?? "") + event.data.text
                  updated.sectionContent = sc
                }
                return updated
              }))
              break
            }
            case "triage": {
              setMessages(prev => prev.map( m =>
                m.id === assistantId ? {...m, triage: event.data} : m
              ))
              break
            }
            case "feedback": {
              setMessages(prev => prev.map( m =>
                m.id === assistantId ? {...m, feedback: event.data} : m
              ))
              break
            }
            case "section": {
              console.log("SECTION EVENT:", event.data)
              setMessages(prev => prev.map(m =>
                m.id === assistantId 
                  ? {...m, reasoningSteps: [...(m.reasoningSteps ?? []), {type: "section", label: event.data.name}]} 
                  : m
              ))
              break
            }
            case "tool_activity": {
              console.log("TOOL EVENT:", event.data)
              const query = event.data.query
                ? `"${event.data.query}"`
                : ""
              setMessages(prev => prev.map(m =>
                m.id === assistantId 
                  ? {...m, reasoningSteps: [...(m.reasoningSteps ?? []), {type: "tool", label: event.data.tool, detail: query}]}
                  : m
              ))
              break
            }
            case "error": {
              setMessages(prev => prev.map ( m =>
                m.id === assistantId ? {...m, content: event.data.message, loading: false} : m
              ))
              error = true
              break
            }
            case "distress": {
              setMessages(prev => prev.map( m =>
                m.id === assistantId ? {...m, distress: event.data.resources} : m
               ))
               break
            }
            case "done": {
              setMessages(prev => {
                const msg = prev.find(m => m.id === assistantId)
                console.log("ANSWER TEXT:", msg?.sectionContent?.["Answering..."])
                return prev
              })
              break
            }
          }
        }
      }

      // Flushing the buffer
      if (buffer.trim()) {
        const json = buffer.replace("data: ", "")
        const event = JSON.parse(json) as SSEEvent
        if (event.type === "content") {
          setMessages(prev => prev.map( m =>
            m.id === assistantId ? {...m, content: m.content + event.data.text} : m
          ))
        }
      }
    }
    catch {
      setMessages(prev => prev.map( m =>
        m.id === assistantId ? {...m, content: "Could not fetch a response. Please try again.", loading: false} : m
      ))
    }
    finally {
      setMessages(prev => prev.map( m =>
        m.id === assistantId ? {...m, loading: false} : m
      ))
    }
  }

  const isEmpty = messages.length === 0

  const lastMessage = messages[messages.length-1]
  const filteredQuestions = (lastMessage?.feedback?.follow_up_questions ?? []).filter(q=>q.options!=null)

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8">
      <header aria-label="Main header" className="self-start flex items-center gap-2">
        <img src={"solace_logo_cropped.png"} alt="" className="h-12 w-auto" />
        <span className="text-xl font-semibold">Solace</span>
      </header>
      <div className={isEmpty  
        ? "flex-1 flex items-center"
        : "flex-1 flex flex-col items-center w-full mt-16"
      }>
        <div className={`w-full max-w-xl flex flex-col gap-4 ${isEmpty ? "" : "flex-1"}`}>
          {isEmpty ? (
            <>
              <div className="flex items-center justify-center gap-2">
                <img src={"solace_logo_cropped.png"} alt="" className="h-10 w-auto" />
                <span className="text-xl sm:text-3xl">Hello, I&apos;m <strong className="text-[#017b80]">Solace</strong></span>
              </div>

              <ChatInput 
                input={input}
                setInput={setInput} 
                onSend={() => handleSend()} 
                loading={loading}
                showStarters={messages.length === 0}
              />
            </>
          ) : (
            <ChatMessages messages={messages} />
          )}
        </div>
      </div>
      {!isEmpty && (
        <footer aria-label="Chat input footer" className="fixed bottom-0 left-0 right-0 flex justify-center px-4 sm:p-8 pb-8 bg-[#fff7e1]">
          <div className="w-full max-w-xl">
              {filteredQuestions.length > 0 && 
                <FollowUpForm
                  questions={filteredQuestions}
                  onSubmit={(formatted) => handleSend(formatted)}
                />
              }

            <ChatInput 
              input={input} 
              setInput={setInput} 
              onSend={() => handleSend()} 
              loading={loading}
              showStarters={messages.length === 0}
            />
            <p className="text-xs text-[#8a6340] text-center mt-1">
              This is general legal information, not legal advice. For guidance specific to your situation, consult a qualified immigration attorney.
            </p>
          </div>
        </footer>
      )}
    </main>
  )
}
