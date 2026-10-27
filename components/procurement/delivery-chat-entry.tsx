"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { z } from "zod"
import {
  ArrowRight,
  ArrowUp,
  MessageSquare,
  Radio,
  Route,
  Leaf,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import styles from "./delivery-chat.module.css"

const OPEN_EVENT = "forma:open-delivery-chat"
const launchSchema = z.object({
  prompt: z.string().max(4000).optional(),
  submit: z.boolean().optional(),
})
const loadChat = () => import("./delivery-chat")
const preloadChat = () => {
  void loadChat().catch(() => {})
}
const ChatPanel = dynamic(
  () => loadChat().then((module) => module.DeliveryChat),
  {
    ssr: false,
    loading: () => (
      <div role="status" className={styles.loadingPanel}>
        Opening FORMA…
      </div>
    ),
  }
)
export type ChatLaunch = {
  id: number
  prompt?: string
  submit?: boolean
  componentId?: string
}

// Keep the conversation mounted after first use; load its renderer only on intent.
export function DeliveryChatHost() {
  const [launch, setLaunch] = useState<ChatLaunch | null>(null)
  useEffect(() => {
    const show = (event: Event) => {
      const parsed = launchSchema.safeParse(
        event instanceof CustomEvent ? event.detail : {}
      )
      const detail = parsed.success ? parsed.data : undefined
      const componentId =
        new URL(window.location.href).searchParams.get("component") ?? undefined
      setLaunch((previous) => ({
        id: (previous?.id ?? 0) + 1,
        prompt: detail?.prompt,
        submit: detail?.submit === true,
        componentId,
      }))
    }
    window.addEventListener(OPEN_EVENT, show)
    return () => window.removeEventListener(OPEN_EVENT, show)
  }, [])
  return launch ? <ChatPanel launch={launch} /> : null
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
      onPointerEnter={preloadChat}
      onFocus={preloadChat}
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
  const [prompt, setPrompt] = useState("")
  const ask = (message: string) => {
    window.dispatchEvent(
      new CustomEvent(OPEN_EVENT, {
        detail: { prompt: message.trim(), submit: true },
      })
    )
    setPrompt("")
  }
  const shortcuts = [
    {
      label: "Check live incidents",
      icon: Radio,
      prompt:
        "Which current incidents affect this delivery? Do not change anything.",
    },
    {
      label: "Compare routes",
      icon: Route,
      prompt:
        "Compare the current route with an alternative avoiding nearby road restrictions. Keep the other delivery inputs unchanged.",
    },
    {
      label: "Reduce emissions",
      icon: Leaf,
      prompt:
        "Calculate the lowest-carbon road route for this delivery and compare its cost and arrival time. Keep the other delivery inputs unchanged.",
    },
  ]
  return (
    <section className={styles.overview} aria-label="Plan with chat">
      <form
        className={styles.overviewComposer}
        onSubmit={(event) => {
          event.preventDefault()
          if (prompt.trim()) ask(prompt)
        }}
      >
        <span className={styles.overviewIcon}>
          <MessageSquare size={19} />
        </span>
        <label htmlFor="overview-chat-message" className="sr-only">
          Ask FORMA about a delivery
        </label>
        <input
          id="overview-chat-message"
          onFocus={preloadChat}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          maxLength={4000}
          placeholder="Ask FORMA to plan your next move…"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!prompt.trim()}
          aria-label="Send to FORMA"
        >
          <ArrowUp size={18} />
        </Button>
      </form>
      <div className={styles.shortcuts}>
        {shortcuts.map(({ label, icon: Icon, prompt: message }) => (
          <button
            key={label}
            onPointerEnter={preloadChat}
            onFocus={preloadChat}
            onClick={() => ask(message)}
          >
            <Icon size={14} />
            {label}
            <ArrowRight size={13} className={styles.shortcutArrow} />
          </button>
        ))}
      </div>
    </section>
  )
}
