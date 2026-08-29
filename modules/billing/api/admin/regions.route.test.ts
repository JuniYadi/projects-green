import { describe, expect, it, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { Prisma } from "@prisma/client"

import { createAdminRegionsRoutes } from "./regions.route"
import type { requireSuperAdmin } from "@/modules/admin/api/admin.guards"
type GuardFn = typeof requireSuperAdmin & { mockClear: () => void }

const guard = mock(async () => ({
  ok: true as const,
  userId: "admin-1",
  platformRole: "super_admin" as const,
})) as unknown as GuardFn

const unauthorizedGuard = mock(async (set?: { status?: number | string }) => {
  if (set) set.status = 401
  return {
    ok: false as const,
    error: "UNAUTHORIZED",
    message: "You must be signed in to perform this action.",
  }
}) as unknown as GuardFn

const forbiddenGuard = mock(async (set?: { status?: number | string }) => {
  if (set) set.status = 403
  return {
    ok: false as const,
    error: "FORBIDDEN",
    message: "You do not have permission to access this resource.",
  }
}) as unknown as GuardFn
const db = {
  serviceRegion: {
    findMany: mock(),
    findUnique: mock(),
    create: mock(),
    update: mock(),
    delete: mock(),
  },
  appHostingCluster: {
    count: mock(),
  },
  servicePricing: {
    count: mock(),
  },
}

const mockRegion = {
  id: "region-1",
  code: "SINGAPORE",
  name: "Singapore",
  country: "SG",
  flag: "🇸🇬",
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  _count: {
    appHostingClusters: 0,
    pricings: 0,
  },
}

function app(authGuard = guard) {
  return new Elysia()
    .use(
      createAdminRegionsRoutes({
        requireSuperAdmin: authGuard as never,
        prisma: db as never,
      })
    )
    .compile()
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe("admin regions routes", () => {
  beforeEach(() => {
    guard.mockClear()
    unauthorizedGuard.mockClear()
    forbiddenGuard.mockClear()
    db.serviceRegion.findMany.mockReset()
    db.serviceRegion.findUnique.mockReset()
    db.serviceRegion.create.mockReset()
    db.serviceRegion.update.mockReset()
    db.serviceRegion.delete.mockReset()
    db.appHostingCluster.count.mockReset()
    db.servicePricing.count.mockReset()
  })

  describe("GET /admin/regions", () => {
    it("returns 401 when unauthorized", async () => {
      const server = app(unauthorizedGuard)
      const res = await server.handle(
        new Request("http://localhost/admin/regions")
      )
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when forbidden", async () => {
      const server = app(forbiddenGuard)
      const res = await server.handle(
        new Request("http://localhost/admin/regions")
      )
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
    })

    it("lists all regions ordered by name asc with counts", async () => {
      db.serviceRegion.findMany.mockResolvedValueOnce([mockRegion])

      const server = app()
      const res = await server.handle(
        new Request("http://localhost/admin/regions")
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data).toHaveLength(1)
      expect(body.data[0].code).toBe("SINGAPORE")
      expect(db.serviceRegion.findMany).toHaveBeenCalledWith({
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: {
              appHostingClusters: true,
              pricings: true,
            },
          },
        },
      })
    })

    it("handles server error gracefully", async () => {
      db.serviceRegion.findMany.mockRejectedValueOnce(new Error("DB error"))

      const server = app()
      const res = await server.handle(
        new Request("http://localhost/admin/regions")
      )
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("SERVER_ERROR")
    })
  })

  describe("POST /admin/regions", () => {
    it("validates body payload and rejects invalid inputs", async () => {
      const server = app()
      const res = await server.handle(
        jsonRequest("http://localhost/admin/regions", "POST", {
          code: "",
          name: "",
          country: "INVALID",
        })
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("BAD_REQUEST")
      expect(body.fieldErrors).toBeDefined()
    })

    it("returns 409 conflict when code already exists", async () => {
      db.serviceRegion.findUnique.mockResolvedValueOnce(mockRegion)

      const server = app()
      const res = await server.handle(
        jsonRequest("http://localhost/admin/regions", "POST", {
          code: "singapore",
          name: "Singapore",
          country: "sg",
          flag: "🇸🇬",
        })
      )
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("CONFLICT")
      expect(body.message).toContain("SINGAPORE")
    })

    it("creates a new region with uppercase code and country", async () => {
      db.serviceRegion.findUnique.mockResolvedValueOnce(null)
      db.serviceRegion.create.mockResolvedValueOnce({
        ...mockRegion,
        code: "INDONESIA",
        country: "ID",
        name: "Indonesia",
        flag: "🇮🇩",
      })

      const server = app()
      const res = await server.handle(
        jsonRequest("http://localhost/admin/regions", "POST", {
          code: "indonesia",
          name: "Indonesia",
          country: "id",
          flag: "🇮🇩",
          isActive: true,
        })
      )
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.code).toBe("INDONESIA")
      expect(db.serviceRegion.create).toHaveBeenCalledWith({
        data: {
          code: "INDONESIA",
          name: "Indonesia",
          country: "ID",
          flag: "🇮🇩",
          isActive: true,
        },
        include: {
          _count: {
            select: {
              appHostingClusters: true,
              pricings: true,
            },
          },
        },
      })
    })

    it("handles Prisma P2002 conflict error on creation", async () => {
      db.serviceRegion.findUnique.mockResolvedValueOnce(null)
      db.serviceRegion.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "6.0.0",
        })
      )

      const server = app()
      const res = await server.handle(
        jsonRequest("http://localhost/admin/regions", "POST", {
          code: "SINGAPORE",
          name: "Singapore",
          country: "SG",
        })
      )
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("CONFLICT")
    })
  })

  describe("PATCH /admin/regions/:id", () => {
    it("returns 404 when region does not exist", async () => {
      db.serviceRegion.findUnique.mockResolvedValueOnce(null)

      const server = app()
      const res = await server.handle(
        jsonRequest("http://localhost/admin/regions/non-existent", "PATCH", {
          name: "Updated Name",
        })
      )
      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns 409 when updated code already taken by another region", async () => {
      db.serviceRegion.findUnique
        .mockResolvedValueOnce(mockRegion) // existing region by id
        .mockResolvedValueOnce({ id: "region-2", code: "INDONESIA" }) // duplicate code check

      const server = app()
      const res = await server.handle(
        jsonRequest("http://localhost/admin/regions/region-1", "PATCH", {
          code: "indonesia",
        })
      )
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("CONFLICT")
    })

    it("updates region successfully", async () => {
      db.serviceRegion.findUnique.mockResolvedValueOnce(mockRegion)
      db.serviceRegion.update.mockResolvedValueOnce({
        ...mockRegion,
        name: "Singapore Primary",
        isActive: false,
      })

      const server = app()
      const res = await server.handle(
        jsonRequest("http://localhost/admin/regions/region-1", "PATCH", {
          name: "Singapore Primary",
          isActive: false,
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.name).toBe("Singapore Primary")
      expect(body.data.isActive).toBe(false)
      expect(db.serviceRegion.update).toHaveBeenCalledWith({
        where: { id: "region-1" },
        data: {
          name: "Singapore Primary",
          isActive: false,
        },
        include: {
          _count: {
            select: {
              appHostingClusters: true,
              pricings: true,
            },
          },
        },
      })
    })

    it("handles validation failure for patch", async () => {
      const server = app()
      const res = await server.handle(
        jsonRequest("http://localhost/admin/regions/region-1", "PATCH", {
          country: "INVALID_COUNTRY",
        })
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("BAD_REQUEST")
    })
  })

  describe("DELETE /admin/regions/:id", () => {
    it("returns 404 when region not found", async () => {
      db.serviceRegion.findUnique.mockResolvedValueOnce(null)

      const server = app()
      const res = await server.handle(
        jsonRequest("http://localhost/admin/regions/non-existent", "DELETE")
      )
      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns 409 conflict when region is referenced by clusters", async () => {
      db.serviceRegion.findUnique.mockResolvedValueOnce(mockRegion)
      db.appHostingCluster.count.mockResolvedValueOnce(2)
      db.servicePricing.count.mockResolvedValueOnce(0)

      const server = app()
      const res = await server.handle(
        jsonRequest("http://localhost/admin/regions/region-1", "DELETE")
      )
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("CONFLICT")
      expect(body.message).toContain("2 app hosting cluster(s)")
    })

    it("returns 409 conflict when region is referenced by active pricings", async () => {
      db.serviceRegion.findUnique.mockResolvedValueOnce(mockRegion)
      db.appHostingCluster.count.mockResolvedValueOnce(0)
      db.servicePricing.count.mockResolvedValueOnce(3)

      const server = app()
      const res = await server.handle(
        jsonRequest("http://localhost/admin/regions/region-1", "DELETE")
      )
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("CONFLICT")
      expect(body.message).toContain("3 active pricing plan(s)")
    })

    it("returns 409 conflict when referenced by both clusters and active pricings", async () => {
      db.serviceRegion.findUnique.mockResolvedValueOnce(mockRegion)
      db.appHostingCluster.count.mockResolvedValueOnce(1)
      db.servicePricing.count.mockResolvedValueOnce(2)

      const server = app()
      const res = await server.handle(
        jsonRequest("http://localhost/admin/regions/region-1", "DELETE")
      )
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("CONFLICT")
      expect(body.message).toContain(
        "Cannot delete region because it is referenced by 1 app hosting cluster(s) and 2 active pricing plan(s)."
      )
    })

    it("deletes unreferenced region successfully", async () => {
      db.serviceRegion.findUnique.mockResolvedValueOnce(mockRegion)
      db.appHostingCluster.count.mockResolvedValueOnce(0)
      db.servicePricing.count.mockResolvedValueOnce(0)
      db.serviceRegion.delete.mockResolvedValueOnce(mockRegion)

      const server = app()
      const res = await server.handle(
        jsonRequest("http://localhost/admin/regions/region-1", "DELETE")
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.id).toBe("region-1")
      expect(db.serviceRegion.delete).toHaveBeenCalledWith({
        where: { id: "region-1" },
      })
    })
  })
})
