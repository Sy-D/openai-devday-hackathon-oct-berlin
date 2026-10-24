"use client"

import { BookOpen, CheckCircle2, Play, Search, Sparkles } from "lucide-react"

function StepIcon({ line }: { line: string }) {
  const base = "mt-0.5 size-3.5 shrink-0"
  if (line.endsWith("done"))
    return <CheckCircle2 className={`${base} text-emerald-500`} />
  if (line.endsWith("started")) return <Play className={`${base} text-primary`} />
  if (line.includes("searching"))
    return <Search className={`${base} text-muted-foreground`} />
  if (line.includes("reading"))
    return <BookOpen className={`${base} text-muted-foreground`} />
  return <Sparkles className={`${base} text-muted-foreground`} />
}

export function ActivityLog({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null
  return (
    <ul className="mt-3 max-h-40 space-y-1.5 overflow-y-auto border-t pt-3 font-mono text-[11px] text-muted-foreground">
      {lines.map((line, i) => (
        <li key={i} className="flex items-start gap-1.5">
          <StepIcon line={line} />
          <span className="min-w-0 break-words">{line}</span>
        </li>
      ))}
    </ul>
  )
}
