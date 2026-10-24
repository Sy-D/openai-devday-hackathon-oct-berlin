import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet"
import { useEffect, useRef, useState } from "react"
import { ArrowRight, ArrowUp, Check, LoaderCircle, X } from "lucide-react"
import { duration, money, type Factory, type Order } from "../data/network"
import { type Plan, type PlanId } from "../lib/planner"

type Message = {
  role: "user" | "assistant"
  text: string
  planId?: PlanId
  mode?: "live" | "demo"
}
export default function AssistantDrawer({
  open,
  order,
  plans,
  factories,
  selectedPlanId,
  onSelect,
  onClose,
}: {
  open: boolean
  order: Order
  plans: Plan[]
  factories: Factory[]
  selectedPlanId: PlanId
  onSelect: (id: PlanId) => void
  onClose: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([]),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [providerLabel, setProviderLabel] = useState(
      "Checking assistant connection…"
    ),
    [error, setError] = useState("")
  const bottom = useRef<HTMLDivElement>(null),
    inputRef = useRef<HTMLInputElement>(null),
    requestStarted = useRef(false)
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    fetch("/api/health", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (requestStarted.current) return
        setProviderLabel(
          d.mode === "live"
            ? d.ready && d.status === "verified"
              ? "Connected to OpenAI"
              : d.status === "unavailable"
                ? "OpenAI unavailable · demo fallback"
                : "OpenAI configured · connection unverified"
            : "Demo assistant · no API key configured"
        )
      })
      .catch(() => {
        if (!controller.signal.aborted && !requestStarted.current)
          setProviderLabel("Assistant server unavailable")
      })
    return () => controller.abort()
  }, [open])
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "instant", block: "nearest" })
  }, [messages, busy])
  async function send(text: string) {
    if (busy || !text.trim()) return
    requestStarted.current = true
    setInput("")
    setError("")
    setMessages((m) => [...m, { role: "user", text }])
    setBusy(true)
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          context: { order, plans, factories, selectedPlanId },
        }),
        signal: AbortSignal.timeout(35000),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || "Assistant request failed.")
      if (
        // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Validate the API response at the network boundary; plan IDs are checked against current feasible plans below.
        typeof data.reply !== "string" ||
        !["live", "demo"].includes(data.mode)
      )
        throw new Error("The assistant returned an invalid response.")
      const valid = plans.find(
        (p) => p.id === data.suggestedPlanId && p.feasible
      )
      setProviderLabel(
        data.mode === "live"
          ? "Connected to OpenAI"
          : data.reason === "provider_unavailable"
            ? "Demo fallback · OpenAI request unavailable"
            : "Demo assistant · no API key configured"
      )
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: data.reply,
          planId: valid?.id,
          mode: data.mode,
        },
      ])
    } catch (e) {
      setProviderLabel("Assistant request failed · review connection")
      setError(
        e instanceof Error
          ? e.message
          : "The assistant is unavailable. You can still compare and assign plans manually."
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <SheetContent
        className="forma-app gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        showCloseButton={false}
        initialFocus={inputRef}
      >
        <SheetHeader className="border-b pr-16">
          <SheetTitle>Planning copilot</SheetTitle>
          <SheetDescription>{providerLabel}</SheetDescription>
          <SheetClose
            render={
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3 size-11"
                aria-label="Close copilot"
              />
            }
          >
            <X />
          </SheetClose>
        </SheetHeader>
        <div className="assistant-order">
          <span>
            Working on <strong>{order.id}</strong> · {order.quantity} kits ·
            deadline {duration(order.dueHours)}
          </span>
        </div>
        <div className="chat-body">
          {messages.length === 0 && (
            <div className="chat-welcome">
              <h3>Review this order’s options</h3>
              <p>
                Ask about costs, timing or factory compatibility. Review
                suggestions before confirming a plan.
              </p>
              <div className="suggested-prompts">
                {[
                  "What is the cheapest way to deliver on time?",
                  "Which plan gets this order there fastest?",
                  "Why can’t every factory print these parts?",
                ].map((q) => (
                  <Button variant="outline" key={q} onClick={() => send(q)}>
                    {q}
                    <ArrowUp size={16} />
                  </Button>
                ))}
              </div>
            </div>
          )}
          {messages.map((message, i) => (
            <div key={i} className={`chat-message ${message.role}`}>
              <div>
                <p>{message.text}</p>
                {message.planId && (
                  <Button
                    variant="outline"
                    className="h-auto min-h-11 whitespace-normal"
                    onClick={() => onSelect(message.planId!)}
                  >
                    {selectedPlanId === message.planId ? (
                      <Check size={15} />
                    ) : (
                      <ArrowRight size={15} />
                    )}
                    Review {plans.find((p) => p.id === message.planId)?.name} ·{" "}
                    {money(
                      plans.find((p) => p.id === message.planId)!.totalCost
                    )}
                  </Button>
                )}
                {message.mode === "demo" && (
                  <small>Deterministic demo response</small>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="assistant-thinking">
              <LoaderCircle size={17} className="spin" />
              Comparing your production options…
            </div>
          )}
          {error && (
            <p className="chat-error" role="alert">
              {error} You can still select a plan in the dashboard.
            </p>
          )}
          <div ref={bottom} />
        </div>
        <form
          className="chat-form"
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
        >
          <div>
            <Input
              className="h-11"
              ref={inputRef}
              aria-label="Ask the planning copilot"
              placeholder="Ask about this order…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={2000}
            />
            <Button
              variant="default"
              className="size-11"
              size="icon"
              type="submit"
              aria-label="Send message"
              disabled={busy || !input.trim()}
            >
              <ArrowUp size={19} />
            </Button>
          </div>
          <p>Suggestions only. You confirm every production plan.</p>
        </form>
      </SheetContent>
    </Sheet>
  )
}
