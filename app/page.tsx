"use client"

import { useState } from "react"

export default function Home() {
  const [input, setInput] = useState("")
  const [reply, setReply] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSend() {
    
    if (!input.trim() || loading) {
      return
    }

    setReply("")
    setLoading(true)
    try{
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({message:input}),
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
          const event = JSON.parse(json)
          if (event.type === "content") {
            setReply(prev => prev + event.data)
          } else if (event.type === "error") {
            setReply(event.data.message)
            error = true
            break
          }
        }
      }

      // Flushing the buffer
      if (buffer.trim()) {
        const json = buffer.replace("data: ", "")
        const event = JSON.parse(json)
        if (event.type === "content") {
          setReply(prev => prev + event.data)
        }
      }
    }
    catch {
      setReply("Could not fetch a response. Please try again.")
    }
    finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-semibold mb-6">
        Solace
      </h1>
      <div className="w-full max-w-xl flex flex-col gap-4">
        <textarea className="w-full border rounded p-3"
          value={input}
          onChange={(e)=>setInput(e.target.value)}
          placeholder="Ask about your immigration rights..."
        />
        <button className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
          onClick={handleSend}
          disabled={loading || !input.trim()}
        >
          {loading ? "Thinking..." : "Send"}
        </button>
        {reply && <div className="border rounded p-4 bg-gray-50 text-gray-900 whitespace-pre-wrap">
                    {reply}
                  </div>}
      </div>
    </main>
  )
}

