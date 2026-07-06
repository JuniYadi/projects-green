import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"
import React from "react"

const ORIGINAL_FETCH = globalThis.fetch

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })

const device = {
  id: "cmqoeiclj0006x94c6ofe0wti",
  phoneNumber: "+6281212345678",
  name: "Primary",
  status: "ACTIVE",
  organizationId: "org_1",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
} as const

describe("TabsDeviceDetail", () => {
  const capturedUrls: string[] = []

  beforeEach(() => {
    capturedUrls.length = 0
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3300"

    // Set browser origin to a realistic tunnel origin
    const happyDOM = (
      window as unknown as { happyDOM: { setURL: (url: string) => void } }
    ).happyDOM
    happyDOM.setURL(
      "https://pgreen.tunnel.juniyadi.id/id/console/whatsapp/devices/cmqoeiclj0006x94c6ofe0wti"
    )

    globalThis.fetch = mock((input: string | URL | Request) => {
      capturedUrls.push(input.toString())
      return jsonResponse({
        ok: true,
        data: [],
        meta: { total: 1, page: 1, limit: 1, totalPages: 1 },
      })
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH
  })

  it("renders templates count badge URL using browser origin, not env origin", async () => {
    // Dynamic import needed: the TabsDeviceDetail module imports the eden
    // singleton, which captures getApiBaseUrl() at import time.  Loading the
    // module after beforeEach has set the Happy DOM URL ensures the eden
    // client is constructed with the browser origin base URL.
    const { TabsDeviceDetail } = await import(
      "@/modules/whatsapp/webhooks/ui/tabs-device-detail"
    )

    render(
      React.createElement(TabsDeviceDetail, {
        device,
        backHref: "/id/console/whatsapp/devices",
        overviewChildren: React.createElement("div", null, "Overview"),
      })
    )

    // TemplateCountBadge fires a useEffect that calls
    // eden.api.whatsapp.templates.get({ $query: { whatsappDeviceId, limit, page } })
    await waitFor(() => {
      expect(capturedUrls.length).toBeGreaterThanOrEqual(1)
    })

    const templateUrl = capturedUrls.find((url) =>
      url.includes("/api/whatsapp/templates")
    )

    expect(templateUrl).toBeDefined()
    expect(templateUrl).toMatch(
      /^https:\/\/pgreen\.tunnel\.juniyadi\.id\/api\/whatsapp\/templates\?/
    )
    expect(templateUrl).toContain("whatsappDeviceId=cmqoeiclj0006x94c6ofe0wti")
    expect(templateUrl).toContain("limit=1")
    expect(templateUrl).toContain("page=1")

    // Verify no template request targets the env origin
    const envOriginUrl = capturedUrls.find((url) =>
      url.startsWith("http://localhost:3300/api/whatsapp/templates")
    )
    expect(envOriginUrl).toBeUndefined()
  })
})
