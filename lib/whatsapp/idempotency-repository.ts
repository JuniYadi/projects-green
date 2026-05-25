const seenEventIds = new Set<string>()

export function hasProcessedEvent(eventId: string): boolean {
  return seenEventIds.has(eventId)
}

export function markEventProcessed(eventId: string): void {
  seenEventIds.add(eventId)
}

export function resetIdempotencyStore(): void {
  seenEventIds.clear()
}
