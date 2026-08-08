import { describe, expect, it, mock } from "bun:test"
import type { CatalogProduct } from "@/lib/billing-client"
const adminSubscriptionsGet = mock()
const catalogProductGet =
  mock<(options?: unknown) => Promise<{ data: CatalogProduct }>>()
const subscriptionsGet = mock()

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      billing: {
        admin: { subscriptions: { get: adminSubscriptionsGet } },
        subscriptions: { get: subscriptionsGet },
        catalog: { APP_HOSTING: { get: catalogProductGet } },
      },
    },
  },
}))

const { fetchAdminSubscriptions, fetchSubscriptions, fetchCatalogProduct } =
  await import("./use-billing-data")

describe("billing Eden query functions", () => {
  it("loads admin subscriptions through the typed Eden endpoint", async () => {
    adminSubscriptionsGet.mockResolvedValueOnce({
      data: {
        ok: true,
        subscriptions: [{ id: "sub-1" }],
        pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
      },
    })

    await expect(fetchAdminSubscriptions({ page: 2 })).resolves.toMatchObject({
      subscriptions: [{ id: "sub-1" }],
    })
    expect(adminSubscriptionsGet).toHaveBeenCalledWith({
      $query: { page: "2", limit: "20" },
    })
  })

  it("turns an Eden error response into a rejected query", async () => {
    subscriptionsGet.mockResolvedValueOnce({
      data: undefined,
      error: { value: { message: "Unable to load subscriptions" } },
    })

    await expect(fetchSubscriptions()).rejects.toThrow(
      "Unable to load subscriptions"
    )
  })

  it("returns the catalog product returned by Eden", async () => {
    const product: CatalogProduct = {
      code: "APP_HOSTING",
      name: "App Hosting",
      description: "Application hosting",
      plans: [],
    }
    catalogProductGet.mockResolvedValueOnce({ data: product })

    await expect(fetchCatalogProduct("APP_HOSTING", "IDR")).resolves.toEqual(
      product
    )
    expect(catalogProductGet).toHaveBeenCalledWith({
      $query: { currency: "IDR" },
    })
  })
})
