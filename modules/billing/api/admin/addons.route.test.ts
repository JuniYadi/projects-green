import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import { createAdminAddonsRoutes } from "./addons.route"

import {
  AddonNotFoundError,
  AddonConflictError,
  PlanAttachmentNotFoundError,
  PlanNotFoundError,
} from "../../addons/addons.service"

type AdminGuardResult =
  | {
      ok: true
      userId: string
      platformRole: "super_admin"
    }
  | {
      ok: false
      error: string
      message: string
    }

const guard = mock(
  async (set: { status?: number | string }): Promise<AdminGuardResult> => {
    if (set) set.status = 200
    return {
      ok: true,
      userId: "admin-1",
      platformRole: "super_admin",
    }
  }
)

const mockPrisma = {
  servicePlanAddon: {
    findMany: mock(),
    count: mock(),
  },
}

const mockAddonsService = {
  listAddons: mock(),
  getAddon: mock(),
  createAddon: mock(),
  updateAddon: mock(),
  deactivateAddon: mock(),
  listPlanAttachments: mock(),
  getPlanAttachment: mock(),
  attachAddonToPlan: mock(),
  updatePlanAttachment: mock(),
  detachAddonFromPlan: mock(),
}

function app() {
  return new Elysia()
    .use(
      createAdminAddonsRoutes({
        requireSuperAdmin: guard,
        addonsService: mockAddonsService as never,
        prisma: mockPrisma as never,
      })
    )
    .compile()
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}
function denyGuard() {
  guard.mockImplementationOnce(
    async (set: { status?: number | string }): Promise<AdminGuardResult> => {
      set.status = 403
      return {
        ok: false as const,
        error: "FORBIDDEN",
        message: "Super admin access required.",
      }
    }
  )
}

