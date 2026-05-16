import { beforeEach, describe, expect, it } from "bun:test"
import { Elysia } from "elysia"

import { docsRoutes } from "@/modules/docs/api/docs.route"
import { uiDocsRegistry } from "@/modules/docs/docs.registry"
import type { UiDocEntry } from "@/modules/docs/docs.types"

const initialRegistry = structuredClone(uiDocsRegistry)

const resetRegistry = (nextData: Record<string, UiDocEntry>) => {
  for (const key of Object.keys(uiDocsRegistry)) {
    delete uiDocsRegistry[key]
  }

  Object.assign(uiDocsRegistry, structuredClone(nextData))
}

const app = new Elysia().use(docsRoutes)

beforeEach(() => {
  resetRegistry(initialRegistry)
})

describe("docsRoutes", () => {
  it("returns docs entry for GET /docs with valid path", async () => {
    const response = await app.handle(
      new Request("http://localhost/docs?path=/console")
    )
    const body = (await response.json()) as {
      ok: boolean
      path: string
      title: string
    }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.path).toBe("/console")
    expect(body.title.length).toBeGreaterThan(0)
  })

  it("returns 400 when path query is missing", async () => {
    const response = await app.handle(new Request("http://localhost/docs"))
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(400)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INVALID_PATH")
  })

  it("returns 404 for unknown docs path", async () => {
    const response = await app.handle(
      new Request("http://localhost/docs?path=/missing")
    )
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(404)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("DOC_NOT_FOUND")
  })

  it("creates docs entry for POST /docs with valid payload", async () => {
    const response = await app.handle(
      new Request("http://localhost/docs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: "portal/documentations/",
          title: "  Portal Docs  ",
          purpose: "  Explain how to use portal docs. ",
          howTo: ["  Open portal  ", "  Read docs panel  "],
          notes: ["  Keep this in sync  ", "   "],
          updatedAt: "2026-05-16",
        }),
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      path: string
      title: string
      howTo: string[]
      notes?: string[]
    }

    expect(response.status).toBe(201)
    expect(body.ok).toBe(true)
    expect(body.path).toBe("/portal/documentations")
    expect(body.title).toBe("Portal Docs")
    expect(body.howTo).toEqual(["Open portal", "Read docs panel"])
    expect(body.notes).toEqual(["Keep this in sync"])
  })

  it("returns 400 when howTo normalizes to empty steps", async () => {
    const response = await app.handle(
      new Request("http://localhost/docs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: "/new",
          title: "New Docs",
          purpose: "Purpose",
          howTo: ["   "],
        }),
      })
    )
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(400)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INVALID_PAYLOAD")
  })
})
