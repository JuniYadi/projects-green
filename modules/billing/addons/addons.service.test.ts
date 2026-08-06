import { describe, expect, it, mock, beforeEach } from "bun:test"
import { Prisma } from "@prisma/client"

mock.module("@/lib/prisma", () => ({
  prisma: {
    serviceAddon: {
      findMany: mock(),
      findUnique: mock(),
      findFirst: mock(),
      create: mock(),
      update: mock(),
      count: mock(),
    },
    serviceAddonPricing: {
      create: mock(),
      update: mock(),
      updateMany: mock(),
      delete: mock(),
      deleteMany: mock(),
    },
    servicePlanAddon: {
      findMany: mock(),
      findUnique: mock(),
      findFirst: mock(),
      create: mock(),
      update: mock(),
      delete: mock(),
      count: mock(),
    },
    serviceSubscriptionAddon: {
      count: mock(),
    },
    servicePlan: { findUnique: mock() },
    $transaction: mock(async (fn: (tx: unknown) => unknown) => fn({})),
  },
}))

import { AddonsService } from "./addons.service"

const mockDb = {
  serviceAddon: {
    findMany: mock(),
    findUnique: mock(),
    findFirst: mock(),
    create: mock(),
    update: mock(),
    count: mock(),
  },
  serviceAddonPricing: {
    create: mock(),
    update: mock(),
    updateMany: mock(),
    delete: mock(),
    deleteMany: mock(),
  },
  servicePlanAddon: {
    findMany: mock(),
    findUnique: mock(),
    findFirst: mock(),
    create: mock(),
    update: mock(),
    delete: mock(),
    count: mock(),
  },
  serviceSubscriptionAddon: {
    count: mock(),
  },
  servicePlan: { findUnique: mock() },
  $transaction: mock(async (fn: (tx: unknown) => unknown) => fn({})),
}

