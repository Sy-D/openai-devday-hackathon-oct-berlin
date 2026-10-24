"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { z } from "zod"
import {
  ArrowRight,
  ArrowUp,
  Check,
  LoaderCircle,
  MessageSquare,
  RotateCcw,
  Square,
} from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { partCatalog } from "@/src/data/part-catalog"
import {
  chatResultSchema,
  freshDeliveryDraft,
  type ChatMessage,
  type ChatResult,
} from "@/src/lib/delivery-chat"
import {
  announceDeliveryChanges,
  writeDraftBatch,
  type DraftWrite,
} from "@/src/lib/delivery-store"
import { draftKey, parseSavedDraft } from "./plan-state"
import styles from "./delivery-chat.module.css"

const OPEN_EVENT = "forma:open-delivery-chat"
type Entry = ChatMessage & {
  result?: ChatResult
  expected?: Record<string, string | null>
  applied?: boolean
  undone?: boolean
  undo?: DraftWrite[]
}
export function DeliveryChatLauncher({
  prompt,
  prominent = false,
}: {
  prompt?: string
  prominent?: boolean
}) {
  return (
    <Button
      aria-label="Ask FORMA"
      variant={prominent ? "default" : "outline"}
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent(OPEN_EVENT, { detail: { prompt } })
        )
      }
    >
      <MessageSquare size={16} />
      <span className={prominent ? "" : "hidden sm:inline"}>Ask FORMA</span>
    </Button>
  )
}

export function DeliveryChatOverview() {
  return (
    <section className={styles.overview} aria-label="Plan with chat">
      <div className={styles.overviewIcon}>
        <MessageSquare size={24} />
      </div>
      <div className={styles.overviewCopy}>
        <h2>Plan your next move with FORMA</h2>
        <p>
          Check incidents, reroute deliveries and compare time, cost and carbon
          — in one conversation.
        </p>
      </div>
      <DeliveryChatLauncher prominent />
    </section>
  )
}

const metric = (n: number | null | undefined, unit: string) =>
  n == null
    ? "—"
    : `${n.toLocaleString("en-IE", { maximumFractionDigits: 1 })}${unit}`

