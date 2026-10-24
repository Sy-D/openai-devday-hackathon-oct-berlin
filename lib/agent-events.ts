import { z } from "zod"

const errorResponse = z.object({ error: z.string().min(1).max(1000) })

export type AgentEvent =
  | { type: "progress"; text: string }
  | { type: "result"; payload: unknown }
  | { type: "error"; message: string }

export interface AgentRequest {
  name?: string
  question?: string
  updateId?: string
  /** Previous analyst turn, used to resolve follow-up questions. */
  previous?: { question: string; sql: string; answer: string }
}

/** Client-side reader for the SSE stream emitted by the agent routes. */
export async function* streamAgent(
  url: string,
  body: AgentRequest
): AsyncGenerator<AgentEvent> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok || !response.body) {
    const detail = errorResponse.safeParse(
      await response.json().catch(() => null)
    )
    throw new Error(
      detail.success ? detail.data.error : `Request failed: ${response.status}`
    )
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  for (;;) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split("\n\n")
    buffer = parts.pop() ?? ""
    for (const part of parts) {
      const line = part.replace(/^data: /, "")
      if (line) {
        // SAFETY: the agent routes emit exactly the AgentEvent union.
        yield JSON.parse(line) as AgentEvent
      }
    }
    if (done) return
  }
}