const addonRecord = {
  id: "addon-1",
  code: "EXTRA_SEATS",
  name: "Extra Seats",
  description: "Additional seats",
  billingMode: "RECURRING",
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  prices: [
    {
      id: "price-1",
      addonId: "addon-1",
      billingPeriod: "MONTHLY",
      currency: "IDR",
      amount: new Prisma.Decimal("50000"),
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      effectiveTo: null,
      isActive: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  ],
}

const attachmentRecord = {
  id: "attach-1",
  planId: "plan-1",
  addonId: "addon-1",
  label: "Extra Label",
  description: null,
  isRequired: false,
  displayOrder: 0,
  enabledTerms: null,
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  plan: {
    id: "plan-1",
    code: "PLAN_BASIC",
    package: { code: "WHATSAPP" },
  },
  addon: {
    id: "addon-1",
    code: "EXTRA_SEATS",
    name: "Extra Seats",
  },
}

describe("AddonsService", () => {
  let service: AddonsService

  beforeEach(() => {
    mockDb.serviceAddon.findMany.mockReset()
    mockDb.serviceAddon.findUnique.mockReset()
    mockDb.serviceAddon.create.mockReset()
    mockDb.serviceAddon.update.mockReset()
    mockDb.serviceAddon.count.mockReset()
    mockDb.servicePlanAddon.findMany.mockReset()
    mockDb.servicePlanAddon.findUnique.mockReset()
    mockDb.servicePlanAddon.findFirst.mockReset()
    mockDb.servicePlanAddon.create.mockReset()
    mockDb.servicePlanAddon.update.mockReset()
    mockDb.servicePlanAddon.delete.mockReset()
    mockDb.servicePlanAddon.count.mockReset()
    mockDb.serviceSubscriptionAddon.count.mockReset()
    mockDb.servicePlan.findUnique.mockReset()
    mockDb.serviceAddon.findMany.mockResolvedValue([])
    mockDb.serviceAddon.findUnique.mockResolvedValue(null)
    mockDb.serviceAddon.count.mockResolvedValue(0)
    mockDb.servicePlanAddon.findMany.mockResolvedValue([])
    mockDb.servicePlanAddon.findUnique.mockResolvedValue(null)
    mockDb.servicePlanAddon.findFirst.mockResolvedValue(null)
    mockDb.servicePlanAddon.count.mockResolvedValue(0)
    mockDb.serviceSubscriptionAddon.count.mockResolvedValue(0)
    mockDb.servicePlan.findUnique.mockResolvedValue(null)
    service = new AddonsService({ prisma: mockDb as never })
  })

  describe("listAddons", () => {
    it("returns paginated active addons with currency-scoped prices", async () => {
      mockDb.serviceAddon.findMany.mockResolvedValueOnce([addonRecord])
      mockDb.serviceAddon.count.mockResolvedValueOnce(1)

      const result = await service.listAddons({ currency: "IDR" })

      expect(result.addons).toHaveLength(1)
      expect(result.addons[0].code).toBe("EXTRA_SEATS")
      expect(result.currency).toBe("IDR")
      expect(result.pagination.total).toBe(1)
      expect(mockDb.serviceAddon.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({}),
          include: expect.objectContaining({
            prices: expect.objectContaining({
              where: expect.objectContaining({
                currency: "IDR",
                isActive: true,
              }),
            }),
          }),
        })
      )
    })

    it("filters by search, billingMode, and isActive", async () => {
      mockDb.serviceAddon.findMany.mockResolvedValueOnce([])
      mockDb.serviceAddon.count.mockResolvedValueOnce(0)

      await service.listAddons({
        currency: "IDR",
        search: "extra",
        billingMode: "RECURRING",
        isActive: true,
      })

      expect(mockDb.serviceAddon.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
            billingMode: "RECURRING",
            isActive: true,
          }),
        })
      )
    })

    it("applies pagination skip and take", async () => {
      mockDb.serviceAddon.findMany.mockResolvedValueOnce([])
      mockDb.serviceAddon.count.mockResolvedValueOnce(0)

      await service.listAddons({ currency: "IDR", page: 3, limit: 10 })

      expect(mockDb.serviceAddon.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      )
    })
  })

  describe("getAddon", () => {
    it("returns null when addon not found", async () => {
      mockDb.serviceAddon.findUnique.mockResolvedValueOnce(null)

      const result = await service.getAddon({
        currency: "IDR",
        code: "UNKNOWN",
      })
      expect(result).toBeNull()
    })

    it("returns addon with filtered prices", async () => {
      mockDb.serviceAddon.findUnique.mockResolvedValueOnce(addonRecord)

      const result = await service.getAddon({
        currency: "IDR",
        code: "EXTRA_SEATS",
      })
      expect(result).not.toBeNull()
      expect(result!.addon.code).toBe("EXTRA_SEATS")
      expect(result!.addon.prices).toHaveLength(1)
    })
  })

  describe("createAddon", () => {
    it("creates an addon with prices", async () => {
      mockDb.serviceAddon.findUnique.mockResolvedValueOnce(null)
      mockDb.serviceAddon.create.mockResolvedValueOnce(addonRecord)

      const result = await service.createAddon({
        code: "EXTRA_SEATS",
        name: "Extra Seats",
        billingMode: "RECURRING",
        isActive: true,
        prices: [{ billingPeriod: "MONTHLY", currency: "IDR", amount: 50000 }],
      })

      expect(result.code).toBe("EXTRA_SEATS")
      expect(result.prices).toHaveLength(1)
      expect(mockDb.serviceAddon.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: "EXTRA_SEATS",
            prices: expect.objectContaining({
              create: expect.arrayContaining([
                expect.objectContaining({
                  billingPeriod: "MONTHLY",
                  currency: "IDR",
                  amount: new Prisma.Decimal(50000),
                }),
              ]),
            }),
          }),
        })
      )
    })

    it("throws AddonConflictError when code already exists", async () => {
      mockDb.serviceAddon.findUnique.mockResolvedValueOnce(addonRecord)

      await expect(
        service.createAddon({
          code: "EXTRA_SEATS",
          name: "Extra Seats",
          billingMode: "RECURRING",
          isActive: true,
          prices: [
            { billingPeriod: "MONTHLY", currency: "IDR", amount: 50000 },
          ],
        })
      ).rejects.toThrow("already exists")
    })
  })

  describe("updateAddon", () => {
    it("throws AddonNotFoundError when addon does not exist", async () => {
      mockDb.serviceAddon.findUnique.mockResolvedValueOnce(null)

      await expect(
        service.updateAddon("unknown-id", { name: "Updated" })
      ).rejects.toThrow("not found")
    })

    it("updates addon fields and prices", async () => {
      mockDb.serviceAddon.findUnique.mockResolvedValueOnce(addonRecord)
      mockDb.serviceAddon.update.mockResolvedValueOnce(addonRecord)

      const result = await service.updateAddon("addon-1", {
        name: "Updated Name",
        prices: [{ billingPeriod: "ANNUAL", currency: "IDR", amount: 500000 }],
      })

      expect(result.code).toBe("EXTRA_SEATS")
      expect(mockDb.serviceAddon.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "addon-1" },
          data: expect.objectContaining({
            name: "Updated Name",
          }),
        })
      )
    })
    it("updates billing mode without replacing prices", async () => {
      mockDb.serviceAddon.findUnique.mockResolvedValueOnce(addonRecord)
      mockDb.serviceAddon.update.mockResolvedValueOnce(addonRecord)

      await service.updateAddon("addon-1", { billingMode: "ONE_TIME" })

      expect(mockDb.serviceAddon.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "addon-1" },
          data: expect.objectContaining({ billingMode: "ONE_TIME" }),
        })
      )
      expect(mockDb.serviceAddon.update.mock.calls[0]?.[0].data.prices).toBe(
        undefined
      )
    })
  })

  describe("deactivateAddon", () => {
    it("deactivates an addon", async () => {
      mockDb.serviceAddon.findUnique.mockResolvedValueOnce(addonRecord)
      mockDb.servicePlanAddon.count.mockResolvedValueOnce(0)

      await service.deactivateAddon("addon-1")

      expect(mockDb.serviceAddon.update).toHaveBeenCalledWith({
        where: { id: "addon-1" },
        data: { isActive: false },
      })
    })

    it("throws AddonNotFoundError when addon does not exist", async () => {
      mockDb.serviceAddon.findUnique.mockResolvedValueOnce(null)

      await expect(service.deactivateAddon("unknown-id")).rejects.toThrow(
        "not found"
      )
    })

    it("throws AddonConflictError when addon is required on plans", async () => {
      mockDb.serviceAddon.findUnique.mockResolvedValueOnce(addonRecord)
      mockDb.servicePlanAddon.count.mockResolvedValueOnce(2)

      await expect(service.deactivateAddon("addon-1")).rejects.toThrow(
        "required on"
      )
    })
  })

  describe("listPlanAttachments", () => {
    it("returns paginated attachments for a plan", async () => {
      mockDb.servicePlanAddon.findMany.mockResolvedValueOnce([attachmentRecord])
      mockDb.servicePlanAddon.count.mockResolvedValueOnce(1)

      const result = await service.listPlanAttachments({ planId: "plan-1" })

      expect(result.attachments).toHaveLength(1)
      expect(result.attachments[0].addonCode).toBe("EXTRA_SEATS")
      expect(result.pagination.total).toBe(1)
    })

    it("applies attachment filters and pagination", async () => {
      mockDb.servicePlanAddon.findMany.mockResolvedValueOnce([attachmentRecord])
      mockDb.servicePlanAddon.count.mockResolvedValueOnce(3)

      const result = await service.listPlanAttachments({
        planId: "plan-1",
        page: 2,
        limit: 2,
        isActive: true,
      })

      expect(result.pagination).toEqual({
        page: 2,
        limit: 2,
        total: 3,
        totalPages: 2,
      })
      expect(mockDb.servicePlanAddon.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { planId: "plan-1", isActive: true },
          skip: 2,
          take: 2,
        })
      )
    })
  })

  describe("getPlanAttachment", () => {
    it("returns null when a plan attachment does not exist", async () => {
      mockDb.servicePlanAddon.findUnique.mockResolvedValueOnce(null)

      const result = await service.getPlanAttachment("unknown")

      expect(result).toBeNull()
    })

    it("returns plan attachment detail", async () => {
      mockDb.servicePlanAddon.findUnique.mockResolvedValueOnce(attachmentRecord)

      const result = await service.getPlanAttachment("attach-1")

      expect(result?.attachment.addonCode).toBe("EXTRA_SEATS")
      expect(mockDb.servicePlanAddon.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "attach-1" } })
      )
    })
  })

  describe("attachAddonToPlan", () => {
    it("attaches an addon to a plan", async () => {
      mockDb.servicePlan.findUnique.mockResolvedValueOnce({ id: "plan-1" })
      mockDb.serviceAddon.findUnique.mockResolvedValueOnce(addonRecord)
      mockDb.servicePlanAddon.findFirst.mockResolvedValueOnce(null)
      mockDb.servicePlanAddon.create.mockResolvedValueOnce(attachmentRecord)

      const result = await service.attachAddonToPlan({
        planId: "plan-1",
        addonId: "addon-1",
        isActive: true,
        isRequired: false,
        displayOrder: 0,
      })

      expect(result.addonCode).toBe("EXTRA_SEATS")
      expect(result.planCode).toBe("PLAN_BASIC")
    })

    it("throws PlanNotFoundError when plan does not exist", async () => {
      mockDb.servicePlan.findUnique.mockResolvedValueOnce(null)
      mockDb.serviceAddon.findUnique.mockResolvedValueOnce(addonRecord)

      await expect(
        service.attachAddonToPlan({
          planId: "unknown",
          addonId: "addon-1",
          isActive: true,
          isRequired: false,
          displayOrder: 0,
        })
      ).rejects.toThrow("Plan")
    })

    it("throws AddonConflictError when addon already attached", async () => {
      mockDb.servicePlan.findUnique.mockResolvedValueOnce({ id: "plan-1" })
      mockDb.serviceAddon.findUnique.mockResolvedValueOnce(addonRecord)
      mockDb.servicePlanAddon.findFirst.mockResolvedValueOnce(attachmentRecord)

      await expect(
        service.attachAddonToPlan({
          planId: "plan-1",
          addonId: "addon-1",
          isRequired: false,
          displayOrder: 0,
          isActive: true,
        })
      ).rejects.toThrow("already attached")
    })
    it("rejects attachment when the addon is inactive", async () => {
      mockDb.servicePlan.findUnique.mockResolvedValueOnce({
        id: "plan-1",
        code: "PLAN_BASIC",
      })
      mockDb.serviceAddon.findUnique.mockResolvedValueOnce({
        ...addonRecord,
        isActive: false,
      })

      await expect(
        service.attachAddonToPlan({
          planId: "plan-1",
          addonId: "addon-1",
          isActive: true,
          isRequired: false,
          displayOrder: 0,
        })
      ).rejects.toThrow("inactive")
      expect(mockDb.servicePlanAddon.findFirst).not.toHaveBeenCalled()
    })

    it("throws AddonNotFoundError when addon does not exist", async () => {
      mockDb.servicePlan.findUnique.mockResolvedValueOnce({
        id: "plan-1",
        code: "PLAN_BASIC",
      })
      mockDb.serviceAddon.findUnique.mockResolvedValueOnce(null)

      await expect(
        service.attachAddonToPlan({
          planId: "plan-1",
          addonId: "unknown",
          isActive: true,
          isRequired: false,
          displayOrder: 0,
        })
      ).rejects.toThrow("Addon")
    })
  })
  describe("updatePlanAttachment", () => {
    it("updates a plan attachment", async () => {
      mockDb.servicePlanAddon.findUnique.mockResolvedValueOnce(attachmentRecord)
      mockDb.servicePlanAddon.update.mockResolvedValueOnce(attachmentRecord)

      const result = await service.updatePlanAttachment("attach-1", {
        label: "Updated",
        isRequired: true,
      })

      expect(result.label).toBe("Extra Label")
      expect(mockDb.servicePlanAddon.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "attach-1" },
          data: { label: "Updated", isRequired: true },
        })
      )
    })

    it("throws when updating a missing plan attachment", async () => {
      mockDb.servicePlanAddon.findUnique.mockResolvedValueOnce(null)

      await expect(
        service.updatePlanAttachment("unknown", { label: "Updated" })
      ).rejects.toThrow("not found")
    })
  })

  describe("detachAddonFromPlan", () => {
    it("detaches an addon from a plan", async () => {
      mockDb.servicePlanAddon.findUnique.mockResolvedValueOnce(attachmentRecord)
      mockDb.serviceSubscriptionAddon.count.mockResolvedValueOnce(0)

      await service.detachAddonFromPlan("attach-1")

      expect(mockDb.servicePlanAddon.delete).toHaveBeenCalledWith({
        where: { id: "attach-1" },
      })
    })

    it("throws PlanAttachmentNotFoundError when attachment does not exist", async () => {
      mockDb.servicePlanAddon.findUnique.mockResolvedValueOnce(null)

      await expect(service.detachAddonFromPlan("unknown")).rejects.toThrow(
        "not found"
      )
    })

    it("blocks detachment of required addon with active subscriptions", async () => {
      const requiredAttachment = { ...attachmentRecord, isRequired: true }
      mockDb.servicePlanAddon.findUnique.mockResolvedValueOnce(
        requiredAttachment
      )
      mockDb.serviceSubscriptionAddon.count.mockResolvedValueOnce(3)

      await expect(service.detachAddonFromPlan("attach-1")).rejects.toThrow(
        "active subscription"
      )
    })
    it("detaches a required addon when no subscriptions are active", async () => {
      mockDb.servicePlanAddon.findUnique.mockResolvedValueOnce({
        ...attachmentRecord,
        isRequired: true,
      })
      mockDb.serviceSubscriptionAddon.count.mockResolvedValueOnce(0)

      await service.detachAddonFromPlan("attach-1")

      expect(mockDb.serviceSubscriptionAddon.count).toHaveBeenCalledWith({
        where: {
          addonId: "addon-1",
          subscription: { planId: "plan-1" },
          status: "ACTIVE",
        },
      })
      expect(mockDb.servicePlanAddon.delete).toHaveBeenCalledWith({
        where: { id: "attach-1" },
      })
    })
  })
})
