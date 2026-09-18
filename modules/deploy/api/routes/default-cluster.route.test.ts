import { describe, expect, it, mock } from "bun:test"

mock.module("server-only", () => ({}))
mock.module("@/lib/prisma", () => ({ prisma: {} }))

const { createDefaultClusterRoutes } = await import("./default-cluster.route")

describe("defaultClusterRoutes", () => {
  it("returns 401 when unauthorized", async () => {
    const routes = createDefaultClusterRoutes({
      authenticate: async () => ({ user: null }),
    })
    const res = await routes.handle(
      new Request("http://localhost/deploy/default-cluster")
    )
    expect(res.status).toBe(401)
  })

  it("returns cluster info when authorized", async () => {
    const routes = createDefaultClusterRoutes({
      authenticate: async () => ({ user: { id: "user-1" } }),
    })
    const res = await routes.handle(
      new Request("http://localhost/deploy/default-cluster")
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      ok: boolean
      data: { managedBaseDomain: string }
    }
    expect(json.ok).toBe(true)
    expect(json.data.managedBaseDomain).toBe("sg.pfnapp.dev")
  })
})