export function DeliveryChat() {
  const [open, setOpen] = useState(false),
    [text, setText] = useState("")
  const [componentId, setComponentId] = useState("optics")
  const [entries, setEntries] = useState<Entry[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("")
  const controller = useRef<AbortController | null>(null),
    bottom = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const show = (event: Event) => {
      const id = new URL(window.location.href).searchParams.get("component")
      if (id && Object.hasOwn(partCatalog, id)) setComponentId(id)
      const detail =
        event instanceof CustomEvent
          ? z.object({ prompt: z.string().optional() }).safeParse(event.detail)
          : null
      const prompt = detail?.success ? detail.data.prompt : undefined
      if (prompt) setText(prompt)
      setOpen(true)
    }
    window.addEventListener(OPEN_EVENT, show)
    return () => {
      window.removeEventListener(OPEN_EVENT, show)
      controller.current?.abort()
    }
  }, [])
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [entries, busy, open])

  async function send() {
    if (!text.trim() || controller.current) return
    const question = text.trim(),
      request = new AbortController()
    controller.current = request
    setBusy(true)
    setError("")
    setText("")
    const next: Entry[] = [...entries, { role: "user", content: question }]
    setEntries(next)
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const expected: Record<string, string | null> = {}
      const drafts = Object.keys(partCatalog).map((id) => {
        expected[id] = localStorage.getItem(draftKey(id))
        return parseSavedDraft(expected[id], id) ?? freshDeliveryDraft(id, zone)
      })
      const messages = next
        .slice(-13)
        .map(({ role, content }) => ({ role, content: content.slice(0, 6000) }))
      while (
        messages.length > 1 &&
        messages.reduce((n, m) => n + m.content.length, 0) > 28000
      )
        messages.shift()
      const response = await fetch("/api/delivery-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: request.signal,
        body: JSON.stringify({ messages, componentId, timeZone: zone, drafts }),
      })
      const body = await response.json()
      if (!response.ok) {
        const failure = z.object({ error: z.string() }).safeParse(body)
        throw new Error(
          failure.success
            ? failure.data.error
            : "The assistant is unavailable. Please retry."
        )
      }
      const parsed = chatResultSchema.safeParse(body)
      if (
        !parsed.success ||
        parsed.data.changes.some(
          (c) =>
            !Object.hasOwn(expected, c.componentId) ||
            c.draft.componentId !== c.componentId
        )
      )
        throw new Error(
          "The assistant returned an invalid draft. No changes were saved."
        )
      const result = parsed.data
      setEntries((current) => [
        ...current,
        { role: "assistant", content: result.reply, result, expected },
      ])
    } catch (cause) {
      setError(
        request.signal.aborted
          ? "Request stopped. No delivery changes were saved."
          : cause instanceof Error
            ? cause.message
            : "The assistant could not finish."
      )
      setText(question)
    } finally {
      controller.current = null
      setBusy(false)
    }
  }

  function applyDraftChanges(index: number, undo = false) {
    const entry = entries[index]
    try {
      const writes = undo
        ? entry.undo!
        : entry.result!.changes.map((change) => ({
            componentId: change.componentId,
            expected: entry.expected![change.componentId],
            next: JSON.stringify(change.draft),
          }))
      const reverse = writeDraftBatch(localStorage, writes)
      announceDeliveryChanges(writes)
      setEntries((current) =>
        current.map((e, i) =>
          i === index
            ? { ...e, applied: !undo, undone: undo, undo: reverse }
            : e
        )
      )
      setError("")
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Changes could not be saved."
      )
    }
  }

  const prompts = [
    "Which live incidents affect this delivery?",
    "Calculate the fastest route for this delivery and explain its cost and carbon.",
    "Compare the current route with an alternative avoiding nearby road restrictions.",
  ]
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className={styles.panel}>
        <SheetHeader className={styles.header}>
          <SheetTitle className={styles.title}>
            <span className={styles.avatar}>
              <MessageSquare size={20} />
            </span>
            FORMA assistant
          </SheetTitle>
          <SheetDescription>
            Plan in conversation. Review the changes before applying a decision.
          </SheetDescription>
        </SheetHeader>
        <div className={styles.context}>
          <label htmlFor="chat-component">Delivery in focus</label>
          <select
            id="chat-component"
            value={componentId}
            onChange={(event) => setComponentId(event.target.value)}
            disabled={busy}
          >
            {Object.values(partCatalog).map((part) => (
              <option key={part.componentId} value={part.componentId}>
                {part.category} · {part.productName}
              </option>
            ))}
          </select>
        </div>
        <div
          className={styles.messages}
          role="log"
          aria-label="Delivery conversation"
          aria-live="polite"
        >
          {!entries.length && (
            <div className={styles.welcome}>
              <h3>What should we work on?</h3>
              <p>
                Use the current delivery or name another component. I can look
                up places, check current reports and prepare a route comparison.
              </p>
              {prompts.map((prompt) => (
                <button key={prompt} onClick={() => setText(prompt)}>
                  {prompt}
                  <ArrowRight size={16} />
                </button>
              ))}
            </div>
          )}
          {entries.map((entry, index) => (
            <article
              key={index}
              className={styles.message}
              data-role={entry.role}
            >
              <span className={styles.speaker}>
                {entry.role === "user" ? "You" : "FORMA"}
              </span>
              <div className={styles.prose}>
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    ),
                  }}
                >
                  {entry.content}
                </Markdown>
              </div>
              {entry.result?.activity.length ? (
                <details className={styles.activity}>
                  <summary>
                    Checked {entry.result.activity.length} steps
                  </summary>
                  <ul>
                    {entry.result.activity.map((item) => (
                      <li key={item}>
                        <Check size={13} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {!!entry.result?.changes.length && (
                <div className={styles.changes}>
                  <strong>
                    {entry.applied
                      ? "Draft updated · decision still needs review"
                      : entry.undone
                        ? "Draft changes undone"
                        : "Proposed delivery changes"}
                  </strong>
                  {entry.result.changes.map((change) => (
                    <div key={change.componentId} className={styles.change}>
                      <span className={styles.changeName}>
                        {change.componentId.replaceAll("-", " ")}
                      </span>
                      <p>
                        {change.draft.originLabel} →{" "}
                        {change.draft.destinationLabel}
                      </p>
                      <p>
                        {change.draft.inputs.quantity} units ·{" "}
                        {change.draft.inputs.handlingMinutes} min handling
                      </p>
                      <p>
                        Departure:{" "}
                        {change.draft.inputs.departure.replace("T", " ") ||
                          "Not set"}
                        <br />
                        Deadline:{" "}
                        {change.draft.inputs.deadline.replace("T", " ") ||
                          "Not set"}{" "}
                        · local time
                      </p>
                      {change.after?.arrival && (
                        <p>
                          Calculated arrival:{" "}
                          {new Date(change.after.arrival).toLocaleString()}
                        </p>
                      )}
                      <div className={styles.metrics}>
                        {[
                          [
                            "Transport estimate",
                            metric(change.before?.transportEstimateEur, " €"),
                            metric(change.after?.transportEstimateEur, " €"),
                          ],
                          [
                            "Vehicle emissions",
                            metric(change.before?.emissionsKg, " kg CO₂e"),
                            metric(change.after?.emissionsKg, " kg CO₂e"),
                          ],
                          [
                            "Deadline margin",
                            metric(change.before?.bufferMinutes, " min"),
                            metric(change.after?.bufferMinutes, " min"),
                          ],
                        ].map(([label, before, after]) => (
                          <div key={label}>
                            <span>{label}</span>
                            <small>{before} →</small>
                            <b>{after}</b>
                          </div>
                        ))}
                      </div>
                      <Link
                        href={`/planning?component=${change.componentId}#decision`}
                        onClick={() => setOpen(false)}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        Review delivery
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  ))}
                  {!entry.applied && !entry.undone && (
                    <Button
                      disabled={busy}
                      onClick={() => applyDraftChanges(index)}
                    >
                      Update delivery draft
                      <ArrowRight size={14} />
                    </Button>
                  )}
                  {entry.applied && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => applyDraftChanges(index, true)}
                    >
                      <RotateCcw size={14} />
                      Undo draft changes
                    </Button>
                  )}
                </div>
              )}
            </article>
          ))}
          {busy && (
            <div className={styles.working} role="status">
              <LoaderCircle className="animate-spin" size={16} />
              Checking delivery data and planning tools…
            </div>
          )}
          <div ref={bottom} />
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <form
          className={styles.composer}
          onSubmit={(event) => {
            event.preventDefault()
            void send()
          }}
        >
          <label htmlFor="delivery-message" className="sr-only">
            Message FORMA
          </label>
          <textarea
            id="delivery-message"
            placeholder="Ask about a delivery or request a route change…"
            value={text}
            maxLength={4000}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault()
                void send()
              }
            }}
            rows={3}
          />
          <div>
            <span>Draft changes stay in this browser.</span>
            {busy ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Stop chat request"
                onClick={() => controller.current?.abort()}
              >
                <Square size={15} />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={!text.trim()}
                aria-label="Send message"
              >
                <ArrowUp size={18} />
              </Button>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
