import {
  draftKey,
  parseSavedDraft,
  type DeliveryDraft,
} from "../../components/procurement/plan-state"

export type DraftWrite = {
  componentId: string
  expected: string | null
  next: string | null
}

/** Compare before writing, so a slow agent cannot replace edits made meanwhile. */
export function writeDraftBatch(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  writes: DraftWrite[]
) {
  if (new Set(writes.map((w) => w.componentId)).size !== writes.length)
    throw new Error("Duplicate delivery changes")
  for (const write of writes) {
    if (write.next !== null && !parseSavedDraft(write.next, write.componentId))
      throw new Error("Invalid delivery proposal")
    if (storage.getItem(draftKey(write.componentId)) !== write.expected)
      throw new Error(
        "This delivery changed while the assistant was working. Ask again using the latest plan."
      )
  }
  const completed: DraftWrite[] = []
  try {
    for (const write of writes) {
      if (write.next === null) storage.removeItem(draftKey(write.componentId))
      else storage.setItem(draftKey(write.componentId), write.next)
      completed.push(write)
    }
  } catch {
    for (const write of completed.reverse()) {
      if (write.expected === null)
        storage.removeItem(draftKey(write.componentId))
      else storage.setItem(draftKey(write.componentId), write.expected)
    }
    throw new Error(
      "Browser storage could not save the changes. No draft update was completed."
    )
  }
  return writes.map((write) => ({
    componentId: write.componentId,
    expected: write.next,
    next: write.expected,
  }))
}

export function announceDeliveryChanges(writes: { componentId: string }[]) {
  for (const write of writes)
    window.dispatchEvent(
      new CustomEvent("forma:delivery-updated", {
        detail: { componentId: write.componentId },
      })
    )
}

export function persistDeliveryDraft(draft: DeliveryDraft) {
  const key = draftKey(draft.componentId),
    raw = JSON.stringify(draft)
  if (localStorage.getItem(key) === raw) return
  localStorage.setItem(key, raw)
  announceDeliveryChanges([draft])
}