describe("admin addons routes", () => {
  beforeEach(() => {
    mock.clearAllMocks()
    mockAddonsService.listAddons.mockReset()
    mockAddonsService.getAddon.mockReset()
    mockAddonsService.createAddon.mockReset()
    mockAddonsService.updateAddon.mockReset()
    mockAddonsService.deactivateAddon.mockReset()
    mockAddonsService.listPlanAttachments.mockReset()
    mockAddonsService.getPlanAttachment.mockReset()
    mockAddonsService.attachAddonToPlan.mockReset()
    mockAddonsService.updatePlanAttachment.mockReset()
    mockAddonsService.detachAddonFromPlan.mockReset()
    mockPrisma.servicePlanAddon.findMany.mockReset()
    mockPrisma.servicePlanAddon.count.mockReset()
    guard.mockReset()
    mockAddonsService.listAddons.mockResolvedValue(undefined)
    mockAddonsService.getAddon.mockResolvedValue(null)
    mockAddonsService.createAddon.mockResolvedValue(undefined)
    mockAddonsService.updateAddon.mockResolvedValue(undefined)
    mockAddonsService.deactivateAddon.mockResolvedValue(undefined)
    mockAddonsService.listPlanAttachments.mockResolvedValue(undefined)
    mockAddonsService.getPlanAttachment.mockResolvedValue(null)
    mockAddonsService.attachAddonToPlan.mockResolvedValue(undefined)
    mockAddonsService.updatePlanAttachment.mockResolvedValue(undefined)
    mockAddonsService.detachAddonFromPlan.mockResolvedValue(undefined)
    mockPrisma.servicePlanAddon.findMany.mockResolvedValue([])
    mockPrisma.servicePlanAddon.count.mockResolvedValue(0)
    guard.mockResolvedValue({
      ok: true as const,
      userId: "admin-1",
      platformRole: "super_admin" as const,
    })
  })

  describe("GET /billing/admin/addons", () => {
    it("returns a paginated list of addons", async () => {
      const result = {
        addons: [
          {
            id: "addon-1",
            code: "EXTRA_SEATS",
            name: "Extra Seats",
            description: null,
            billingMode: "RECURRING",
            isActive: true,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            prices: [
              {
                id: "price-1",
                billingPeriod: "MONTHLY",
                periodMonths: 1,
                amount: "50000",
                currency: "IDR",
                effectiveFrom: "2026-01-01T00:00:00.000Z",
                effectiveTo: null,
                isActive: true,
              },
            ],
          },
        ],
        currency: "IDR",
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }

      mockAddonsService.listAddons.mockResolvedValueOnce(result)

      const response = await app().handle(
        new Request("http://localhost/admin/addons?currency=IDR")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.addons[0].code).toBe("EXTRA_SEATS")
      expect(body.addons[0].prices[0].periodMonths).toBe(1)
      expect(body.pagination.total).toBe(1)
      expect(mockAddonsService.listAddons).toHaveBeenCalledWith({
        currency: "IDR",
        page: 1,
        limit: 20,
        search: undefined,
        billingMode: undefined,
        isActive: undefined,
      })
    })

    it("returns 401 when guard fails", async () => {
      guard.mockImplementationOnce(
        async (set: {
          status?: number | string
        }): Promise<AdminGuardResult> => {
          if (set) set.status = 401
          return {
            ok: false as const,
            error: "UNAUTHORIZED",
            message: "You must be signed in.",
          } as const
        }
      )

      const response = await app().handle(
        new Request("http://localhost/admin/addons")
      )

      expect(response.status).toBe(401)
    })
  })

  describe("GET /billing/admin/addons/:code", () => {
    it("returns addon detail by code", async () => {
      mockAddonsService.getAddon.mockResolvedValueOnce({
        addon: {
          id: "addon-1",
          code: "EXTRA_SEATS",
          name: "Extra Seats",
          description: null,
          billingMode: "RECURRING",
          isActive: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          prices: [],
        },
      })

      const response = await app().handle(
        new Request("http://localhost/admin/addons/EXTRA_SEATS?currency=IDR")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.addon.code).toBe("EXTRA_SEATS")
      expect(mockAddonsService.getAddon).toHaveBeenCalledWith({
        currency: "IDR",
        code: "EXTRA_SEATS",
      })
    })

    it("returns 404 when addon not found", async () => {
      mockAddonsService.getAddon.mockResolvedValueOnce(null)

      const response = await app().handle(
        new Request("http://localhost/admin/addons/UNKNOWN?currency=IDR")
      )

      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("NOT_FOUND")
    })
  })

  describe("POST /billing/admin/addons", () => {
    it("creates a new addon", async () => {
      const input = {
        code: "EXTRA_SEATS",
        name: "Extra Seats",
        billingMode: "RECURRING",
        prices: [
          {
            billingPeriod: "MONTHLY",
            currency: "IDR",
            amount: 50000,
          },
        ],
      }

      mockAddonsService.createAddon.mockResolvedValueOnce({
        id: "addon-1",
        code: "EXTRA_SEATS",
        name: "Extra Seats",
        description: null,
        billingMode: "RECURRING",
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        prices: [
          {
            id: "price-1",
            billingPeriod: "MONTHLY",
            periodMonths: 1,
            amount: "50000",
            currency: "IDR",
            effectiveFrom: "2026-01-01T00:00:00.000Z",
            effectiveTo: null,
            isActive: true,
          },
        ],
      })

      const response = await app().handle(
        jsonRequest("http://localhost/admin/addons", "POST", input)
      )

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.addon.code).toBe("EXTRA_SEATS")
      expect(mockAddonsService.createAddon).toHaveBeenCalledWith({
        ...input,
        isActive: true,
      })
    })

    it("returns 409 when addon code already exists", async () => {
      const input = {
        code: "EXTRA_SEATS",
        name: "Extra Seats",
        billingMode: "RECURRING",
        prices: [{ billingPeriod: "MONTHLY", currency: "IDR", amount: 50000 }],
      }

      mockAddonsService.createAddon.mockRejectedValueOnce(
        new AddonConflictError('Addon with code "EXTRA_SEATS" already exists.')
      )

      const response = await app().handle(
        jsonRequest("http://localhost/admin/addons", "POST", input)
      )

      expect(response.status).toBe(409)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("CONFLICT")
    })
  })

  describe("PATCH /billing/admin/addons/:id", () => {
    it("updates an addon", async () => {
      mockAddonsService.updateAddon.mockResolvedValueOnce({
        id: "addon-1",
        code: "EXTRA_SEATS",
        name: "Extra Seats Updated",
        description: "Updated description",
        billingMode: "RECURRING",
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
        prices: [],
      })

      const response = await app().handle(
        jsonRequest("http://localhost/admin/addons/addon-1", "PATCH", {
          name: "Extra Seats Updated",
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.addon.name).toBe("Extra Seats Updated")
    })

    it("returns 404 when addon not found", async () => {
      mockAddonsService.updateAddon.mockRejectedValueOnce(
        new AddonNotFoundError('Addon with id "addon-1" not found.')
      )

      const response = await app().handle(
        jsonRequest("http://localhost/admin/addons/addon-1", "PATCH", {
          name: "Test",
        })
      )

      expect(response.status).toBe(404)
    })
  })

  describe("DELETE /billing/admin/addons/:id", () => {
    it("deactivates an addon (204)", async () => {
      mockAddonsService.deactivateAddon.mockResolvedValueOnce(undefined)

      const response = await app().handle(
        new Request("http://localhost/admin/addons/addon-1", {
          method: "DELETE",
        })
      )

      expect(response.status).toBe(204)
    })

    it("returns 404 when addon not found", async () => {
      mockAddonsService.deactivateAddon.mockRejectedValueOnce(
        new AddonNotFoundError('Addon with id "addon-1" not found.')
      )

      const response = await app().handle(
        new Request("http://localhost/admin/addons/addon-1", {
          method: "DELETE",
        })
      )

      expect(response.status).toBe(404)
    })

    it("returns 409 when addon is required on plans", async () => {
      mockAddonsService.deactivateAddon.mockRejectedValueOnce(
        new AddonConflictError(
          'Cannot deactivate addon "EXTRA_SEATS" because it is required on 2 plan(s).'
        )
      )

      const response = await app().handle(
        new Request("http://localhost/admin/addons/addon-1", {
          method: "DELETE",
        })
      )

      expect(response.status).toBe(409)
    })
  })

  describe("GET /billing/admin/plans/:planId/addons", () => {
    it("returns addon attachments for a plan", async () => {
      mockAddonsService.listPlanAttachments.mockResolvedValueOnce({
        attachments: [
          {
            id: "attach-1",
            planId: "plan-1",
            planCode: "PLAN_BASIC",
            packageCode: "WHATSAPP",
            addonId: "addon-1",
            addonCode: "EXTRA_SEATS",
            addonName: "Extra Seats",
            label: "Extra",
            description: null,
            isRequired: false,
            displayOrder: 0,
            enabledTerms: null,
            isActive: true,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      })

      const response = await app().handle(
        new Request("http://localhost/admin/plans/plan-1/addons")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.attachments[0].addonCode).toBe("EXTRA_SEATS")
      expect(mockAddonsService.listPlanAttachments).toHaveBeenCalledWith({
        planId: "plan-1",
        page: 1,
        limit: 20,
        isActive: undefined,
      })
    })
  })

  describe("POST /billing/admin/plans/:planId/addons", () => {
    it("attaches an addon to a plan", async () => {
      mockAddonsService.attachAddonToPlan.mockResolvedValueOnce({
        id: "attach-1",
        planId: "plan-1",
        planCode: "PLAN_BASIC",
        packageCode: "WHATSAPP",
        addonId: "addon-1",
        addonCode: "EXTRA_SEATS",
        addonName: "Extra Seats",
        label: null,
        description: null,
        isRequired: false,
        displayOrder: 0,
        enabledTerms: null,
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      })

      const input = {
        planId: "plan-1",
        addonId: "addon-1",
        label: "Extra seats",
        isRequired: false,
      }

      const response = await app().handle(
        jsonRequest("http://localhost/admin/plans/plan-1/addons", "POST", input)
      )

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.attachment.addonCode).toBe("EXTRA_SEATS")
      expect(mockAddonsService.attachAddonToPlan).toHaveBeenCalledWith({
        ...input,
        displayOrder: 0,
        isActive: true,
      })
    })

    it("returns 409 when addon already attached", async () => {
      mockAddonsService.attachAddonToPlan.mockRejectedValueOnce(
        new AddonConflictError(
          'Addon "EXTRA_SEATS" is already attached to plan "PLAN_BASIC".'
        )
      )

      const input = { planId: "plan-1", addonId: "addon-1" }

      const response = await app().handle(
        jsonRequest("http://localhost/admin/plans/plan-1/addons", "POST", input)
      )

      expect(response.status).toBe(409)
    })
  })

  describe("DELETE /billing/admin/plans/:planId/addons/:id", () => {
    it("detaches an addon from a plan (204)", async () => {
      mockAddonsService.detachAddonFromPlan.mockResolvedValueOnce(undefined)

      const response = await app().handle(
        new Request("http://localhost/admin/plans/plan-1/addons/attach-1", {
          method: "DELETE",
        })
      )

      expect(response.status).toBe(204)
      expect(mockAddonsService.detachAddonFromPlan).toHaveBeenCalledWith(
        "attach-1"
      )
    })

    it("returns 404 when attachment not found", async () => {
      mockAddonsService.detachAddonFromPlan.mockRejectedValueOnce(
        new PlanAttachmentNotFoundError(
          'Plan addon attachment with id "attach-1" not found.'
        )
      )

      const response = await app().handle(
        new Request("http://localhost/admin/plans/plan-1/addons/attach-1", {
          method: "DELETE",
        })
      )

      expect(response.status).toBe(404)
    })
  })
  it("returns 400 for invalid addon list query", async () => {
    const response = await app().handle(
      new Request("http://localhost/admin/addons?limit=0")
    )

    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe("BAD_REQUEST")
    expect(mockAddonsService.listAddons).not.toHaveBeenCalled()
  })

  it("returns 500 when addon list fails", async () => {
    mockAddonsService.listAddons.mockRejectedValueOnce(new Error("database"))

    const response = await app().handle(
      new Request("http://localhost/admin/addons")
    )

    expect(response.status).toBe(500)
    expect((await response.json()).message).toBe("Unable to load addons.")
  })

  it("denies detail access when the guard rejects", async () => {
    denyGuard()

    const response = await app().handle(
      new Request("http://localhost/admin/addons/EXTRA_SEATS")
    )

    expect(response.status).toBe(403)
    expect(mockAddonsService.getAddon).not.toHaveBeenCalled()
  })

  it("returns 500 when addon detail fails", async () => {
    mockAddonsService.getAddon.mockRejectedValueOnce(new Error("database"))

    const response = await app().handle(
      new Request("http://localhost/admin/addons/EXTRA_SEATS")
    )

    expect(response.status).toBe(500)
    expect((await response.json()).message).toBe("Unable to load addon.")
  })

  it("returns 400 for invalid addon creation input", async () => {
    const response = await app().handle(
      jsonRequest("http://localhost/admin/addons", "POST", {
        code: "lowercase",
        name: "",
        prices: [],
      })
    )

    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe("BAD_REQUEST")
    expect(mockAddonsService.createAddon).not.toHaveBeenCalled()
  })

  it("returns 500 when addon creation fails unexpectedly", async () => {
    mockAddonsService.createAddon.mockRejectedValueOnce(new Error("database"))

    const response = await app().handle(
      jsonRequest("http://localhost/admin/addons", "POST", {
        code: "EXTRA_SEATS",
        name: "Extra Seats",
        prices: [{ billingPeriod: "MONTHLY", currency: "IDR", amount: 1 }],
      })
    )

    expect(response.status).toBe(500)
    expect((await response.json()).message).toBe("Unable to create addon.")
  })

  it("denies addon creation when the guard rejects", async () => {
    denyGuard()

    const response = await app().handle(
      jsonRequest("http://localhost/admin/addons", "POST", {})
    )

    expect(response.status).toBe(403)
    expect(mockAddonsService.createAddon).not.toHaveBeenCalled()
  })

  it("returns 409 when addon update conflicts", async () => {
    mockAddonsService.updateAddon.mockRejectedValueOnce(
      new AddonConflictError("code already exists")
    )

    const response = await app().handle(
      jsonRequest("http://localhost/admin/addons/addon-1", "PATCH", {
        name: "Updated",
      })
    )

    expect(response.status).toBe(409)
    expect((await response.json()).error).toBe("CONFLICT")
  })

  it("returns 400 for an invalid addon update", async () => {
    const response = await app().handle(
      jsonRequest("http://localhost/admin/addons/addon-1", "PATCH", {
        name: 123,
      })
    )

    expect(response.status).toBe(400)
    expect(mockAddonsService.updateAddon).not.toHaveBeenCalled()
  })

  it("returns 500 when addon update fails unexpectedly", async () => {
    mockAddonsService.updateAddon.mockRejectedValueOnce(new Error("database"))

    const response = await app().handle(
      jsonRequest("http://localhost/admin/addons/addon-1", "PATCH", {
        name: "Updated",
      })
    )

    expect(response.status).toBe(500)
    expect((await response.json()).message).toBe("Unable to update addon.")
  })

  it("denies addon updates when the guard rejects", async () => {
    denyGuard()

    const response = await app().handle(
      jsonRequest("http://localhost/admin/addons/addon-1", "PATCH", {
        name: "Updated",
      })
    )

    expect(response.status).toBe(403)
    expect(mockAddonsService.updateAddon).not.toHaveBeenCalled()
  })

  it("returns 500 when addon deactivation fails unexpectedly", async () => {
    mockAddonsService.deactivateAddon.mockRejectedValueOnce(
      new Error("database")
    )

    const response = await app().handle(
      new Request("http://localhost/admin/addons/addon-1", {
        method: "DELETE",
      })
    )

    expect(response.status).toBe(500)
    expect((await response.json()).message).toBe("Unable to deactivate addon.")
  })

  it("denies addon deactivation when the guard rejects", async () => {
    denyGuard()

    const response = await app().handle(
      new Request("http://localhost/admin/addons/addon-1", {
        method: "DELETE",
      })
    )

    expect(response.status).toBe(403)
    expect(mockAddonsService.deactivateAddon).not.toHaveBeenCalled()
  })

  it("maps addon plan rows and pagination", async () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z")
    const updatedAt = new Date("2026-01-02T00:00:00.000Z")
    mockPrisma.servicePlanAddon.findMany.mockResolvedValueOnce([
      {
        id: "attach-1",
        label: "Extra",
        description: null,
        isRequired: true,
        displayOrder: 2,
        enabledTerms: { seats: 10 },
        isActive: true,
        createdAt,
        updatedAt,
        plan: { id: "plan-1", code: "PLAN_BASIC", package: { code: "WA" } },
        addon: { id: "addon-1", code: "EXTRA_SEATS", name: "Extra Seats" },
      },
    ])
    mockPrisma.servicePlanAddon.count.mockResolvedValueOnce(3)

    const response = await app().handle(
      new Request(
        "http://localhost/admin/addons/EXTRA_SEATS/plans?page=2&limit=2"
      )
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.attachments[0]).toEqual({
      id: "attach-1",
      planId: "plan-1",
      planCode: "PLAN_BASIC",
      packageCode: "WA",
      addonId: "addon-1",
      addonCode: "EXTRA_SEATS",
      addonName: "Extra Seats",
      label: "Extra",
      description: null,
      isRequired: true,
      displayOrder: 2,
      enabledTerms: { seats: 10 },
      isActive: true,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    })
    expect(body.pagination).toEqual({
      page: 2,
      limit: 2,
      total: 3,
      totalPages: 2,
    })
    expect(mockPrisma.servicePlanAddon.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { addon: { code: "EXTRA_SEATS" } },
        skip: 2,
        take: 2,
      })
    )
  })

  it("returns 400 for invalid addon plan query", async () => {
    const response = await app().handle(
      new Request("http://localhost/admin/addons/EXTRA_SEATS/plans?limit=0")
    )

    expect(response.status).toBe(400)
    expect(mockPrisma.servicePlanAddon.findMany).not.toHaveBeenCalled()
  })

  it("returns 500 when addon plan lookup fails", async () => {
    mockPrisma.servicePlanAddon.findMany.mockRejectedValueOnce(
      new Error("database")
    )

    const response = await app().handle(
      new Request("http://localhost/admin/addons/EXTRA_SEATS/plans")
    )

    expect(response.status).toBe(500)
    expect((await response.json()).message).toBe(
      "Unable to load plan attachments."
    )
  })

  it("denies addon plan lookup when the guard rejects", async () => {
    denyGuard()

    const response = await app().handle(
      new Request("http://localhost/admin/addons/EXTRA_SEATS/plans")
    )

    expect(response.status).toBe(403)
    expect(mockPrisma.servicePlanAddon.findMany).not.toHaveBeenCalled()
  })

  it("returns 400 for invalid plan addon list query", async () => {
    const response = await app().handle(
      new Request("http://localhost/admin/plans/plan-1/addons?limit=0")
    )

    expect(response.status).toBe(400)
    expect(mockAddonsService.listPlanAttachments).not.toHaveBeenCalled()
  })

  it("returns 500 when plan addon list fails", async () => {
    mockAddonsService.listPlanAttachments.mockRejectedValueOnce(
      new Error("database")
    )

    const response = await app().handle(
      new Request("http://localhost/admin/plans/plan-1/addons")
    )

    expect(response.status).toBe(500)
    expect((await response.json()).message).toBe("Unable to load plan addons.")
  })

  it("denies plan addon list access when the guard rejects", async () => {
    denyGuard()

    const response = await app().handle(
      new Request("http://localhost/admin/plans/plan-1/addons")
    )

    expect(response.status).toBe(403)
    expect(mockAddonsService.listPlanAttachments).not.toHaveBeenCalled()
  })

  it("returns plan addon attachment detail", async () => {
    mockAddonsService.getPlanAttachment.mockResolvedValueOnce({
      attachment: {
        id: "attach-1",
        planId: "plan-1",
        planCode: "PLAN_BASIC",
        packageCode: "WA",
        addonId: "addon-1",
        addonCode: "EXTRA_SEATS",
        addonName: "Extra Seats",
        label: null,
        description: null,
        isRequired: false,
        displayOrder: 0,
        enabledTerms: null,
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    })

    const response = await app().handle(
      new Request("http://localhost/admin/plans/plan-1/addons/attach-1")
    )

    expect(response.status).toBe(200)
    expect((await response.json()).attachment.id).toBe("attach-1")
    expect(mockAddonsService.getPlanAttachment).toHaveBeenCalledWith("attach-1")
  })

  it("returns 500 when plan addon detail fails", async () => {
    mockAddonsService.getPlanAttachment.mockRejectedValueOnce(
      new Error("database")
    )

    const response = await app().handle(
      new Request("http://localhost/admin/plans/plan-1/addons/attach-1")
    )

    expect(response.status).toBe(500)
    expect((await response.json()).message).toBe(
      "Unable to load plan addon attachment."
    )
  })

  it("denies plan addon detail access when the guard rejects", async () => {
    denyGuard()

    const response = await app().handle(
      new Request("http://localhost/admin/plans/plan-1/addons/attach-1")
    )

    expect(response.status).toBe(403)
    expect(mockAddonsService.getPlanAttachment).not.toHaveBeenCalled()
  })

  it("maps plan-not-found when attaching an addon", async () => {
    mockAddonsService.attachAddonToPlan.mockRejectedValueOnce(
      new PlanNotFoundError("Plan not found")
    )

    const response = await app().handle(
      jsonRequest("http://localhost/admin/plans/plan-1/addons", "POST", {
        planId: "plan-1",
        addonId: "addon-1",
      })
    )

    expect(response.status).toBe(404)
    expect((await response.json()).error).toBe("NOT_FOUND")
  })

  it("maps addon-not-found when attaching an addon", async () => {
    mockAddonsService.attachAddonToPlan.mockRejectedValueOnce(
      new AddonNotFoundError("Addon not found")
    )

    const response = await app().handle(
      jsonRequest("http://localhost/admin/plans/plan-1/addons", "POST", {
        planId: "plan-1",
        addonId: "addon-1",
      })
    )

    expect(response.status).toBe(404)
  })

  it("returns 400 for invalid addon attachment input", async () => {
    const response = await app().handle(
      jsonRequest("http://localhost/admin/plans/plan-1/addons", "POST", {})
    )

    expect(response.status).toBe(400)
    expect(mockAddonsService.attachAddonToPlan).not.toHaveBeenCalled()
  })

  it("returns 500 when addon attachment fails unexpectedly", async () => {
    mockAddonsService.attachAddonToPlan.mockRejectedValueOnce(
      new Error("database")
    )

    const response = await app().handle(
      jsonRequest("http://localhost/admin/plans/plan-1/addons", "POST", {
        planId: "plan-1",
        addonId: "addon-1",
      })
    )

    expect(response.status).toBe(500)
    expect((await response.json()).message).toBe(
      "Unable to attach addon to plan."
    )
  })

  it("denies addon attachment when the guard rejects", async () => {
    denyGuard()

    const response = await app().handle(
      jsonRequest("http://localhost/admin/plans/plan-1/addons", "POST", {})
    )

    expect(response.status).toBe(403)
    expect(mockAddonsService.attachAddonToPlan).not.toHaveBeenCalled()
  })

  it("updates a plan addon attachment", async () => {
    mockAddonsService.updatePlanAttachment.mockResolvedValueOnce({
      id: "attach-1",
      planId: "plan-1",
      planCode: "PLAN_BASIC",
      packageCode: "WA",
      addonId: "addon-1",
      addonCode: "EXTRA_SEATS",
      addonName: "Extra Seats",
      label: "Updated",
      description: null,
      isRequired: true,
      displayOrder: 3,
      enabledTerms: null,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    })
    const input = { label: "Updated", isRequired: true }

    const response = await app().handle(
      jsonRequest(
        "http://localhost/admin/plans/plan-1/addons/attach-1",
        "PATCH",
        input
      )
    )

    expect(response.status).toBe(200)
    expect((await response.json()).attachment.label).toBe("Updated")
    expect(mockAddonsService.updatePlanAttachment).toHaveBeenCalledWith(
      "attach-1",
      { ...input, displayOrder: 0, isActive: true }
    )
  })

  it("returns 404 when updating a missing plan addon attachment", async () => {
    mockAddonsService.updatePlanAttachment.mockRejectedValueOnce(
      new PlanAttachmentNotFoundError("Attachment not found")
    )

    const response = await app().handle(
      jsonRequest(
        "http://localhost/admin/plans/plan-1/addons/attach-1",
        "PATCH",
        {
          label: "Updated",
        }
      )
    )

    expect(response.status).toBe(404)
  })

  it("returns 400 for an invalid plan addon update", async () => {
    const response = await app().handle(
      jsonRequest(
        "http://localhost/admin/plans/plan-1/addons/attach-1",
        "PATCH",
        {
          label: 123,
        }
      )
    )

    expect(response.status).toBe(400)
    expect(mockAddonsService.updatePlanAttachment).not.toHaveBeenCalled()
  })

  it("returns 500 when plan addon update fails unexpectedly", async () => {
    mockAddonsService.updatePlanAttachment.mockRejectedValueOnce(
      new Error("database")
    )

    const response = await app().handle(
      jsonRequest(
        "http://localhost/admin/plans/plan-1/addons/attach-1",
        "PATCH",
        {
          label: "Updated",
        }
      )
    )

    expect(response.status).toBe(500)
    expect((await response.json()).message).toBe(
      "Unable to update plan addon attachment."
    )
  })

  it("denies plan addon updates when the guard rejects", async () => {
    denyGuard()

    const response = await app().handle(
      jsonRequest(
        "http://localhost/admin/plans/plan-1/addons/attach-1",
        "PATCH",
        {}
      )
    )

    expect(response.status).toBe(403)
    expect(mockAddonsService.updatePlanAttachment).not.toHaveBeenCalled()
  })

  it("returns 409 when detaching a required plan addon is blocked", async () => {
    mockAddonsService.detachAddonFromPlan.mockRejectedValueOnce(
      new AddonConflictError("active subscription")
    )

    const response = await app().handle(
      new Request("http://localhost/admin/plans/plan-1/addons/attach-1", {
        method: "DELETE",
      })
    )

    expect(response.status).toBe(409)
  })

  it("returns 500 when detaching a plan addon fails unexpectedly", async () => {
    mockAddonsService.detachAddonFromPlan.mockRejectedValueOnce(
      new Error("database")
    )

    const response = await app().handle(
      new Request("http://localhost/admin/plans/plan-1/addons/attach-1", {
        method: "DELETE",
      })
    )

    expect(response.status).toBe(500)
    expect((await response.json()).message).toBe(
      "Unable to detach addon from plan."
    )
  })

  it("denies plan addon detachment when the guard rejects", async () => {
    denyGuard()

    const response = await app().handle(
      new Request("http://localhost/admin/plans/plan-1/addons/attach-1", {
        method: "DELETE",
      })
    )

    expect(response.status).toBe(403)
    expect(mockAddonsService.detachAddonFromPlan).not.toHaveBeenCalled()
  })
})
