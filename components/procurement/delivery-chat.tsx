"use client"

import { useEffect, useEffectEvent, useRef, useState } from "react"
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
  Package,
  Radio,
  Route,
  Leaf,
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
import { partCatalog, type PartReference } from "@/src/data/part-catalog"
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
import {
  Combobox,
  ComboboxTrigger,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox"
const parts = Object.values(partCatalog)
const partLabel = (part: PartReference) =>
  `${part.category} ${part.manufacturer} ${part.productName}`

import styles from "./delivery-chat.module.css"

import type { ChatLaunch } from "./delivery-chat-entry"
type Entry = ChatMessage & {
  result?: ChatResult
  expected?: Record<string, string | null>
  applied?: boolean
  undone?: boolean
  undo?: DraftWrite[]
}
const metric = (n: number | null | undefined, unit: string) =>
  n == null
    ? "—"
    : `${n.toLocaleString("en-IE", { maximumFractionDigits: 1 })}${unit}`

export function DeliveryChat({ launch }: { launch: ChatLaunch }) {
  const [open, setOpen] = useState(false),
    [text, setText] = useState("")
  const [componentId, setComponentId] = useState("optics")
  const [entries, setEntries] = useState<Entry[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("")
  const controller = useRef<AbortController | null>(null),
    bottom = useRef<HTMLDivElement>(null)
  const sendFromLauncher = useEffectEvent(
    (prompt: string, selectedComponent?: string) => {
      void send(prompt, selectedComponent)
    }
  )
  useEffect(() => {
    // Deferring the launch also prevents a duplicate submission during Strict Mode's
    // setup/cleanup replay. The first prompt survives loading the panel chunk.
    const timer = setTimeout(() => {
      const id = launch.componentId
      const selected = id && Object.hasOwn(partCatalog, id) ? id : undefined
      if (selected) setComponentId(selected)
      if (launch.prompt) setText(launch.prompt)
      setOpen(true)
      if (launch.prompt && launch.submit)
        sendFromLauncher(launch.prompt, selected)
    }, 0)
    return () => clearTimeout(timer)
  }, [launch])
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [entries, busy, open])

  async function send(override?: string, selectedComponent?: string) {
    if (!(override ?? text).trim() || controller.current) return
    const question = (override ?? text).trim(),
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
        body: JSON.stringify({
          messages,
          componentId: selectedComponent ?? componentId,
          timeZone: zone,
          drafts,
        }),
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

  const selectedPart =
    parts.find((part) => part.componentId === componentId) ?? partCatalog.optics
  const prompts = [
    {
      icon: Radio,
      title: "Check live incidents",
      description: "See which reports affect this delivery.",
      prompt: "Which live incidents affect this delivery?",
    },
    {
      icon: Route,
      title: "Find a better route",
      description: "Compare arrival time and transport cost.",
      prompt:
        "Calculate the fastest route for this delivery and explain its cost and carbon.",
    },
    {
      icon: Leaf,
      title: "Reduce the footprint",
      description: "Compare lower-carbon route options.",
      prompt:
        "Calculate the lowest-carbon road route for this delivery and compare it with the current route.",
    },
  ]
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className={styles.panel}>
        <SheetHeader className={styles.header}>
          <span className={styles.avatar}>
            <MessageSquare size={18} />
          </span>
          <div>
            <SheetTitle className={styles.title}>FORMA assistant</SheetTitle>
            <SheetDescription className={styles.subtitle}>
              Plan, compare, then decide.
            </SheetDescription>
          </div>
        </SheetHeader>
        <div className={styles.context}>
          <span className={styles.contextLabel}>Working on</span>
          <Combobox
            items={parts}
            value={selectedPart}
            onValueChange={(part) => {
              if (part) setComponentId(part.componentId)
            }}
            itemToStringLabel={partLabel}
            disabled={busy}
          >
            <ComboboxTrigger
              aria-label="Delivery in focus"
              className={styles.contextTrigger}
            >
              <span className={styles.partIcon}>
                <Package size={18} />
              </span>
              <span className={styles.partText}>
                <small>
                  {selectedPart.category} · {selectedPart.manufacturer}
                </small>
                <strong>{selectedPart.productName}</strong>
              </span>
            </ComboboxTrigger>
            <ComboboxContent className={styles.contextMenu}>
              <ComboboxInput
                aria-label="Search deliveries"
                placeholder="Find a part or supplier…"
                showTrigger={false}
              />
              <ComboboxEmpty>No matching deliveries.</ComboboxEmpty>
              <ComboboxList>
                {(part: PartReference) => (
                  <ComboboxItem
                    key={part.componentId}
                    value={part}
                    className={styles.contextOption}
                  >
                    <span>
                      <small>
                        {part.category} · {part.manufacturer}
                      </small>
                      <strong>{part.productName}</strong>
                    </span>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
        <div
          className={styles.messages}
          role="log"
          aria-label="Delivery conversation"
          aria-live="polite"
        >
          {!entries.length && (
            <div className={styles.welcome}>
              <h3>What’s the next move?</h3>
              <p>Ask about this delivery or start with a suggestion.</p>
              {prompts.map(({ icon: Icon, title, description, prompt }) => (
                <button key={title} onClick={() => setText(prompt)}>
                  <span className={styles.promptIcon}>
                    <Icon size={18} />
                  </span>
                  <span>
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </span>
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
            rows={2}
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
