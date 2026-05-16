import { uiDocsRegistry } from "@/modules/docs/docs.registry"
import type { UiDocEntry } from "@/modules/docs/docs.types"

export const normalizeDocPath = (path: string) => {
  const trimmed = path.trim()

  if (!trimmed) {
    return ""
  }

  const withoutQuery = trimmed.split("?")[0]?.split("#")[0] ?? ""
  const normalized = withoutQuery.startsWith("/")
    ? withoutQuery
    : `/${withoutQuery}`

  if (normalized.length > 1 && normalized.endsWith("/")) {
    return normalized.slice(0, -1)
  }

  return normalized
}

export const getDocByPath = (path: string): UiDocEntry | null => {
  const normalized = normalizeDocPath(path)

  if (!normalized) {
    return null
  }

  return uiDocsRegistry[normalized] ?? null
}

export const upsertDocByPath = (entry: UiDocEntry): UiDocEntry => {
  const normalized = normalizeDocPath(entry.path)

  const savedEntry: UiDocEntry = {
    ...entry,
    path: normalized,
  }

  uiDocsRegistry[normalized] = savedEntry

  return savedEntry
}
