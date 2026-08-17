import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import { createDocsRoutes } from "@/modules/docs/api/docs.route"

const mockAuthenticate = mock(
  async (): Promise<
    import("@/modules/docs/api/docs.route").DocsAuthContext
  > => ({
    organizationId: "org_1",
    user: {
      id: "user_1",
      email: "admin@example.com",
    },
  })
)
const mockGetPlatformRole = mock(
  async (): Promise<"none" | "super_admin"> => "super_admin" as const
)
const mockGetDocByPath = mock(
  async () =>
    ({
      path: "/console",
      title: "Console Overview",
      purpose: "Console purpose",
      howTo: ["Open console"],
      notes: ["Initial note"],
      updatedAt: "2026-05-22",
    }) as import("@/modules/docs/docs.types").UiDocEntry | null
)
const mockUpsertDocByPath = mock(async () => ({
  path: "/console",
  title: "Console Overview",
  purpose: "Console purpose",
  howTo: ["Open console"],
  notes: ["Initial note"],
  updatedAt: "2026-05-22",
}))
const mockListDocs = mock(
  async () => [] as import("@/modules/docs/docs.service").KnowledgeDocMatch[]
)
const mockDeleteDocById = mock(async () => {})

const createApp = () =>
  new Elysia().use(
    createDocsRoutes({
      authenticate: mockAuthenticate,
      getPlatformRole: mockGetPlatformRole,
      getDocByPath: mockGetDocByPath,
      upsertDocByPath: mockUpsertDocByPath,
      listDocs: mockListDocs,
      deleteDocById: mockDeleteDocById,
    })
  )

beforeEach(() => {
  mockAuthenticate.mockClear()
  mockGetPlatformRole.mockClear()
  mockGetDocByPath.mockClear()
  mockUpsertDocByPath.mockClear()
  mockListDocs.mockClear()
  mockDeleteDocById.mockClear()

  mockAuthenticate.mockImplementation(
    async (): Promise<
      import("@/modules/docs/api/docs.route").DocsAuthContext
    > => ({
      organizationId: "org_1",
      user: {
        id: "user_1",
        email: "admin@example.com",
      },
    })
  )
  mockGetPlatformRole.mockImplementation(
    async (): Promise<"none" | "super_admin"> => "super_admin"
  )
  mockGetDocByPath.mockImplementation(
    async () =>
      ({
        path: "/console",
        title: "Console Overview",
        purpose: "Console purpose",
        howTo: ["Open console"],
        notes: ["Initial note"],
        updatedAt: "2026-05-22",
      }) as import("@/modules/docs/docs.types").UiDocEntry | null
  )
  mockUpsertDocByPath.mockImplementation(async () => ({
    path: "/console",
    title: "Console Overview",
    purpose: "Console purpose",
    howTo: ["Open console"],
    notes: ["Initial note"],
    updatedAt: "2026-05-22",
  }))
  mockListDocs.mockImplementation(async () => [
    {
      id: "doc_1",
      organizationId: "org_1",
      path: "/console",
      title: "Console Overview",
      purpose: "Console purpose",
      howTo: ["Open console"],
      notes: ["Initial note"],
      updatedAt: "2026-05-22",
      score: 1,
    },
  ])
  mockDeleteDocById.mockImplementation(async () => {})
})

describe("docsRoutes", () => {
  it("returns 401 when reading docs without auth user", async () => {
    mockAuthenticate.mockImplementationOnce(
      async (): Promise<
        import("@/modules/docs/api/docs.route").DocsAuthContext
      > => ({
        organizationId: "org_1",
        user: null,
      })
    )

    const response = await createApp().handle(
      new Request("http://localhost/knowledge/docs?path=/console")
    )
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(401)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("returns docs entry for GET /knowledge/docs with valid auth and path", async () => {
    const response = await createApp().handle(
      new Request("http://localhost/knowledge/docs?path=/console")
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
      new Request("http://localhost/knowledge/docs")
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
      new Request("http://localhost/knowledge/docs?path=/missing")
    )
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(404)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("DOC_NOT_FOUND")
  })

  it("returns 403 when posting docs without super admin role", async () => {
    mockGetPlatformRole.mockResolvedValueOnce("none" as const)

    const response = await createApp().handle(
      new Request("http://localhost/knowledge/docs", {
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

  it("creates docs entry for POST /knowledge/docs when super admin", async () => {
    const response = await createApp().handle(
      new Request("http://localhost/knowledge/docs", {
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
      new Request("http://localhost/knowledge/docs", {
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

  it("returns 401 when listing docs without auth user", async () => {
    mockAuthenticate.mockImplementationOnce(
      async (): Promise<
        import("@/modules/docs/api/docs.route").DocsAuthContext
      > => ({
        organizationId: "org_1",
        user: null,
      })
    )

    const response = await createApp().handle(
      new Request("http://localhost/knowledge/docs/list")
    )
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(401)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("lists organization docs for an authenticated user", async () => {
    const response = await createApp().handle(
      new Request("http://localhost/knowledge/docs/list")
    )
    const body = (await response.json()) as {
      ok: boolean
      docs: Array<{ id: string }>
    }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.docs).toHaveLength(1)
    expect(mockListDocs).toHaveBeenCalledWith("org_1")
  })

  it("returns 403 when deleting docs without super admin role", async () => {
    mockGetPlatformRole.mockResolvedValueOnce("none" as const)

    const response = await createApp().handle(
      new Request("http://localhost/knowledge/docs/doc_1", {
        method: "DELETE",
      })
    )
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(403)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("FORBIDDEN")
    expect(mockDeleteDocById).not.toHaveBeenCalled()
  })

  it("deletes docs for a super admin", async () => {
    const response = await createApp().handle(
      new Request("http://localhost/knowledge/docs/doc_1", {
        method: "DELETE",
      })
    )
    const body = (await response.json()) as { ok: boolean }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mockDeleteDocById).toHaveBeenCalledWith("doc_1")
  })
})
