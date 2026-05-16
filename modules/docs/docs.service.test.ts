import { beforeEach, describe, expect, it } from "bun:test"

import {
  getDocByPath,
  normalizeDocPath,
  upsertDocByPath,
} from "@/modules/docs/docs.service"
import { uiDocsRegistry } from "@/modules/docs/docs.registry"
import type { UiDocEntry } from "@/modules/docs/docs.types"

const initialRegistry = structuredClone(uiDocsRegistry)

const resetRegistry = (nextData: Record<string, UiDocEntry>) => {
  for (const key of Object.keys(uiDocsRegistry)) {
    delete uiDocsRegistry[key]
  }

  Object.assign(uiDocsRegistry, structuredClone(nextData))
}

beforeEach(() => {
  resetRegistry(initialRegistry)
})

describe("normalizeDocPath", () => {
  it("normalizes path format and strips query/hash/trailing slash", () => {
    expect(normalizeDocPath(" console?page=1#overview ")).toBe("/console")
    expect(normalizeDocPath("/portal/documentations/")).toBe(
      "/portal/documentations"
    )
    expect(normalizeDocPath("/")).toBe("/")
  })

  it("returns empty string when path is blank", () => {
    expect(normalizeDocPath("   ")).toBe("")
  })
})

describe("getDocByPath", () => {
  it("returns known docs using normalized paths", () => {
    const doc = getDocByPath("/console/?tab=overview")

    expect(doc).not.toBeNull()
    expect(doc?.path).toBe("/console")
  })

  it("returns null for unknown docs", () => {
    expect(getDocByPath("/not-found")).toBeNull()
  })
})

describe("upsertDocByPath", () => {
  it("upserts docs using normalized path keys", () => {
    const saved = upsertDocByPath({
      path: "portal/documentations/",
      title: "Portal Docs",
      purpose: "Describe portal behavior",
      howTo: ["Open the page"],
      notes: ["Initial draft"],
      updatedAt: "2026-05-16",
    })

    expect(saved.path).toBe("/portal/documentations")
    expect(uiDocsRegistry["/portal/documentations"]).toEqual(saved)
  })
})
