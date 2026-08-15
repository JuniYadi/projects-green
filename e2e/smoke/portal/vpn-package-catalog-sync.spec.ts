import { expect, test } from "@playwright/test"

const packageId = "vpn-package-e2e"
const planId = "vpn-plan-e2e"
const offerId = "vpn-offer-e2e"
const serverId = "vpn-server-e2e"

const server = {
  id: serverId,
  name: "Jakarta",
  region: {
    id: "vpn-region-e2e",
    name: "Indonesia",
    slug: "indonesia",
    countryCode: "ID",
  },
  protocols: {
    openVpn: { enabled: true, port: 1194 },
    wireGuard: { enabled: false, port: null },
    proxy: { enabled: false, port: null },
  },
}

test.describe("VPN package catalog synchronization", () => {
  test.setTimeout(90_000)

  test("creates, prices, publishes, and filters a package @e2e/vpn/admin/package-catalog-sync", async ({
    page,
  }) => {
    test.skip(
      process.env.FUNCTIONAL_TEST_MODE !== "true" ||
        !process.env.FUNCTIONAL_TEST_AUTH_SECRET,
      "Requires the authenticated functional-test server mode"
    )

    let packageName = "Browser VPN Package"
    let packageActive = true
    let offerPublished = false

    const packageResponse = () => ({
      id: packageId,
      servicePlanId: planId,
      name: packageName,
      description: "Created through the browser flow",
      price: null,
      currency: null,
      isActive: packageActive,
      serverCount: 1,
      servers: [
        {
          id: "vpn-package-server-e2e",
          server,
          protocols: ["OpenVPN"],
        },
      ],
      catalogPlan: {
        id: planId,
        code: "VPN_BROWSER_PACKAGE",
        name: packageName,
        packageCode: "VPN",
        isActive: packageActive,
      },
      offers: offerPublished
        ? [
            {
              id: offerId,
              billingPeriod: "MONTHLY",
              periodMonths: 1,
              periodPrice: "100000",
              currency: "IDR",
              effectiveFrom: "2026-01-01T00:00:00.000Z",
              effectiveTo: null,
            },
          ]
        : [],
      pricingStatus: offerPublished ? "READY" : "PRICING_REQUIRED",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    })

    const catalogResponse = () => ({
      product: {
        code: "VPN",
        name: "VPN",
        description: "VPN service",
        isActive: true,
        plans: [
          {
            id: planId,
            code: "VPN_BROWSER_PACKAGE",
            name: packageName,
            resources: {},
            isActive: packageActive,
            offers: offerPublished
              ? [
                  {
                    id: offerId,
                    billingPeriod: "MONTHLY",
                    periodPrice: "100000",
                    currency: "IDR",
                    chargeUnit: "SUBSCRIPTION",
                    effectiveFrom: "2026-01-01",
                    effectiveTo: null,
                    isActive: true,
                  },
                ]
              : [],
          },
        ],
      },
      currency: "IDR",
    })

    const fulfill = async (
      route: Parameters<Parameters<typeof page.route>[1]>[0],
      body: unknown,
      status = 200
    ) => {
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      })
    }

    await page.route("**/api/admin/vpn/servers", async (route) => {
      if (route.request().method() === "GET") {
        await fulfill(route, { ok: true, data: [server] })
        return
      }
      await route.continue()
    })

    await page.route("**/api/admin/vpn/packages", async (route) => {
      if (route.request().method() === "GET") {
        await fulfill(route, { ok: true, data: [packageResponse()] })
        return
      }

      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON() as { name?: string }
        packageName = body.name ?? packageName
        await fulfill(route, { ok: true, data: packageResponse() }, 201)
        return
      }

      await route.continue()
    })

    await page.route(
      "**/api/billing/admin/catalog/products/vpn**",
      async (route) => {
        const pathname = new URL(route.request().url()).pathname
        if (route.request().method() === "GET" && pathname.endsWith("/vpn")) {
          await fulfill(route, catalogResponse())
          return
        }

        if (
          route.request().method() === "POST" &&
          pathname.endsWith("/vpn/publish")
        ) {
          offerPublished = true
          await fulfill(route, { ok: true, data: {} })
          return
        }

        await route.continue()
      }
    )

    await page.route("**/api/vpn/packages", async (route) => {
      if (
        route.request().method() === "GET" &&
        packageActive &&
        offerPublished
      ) {
        await fulfill(route, {
          ok: true,
          data: [
            {
              id: packageId,
              name: packageName,
              description: "Created through the browser flow",
              offers: [
                {
                  pricingId: offerId,
                  billingPeriod: "MONTHLY",
                  periodMonths: 1,
                  periodPrice: "100000",
                  currency: "IDR",
                  convertedPrice: null,
                  convertedCurrency: null,
                  exchangeRate: null,
                  effectiveFrom: "2026-01-01T00:00:00.000Z",
                  effectiveTo: null,
                  isActive: true,
                },
              ],
              price: "100000",
              currency: "IDR",
              serverCount: 1,
              protocolCount: 1,
              regions: ["Indonesia"],
              convertedPrice: null,
              convertedCurrency: null,
              exchangeRate: null,
            },
          ],
        })
        return
      }

      if (route.request().method() === "GET") {
        await fulfill(route, { ok: true, data: [] })
        return
      }

      await route.continue()
    })

    await page.goto("/en/portal/vpn/packages", {
      waitUntil: "domcontentloaded",
    })
    await expect(page.getByRole("heading", { name: "Packages" })).toBeVisible()

    await page.getByRole("button", { name: "Add Package" }).click()
    await page.getByLabel("Name").fill(packageName)
    await page
      .getByLabel("Description")
      .fill("Created through the browser flow")
    await page.getByRole("checkbox", { name: "Include Jakarta" }).check()
    await page.getByRole("button", { name: "Save", exact: true }).click()

    await expect(page.getByText(packageName)).toBeVisible()
    await expect(page.getByText("Pricing required")).toBeVisible()

    await page
      .getByRole("link", { name: `Manage pricing for ${packageName}` })
      .click()
    await expect(page).toHaveURL(
      /\/portal\/billing\/catalog\/products\/vpn\?plan=vpn-plan-e2e&tab=plans&returnTo=%2Fen%2Fportal%2Fvpn%2Fpackages/
    )
    await expect(page.getByText(`Focused plan: ${packageName}`)).toBeVisible()
    await expect(page.getByPlaceholder("Required")).toBeVisible()
    await page.getByPlaceholder("Required").fill("100000")

    await page
      .getByRole("button", { name: "Publish", exact: true })
      .first()
      .click()
    await expect(page.getByText("Publish product?")).toBeVisible()
    await page
      .getByRole("button", { name: "Publish", exact: true })
      .last()
      .click()
    await expect(page.getByText("published", { exact: true })).toBeVisible()

    await page.getByRole("link", { name: "Back to source package" }).click()
    await expect(page).toHaveURL(/\/portal\/vpn\/packages$/)
    await expect(page.getByText(packageName)).toBeVisible()
    await expect(page.getByText("Pricing required")).toHaveCount(0)
    await expect(page.getByText(/IDR/).first()).toBeVisible()

    await page.goto("/en/console/vpn/order", {
      waitUntil: "domcontentloaded",
    })
    await expect(
      page.getByRole("heading", { name: "Order VPN Package" })
    ).toBeVisible()
    await expect(page.getByText(packageName)).toBeVisible()

    offerPublished = false
    await page.reload({ waitUntil: "domcontentloaded" })
    await expect(
      page.getByText("No VPN packages are available right now.")
    ).toBeVisible()

    offerPublished = true
    packageActive = false
    await page.reload({ waitUntil: "domcontentloaded" })
    await expect(
      page.getByText("No VPN packages are available right now.")
    ).toBeVisible()
  })
})
