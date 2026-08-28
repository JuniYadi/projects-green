import { describe, expect, it } from "bun:test"
import { getPlanResources } from "./catalog-plan-utils"
import type { CatalogPlan } from "@/lib/billing-client"

describe("catalog-plan-utils", () => {
  describe("getPlanResources", () => {
    it("returns default 500 cpu and 512 mem when plan is undefined", () => {
      const result = getPlanResources(undefined)
      expect(result).toEqual({ cpu: 500, mem: 512 })
    })

    it("returns MEDIUM defaults (1000 cpu, 2048 mem) when plan code is MEDIUM without resources", () => {
      const plan = {
        code: "MEDIUM",
        resources: {},
      } as unknown as CatalogPlan

      const result = getPlanResources(plan)
      expect(result).toEqual({ cpu: 1000, mem: 2048 })
    })

    it("returns non-MEDIUM defaults (500 cpu, 512 mem) when plan code is STARTER without resources", () => {
      const plan = {
        code: "STARTER",
        resources: {},
      } as unknown as CatalogPlan

      const result = getPlanResources(plan)
      expect(result).toEqual({ cpu: 500, mem: 512 })
    })

    it("reads provisioning cpu and memory when present", () => {
      const plan = {
        code: "CUSTOM",
        resources: {
          provisioning: {
            cpu: 2000,
            memory: 4096,
          },
        },
      } as unknown as CatalogPlan

      const result = getPlanResources(plan)
      expect(result).toEqual({ cpu: 2000, mem: 4096 })
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
      expect(result).toEqual({ cpu: 1500, mem: 3000 })
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
      expect(result).toEqual({ cpu: 800, mem: 1024 })
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
      expect(result).toEqual({ cpu: 750, mem: 1536 })
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
      expect(result).toEqual({ cpu: 4000, mem: 64 })
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
      expect(result).toEqual({ cpu: 2000, mem: 98 })
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
      expect(result).toEqual({ cpu: 4000, mem: 32768 })
    })
  })
})
