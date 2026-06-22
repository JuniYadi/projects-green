import { useState, useCallback } from "react"
import type { VisibilityState } from "@tanstack/react-table"

const STORAGE_PREFIX = "table:column-visibility:"

export function usePersistedColumnVisibility(
  tableId?: string,
  defaultVisibility: VisibilityState = {}
) {
  const key = tableId ? `${STORAGE_PREFIX}${tableId}` : undefined

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () => {
      if (!key || typeof window === "undefined") return defaultVisibility
      try {
        const stored = localStorage.getItem(key)
        return stored
          ? (JSON.parse(stored) as VisibilityState)
          : defaultVisibility
      } catch {
        return defaultVisibility
      }
    }
  )

  const setAndPersist = useCallback(
    (
      updater:
        | VisibilityState
        | ((prev: VisibilityState) => VisibilityState)
    ) => {
      setColumnVisibility((prev) => {
        const next =
          typeof updater === "function" ? updater(prev) : updater
        if (key && typeof window !== "undefined") {
          localStorage.setItem(key, JSON.stringify(next))
        }
        return next
      })
    },
    [key]
  )

  return [columnVisibility, setAndPersist] as const
}
