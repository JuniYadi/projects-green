import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import { createDocsRoutes } from "@/modules/docs/api/docs.route"

const mockAuthenticate = mock(async () => ({
  organizationId: "org_1",
  user: {
    id: "user_1",
    email: "admin@example.com",
  },
}))
const mockGetPlatformRole = mock(async () => "super_admin" as const)
const mockGetDocByPath = mock(async () => ({
  path: "/console",
  title: "Console Overview",
  purpose: "Console purpose",
  howTo: ["Open console"],
  notes: ["Initial note"],
  updatedAt: "2026-05-22",
}))
const mockUpsertDocByPath = mock(async () => ({
  path: "/console",
  title: "Console Overview",
  purpose: "Console purpose",
  howTo: ["Open console"],
  notes: ["Initial note"],
  updatedAt: "2026-05-22",
}))

const createApp = () =>
  new Elysia().use(
    createDocsRoutes({
      authenticate: mockAuthenticate,
      getPlatformRole: mockGetPlatformRole,
      getDocByPath: mockGetDocByPath,
      upsertDocByPath: mockUpsertDocByPath,
    })
  )

beforeEach(() => {
  mockAuthenticate.mockReset()
  mockGetPlatformRole.mockReset()
  mockGetDocByPath.mockReset()
  mockUpsertDocByPath.mockReset()

  mockAuthenticate.mockImplementation(async () => ({
    organizationId: "org_1",
    user: {
      id: "user_1",
      email: "admin@example.com",
    },
  }))
  mockGetPlatformRole.mockImplementation(async () => "super_admin")
  mockGetDocByPath.mockImplementation(async () => ({
    path: "/console",
    title: "Console Overview",
    purpose: "Console purpose",
    howTo: ["Open console"],
    notes: ["Initial note"],
    updatedAt: "2026-05-22",
  }))
  mockUpsertDocByPath.mockImplementation(async () => ({
    path: "/console",
    title: "Console Overview",
    purpose: "Console purpose",
    howTo: ["Open console"],
    notes: ["Initial note"],
    updatedAt: "2026-05-22",
  }))
})

describe("docsRoutes", () => {
  it("returns 401 when reading docs without auth user", async () => {
    mockAuthenticate.mockImplementationOnce(async () => ({
      organizationId: "org_1",
      user: null,
    }))

    const response = await createApp().handle(
      new Request("http://localhost/docs?path=/console")
    )
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(401)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("returns docs entry for GET /docs with valid auth and path", async () => {
    const response = await createApp().handle(
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

  it("returns validation envelope for invalid docs query", async () => {
    const response = await createApp().handle(
      new Request("http://localhost/docs")
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
      fieldErrors?: Record<string, string[]>
    }

    expect(response.status).toBe(422)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("VALIDATION_ERROR")
    expect(body.fieldErrors?.path?.length).toBeGreaterThan(0)
  })

  it("returns 404 for unknown docs path", async () => {
    mockGetDocByPath.mockResolvedValueOnce(null)

    const response = await createApp().handle(
      new Request("http://localhost/docs?path=/missing")
    )
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(404)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("DOC_NOT_FOUND")
  })

  it("returns 403 when posting docs without super admin role", async () => {
    mockGetPlatformRole.mockResolvedValueOnce("none")

    const response = await createApp().handle(
      new Request("http://localhost/docs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: "/console",
          title: "Console",
          purpose: "Purpose",
          howTo: ["Step 1"],
        }),
      })
    )
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(403)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("FORBIDDEN")
  })

  it("creates docs entry for POST /docs when super admin", async () => {
    const response = await createApp().handle(
      new Request("http://localhost/docs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: "/console",
          title: "Console Docs",
          purpose: "Explain console behavior",
          howTo: ["Open console"],
          notes: ["Keep updated"],
        }),
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      path: string
      title: string
    }

    expect(response.status).toBe(201)
    expect(body.ok).toBe(true)
    expect(body.path).toBe("/console")
    expect(mockUpsertDocByPath).toHaveBeenCalledTimes(1)
  })

  it("returns validation envelope for invalid docs payload", async () => {
    const response = await createApp().handle(
      new Request("http://localhost/docs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: "",
          title: "",
          purpose: "",
          howTo: [],
        }),
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
      fieldErrors?: Record<string, string[]>
    }

    expect(response.status).toBe(422)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("VALIDATION_ERROR")
    expect(body.fieldErrors?.path?.length).toBeGreaterThan(0)
    expect(body.fieldErrors?.title?.length).toBeGreaterThan(0)
  })
})
