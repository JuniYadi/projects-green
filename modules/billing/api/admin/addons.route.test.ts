import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import { createAdminAddonsRoutes } from "./addons.route"

import {
  AddonNotFoundError,
  AddonConflictError,
  PlanAttachmentNotFoundError,
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

describe("admin addons routes", () => {
  beforeEach(() => {
    mock.clearAllMocks()
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
        displayOrder: 0,
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
})
