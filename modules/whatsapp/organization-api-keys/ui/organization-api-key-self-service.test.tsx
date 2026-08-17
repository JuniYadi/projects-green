import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"

import { WhatsappOrganizationApiKeySelfService } from "./organization-api-key-self-service"

const mockFetch = mock(async (input: string | Request, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.url
  if (!init?.method) {
    return new Response(
      JSON.stringify({
        ok: true,
        data: {
          status: "NOT_GENERATED",
          keyId: null,
          fingerprint: null,
          generatedKeyCount: 0,
          createdAt: null,
          rotatedAt: null,
          revokedAt: null,
          lastUsedAt: null,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }
  if (url.endsWith("/self")) {
    return new Response(
      JSON.stringify({
        ok: true,
        data: {
          key: {
            id: "key-a",
            organizationId: "org-a",
            fingerprint: "fingerprint-a",
            status: "ACTIVE",
            createdAt: "2026-08-14T10:00:00.000Z",
            rotatedAt: null,
            revokedAt: null,
            lastUsedAt: null,
          },
          secret: "wa_live_one-time-secret",
        },
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    )
  }
  return new Response(JSON.stringify({ ok: false }), { status: 404 })
})

global.fetch = mockFetch as unknown as typeof fetch

describe("WhatsappOrganizationApiKeySelfService", () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders redacted state and reveals a generation secret only in the one-time card", async () => {
    const view = render(<WhatsappOrganizationApiKeySelfService />)

    expect(await view.findByText("Not generated")).toBeTruthy()
    expect(view.queryByText("wa_live_one-time-secret")).toBeNull()

    fireEvent.click(view.getByRole("button", { name: "Generate API key" }))

    await waitFor(() => {
      expect(view.getByText("wa_live_one-time-secret")).toBeTruthy()
    })
    expect(
      mockFetch.mock.calls.some(([input]) => {
        const value = typeof input === "string" ? input : input.url
        return value.includes("organization-api-keys/self")
      })
    ).toBe(true)
  })

  it("does not offer rotate or revoke before a key is active", async () => {
    const view = render(<WhatsappOrganizationApiKeySelfService />)
    await view.findByText("Not generated")

    expect(view.queryByRole("button", { name: "Rotate API key" })).toBeNull()
    expect(view.queryByRole("button", { name: "Revoke API key" })).toBeNull()
  })
})
