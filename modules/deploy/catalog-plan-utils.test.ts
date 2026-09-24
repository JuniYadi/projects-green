import { describe, expect, it } from "bun:test"
import {
  getPlanResources,
  getTemplateRequiredStorageGb,
  validatePlanStorageForTemplate,
} from "./catalog-plan-utils"
import type { CatalogPlan } from "@/lib/billing-client"

describe("catalog-plan-utils", () => {
  describe("getPlanResources", () => {
    it("returns default 500 cpu, 512 mem, and 0 storage when plan is undefined", () => {
      const result = getPlanResources(undefined)
      expect(result).toEqual({ cpu: 500, mem: 512, storage: 0 })
    })

    it("returns MEDIUM defaults (1000 cpu, 2048 mem, 20 storage) when plan code is MEDIUM without resources", () => {
      const plan = {
        code: "MEDIUM",
        resources: {},
      } as unknown as CatalogPlan

      const result = getPlanResources(plan)
      expect(result).toEqual({ cpu: 1000, mem: 2048, storage: 20 })
    })

    it("returns SMALL defaults (500 cpu, 512 mem, 5 storage) when plan code is SMALL without resources", () => {
      const plan = {
        code: "SMALL",
        resources: {},
      } as unknown as CatalogPlan

      const result = getPlanResources(plan)
      expect(result).toEqual({ cpu: 500, mem: 512, storage: 5 })
    })

    it("preserves explicit zero storage on a SMALL plan rather than falling back to default 5 GB", () => {
      const plan = {
        code: "SMALL",
        resources: {
          provisioning: { storage: 0 },
        },
      } as unknown as CatalogPlan

      const result = getPlanResources(plan)
      expect(result.storage).toBe(0)
    })

    it("returns non-MEDIUM defaults (500 cpu, 512 mem, 0 storage) when plan code is STARTER without resources", () => {
      const plan = {
        code: "STARTER",
        resources: {},
      } as unknown as CatalogPlan

      const result = getPlanResources(plan)
      expect(result).toEqual({ cpu: 500, mem: 512, storage: 0 })
    })

    it("reads provisioning cpu, memory, and storage when present", () => {
      const plan = {
        code: "CUSTOM",
        resources: {
          provisioning: {
            cpu: 2000,
            memory: 4096,
            storage: 15,
          },
        },
      } as unknown as CatalogPlan

      const result = getPlanResources(plan)
      expect(result).toEqual({ cpu: 2000, mem: 4096, storage: 15 })
    })

    it("falls back to features defaultCpu and defaultMem", () => {
      const plan = {
        code: "CUSTOM",
        resources: {
          features: {
            defaultCpu: 1500,
            defaultMem: 3000,
          },
        },
      } as unknown as CatalogPlan

      const result = getPlanResources(plan)
      expect(result).toEqual({ cpu: 1500, mem: 3000, storage: 0 })
    })

    it("falls back to root defaultCpu and defaultMem", () => {
      const plan = {
        code: "CUSTOM",
        resources: {
          defaultCpu: 800,
          defaultMem: 1024,
        },
      } as unknown as CatalogPlan

      const result = getPlanResources(plan)
      expect(result).toEqual({ cpu: 800, mem: 1024, storage: 0 })
    })

    it("falls back to root cpu and memory", () => {
      const plan = {
        code: "CUSTOM",
        resources: {
          cpu: 750,
          memory: 1536,
        },
      } as unknown as CatalogPlan

      const result = getPlanResources(plan)
      expect(result).toEqual({ cpu: 750, mem: 1536, storage: 0 })
    })

    it("normalizes memory when rawMem is greater than 32768 (e.g. KiB/bytes converted to MiB)", () => {
      const plan = {
        code: "LARGE",
        resources: {
          provisioning: {
            cpu: 4000,
            memory: 65536, // 65536 / 1024 = 64
          },
        },
      } as unknown as CatalogPlan

      const result = getPlanResources(plan)
      expect(result).toEqual({ cpu: 4000, mem: 64, storage: 50 })
    })

    it("rounds normalized memory when not evenly divisible", () => {
      const plan = {
        code: "LARGE",
        resources: {
          provisioning: {
            cpu: 2000,
            memory: 100000, // 100000 / 1024 = 97.65625 -> 98
          },
        },
      } as unknown as CatalogPlan

      const result = getPlanResources(plan)
      expect(result).toEqual({ cpu: 2000, mem: 98, storage: 50 })
    })

    it("preserves memory when rawMem <= 32768 (e.g. already in MiB)", () => {
      const plan = {
        code: "LARGE",
        resources: {
          provisioning: {
            cpu: 4000,
            memory: 32768,
          },
        },
      } as unknown as CatalogPlan

      const result = getPlanResources(plan)
      expect(result).toEqual({ cpu: 4000, mem: 32768, storage: 50 })
    })
  })

  describe("getTemplateRequiredStorageGb", () => {
    it("returns 0 when blueprint or storage is not enabled", () => {
      expect(getTemplateRequiredStorageGb(null)).toBe(0)
      expect(getTemplateRequiredStorageGb({})).toBe(0)
      expect(
        getTemplateRequiredStorageGb({ storage: { enabled: false } })
      ).toBe(0)
    })

    it("returns sizeGbDefault when storage is enabled", () => {
      expect(
        getTemplateRequiredStorageGb({
          storage: { enabled: true, sizeGbDefault: 10 },
        })
      ).toBe(10)
    })

    it("defaults to 5 GB when storage is enabled without explicit sizeGbDefault", () => {
      expect(
        getTemplateRequiredStorageGb({
          storage: { enabled: true },
        })
      ).toBe(5)
    })

    it("sums pvc mounts when multiple mounts exist", () => {
      expect(
        getTemplateRequiredStorageGb({
          storage: {
            enabled: true,
            sizeGbDefault: 5,
            mounts: [
              { type: "pvc", sizeGb: 10 },
              { type: "pvc", sizeGb: 15 },
              { type: "configmap", sizeGb: 20 },
            ],
          },
        })
      ).toBe(25)
    })
  })

  describe("validatePlanStorageForTemplate", () => {
    it("returns valid when required storage is 0", () => {
      const res = validatePlanStorageForTemplate({
        requiredStorageGb: 0,
        planStorageGb: 5,
      })
      expect(res.valid).toBe(true)
    })

    it("returns valid when plan storage meets requirement", () => {
      const res = validatePlanStorageForTemplate({
        requiredStorageGb: 10,
        planStorageGb: 20,
      })
      expect(res.valid).toBe(true)
    })

    it("returns invalid with error message when plan storage is less than required", () => {
      const res = validatePlanStorageForTemplate({
        requiredStorageGb: 10,
        planStorageGb: 5,
        planName: "Small",
      })
      expect(res.valid).toBe(false)
      expect(res.error).toBe(
        'Selected plan "Small" provides 5 GB storage, but template requires 10 GB. Please choose a larger plan.'
      )
    })

    it("treats zero or unknown storage capacity as insufficient when storage is required", () => {
      const res = validatePlanStorageForTemplate({
        requiredStorageGb: 5,
        planStorageGb: 0,
      })
      expect(res.valid).toBe(false)
      expect(res.error).toBe(
        "Selected plan provides 0 GB storage, but template requires 5 GB. Please choose a larger plan."
      )
    })
  })
})
