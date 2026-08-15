import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { WhatsappMetaAppInventory } from "./meta-app-inventory"

const metaApp = {
  id: "meta-1",
  name: "Primary",
  metaAppId: "12345",
  webhookKey: "webhook-key",
  active: true,
  callbackPath: "/api/whatsapp/meta-webhook/webhook-key",
  deviceCount: 2,
  createdAt: "2026-08-14T10:00:00.000Z",
  updatedAt: "2026-08-14T10:00:00.000Z",
}

const mockFetch = mock(async (input: string | Request, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.url
  const method = init?.method ?? "GET"
  if (url.includes("/api/admin/whatsapp/meta-apps") && method === "GET") {
    return new Response(
      JSON.stringify({ ok: true, data: [metaApp] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }
  return new Response(JSON.stringify({ ok: false }), { status: 404 })
})

global.fetch = mockFetch as unknown as typeof fetch

describe("WhatsappMetaAppInventory", () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders the list with device count and no secret material", async () => {
    const view = render(
      <WhatsappMetaAppInventory baseUrl="https://app.example.com" />
    )

    expect(await view.findByText("Primary")).toBeTruthy()
    expect(view.getByText("2")).toBeTruthy()
    expect(
      view.getByText("https://app.example.com/api/whatsapp/meta-webhook/webhook-key")
    ).toBeTruthy()
    const allFetchedBodies = mockFetch.mock.results
    expect(JSON.stringify(allFetchedBodies)).not.toContain("appSecret")
    expect(JSON.stringify(allFetchedBodies)).not.toContain("verifyToken")
  })

  it("access-denied state renders on a 403 response", async () => {
    mockFetch.mockImplementationOnce(
      async () =>
        new Response(JSON.stringify({ ok: false }), { status: 403 })
    )
    const view = render(
      <WhatsappMetaAppInventory baseUrl="https://app.example.com" />
    )
    expect(await view.findByText("Access denied")).toBeTruthy()
  })

  it("create dialog clears the secret fields after a successful submit", async () => {
    const user = userEvent.setup()
    mockFetch.mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.url
      const method = init?.method ?? "GET"
      if (url.endsWith("/meta-apps") && method === "POST") {
        return new Response(
          JSON.stringify({ ok: true, data: { ...metaApp, id: "meta-2" } }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        )
      }
      if (url.includes("/meta-apps") && method === "GET") {
        return new Response(
          JSON.stringify({ ok: true, data: [metaApp] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }
      return new Response(JSON.stringify({ ok: false }), { status: 404 })
    })

    const view = render(
      <WhatsappMetaAppInventory baseUrl="https://app.example.com" />
    )
    await view.findByText("Primary")
    await user.click(view.getByRole("button", { name: "New Meta App" }))
    await user.type(view.getByLabelText("Name"), "Second App")
    await user.type(view.getByLabelText("Meta App ID"), "67890")
    await user.type(view.getByLabelText("App Secret"), "s3cret")
    await user.type(view.getByLabelText("Verify Token"), "t0ken")
    await user.click(view.getByRole("button", { name: "Create" }))

    await waitFor(() =>
      expect(view.queryByLabelText("App Secret")).toBeNull()
    )
  })

  it("rotate dialog opens with blank credential fields", async () => {
    const user = userEvent.setup()
    const view = render(
      <WhatsappMetaAppInventory baseUrl="https://app.example.com" />
    )
    await view.findByText("Primary")
    await user.click(view.getByRole("button", { name: "Rotate" }))

    const appSecretInput = view.getByLabelText(
      "New App Secret"
    ) as HTMLInputElement
    const verifyTokenInput = view.getByLabelText(
      "New Verify Token"
    ) as HTMLInputElement
    expect(appSecretInput.value).toBe("")
    expect(verifyTokenInput.value).toBe("")
  })

  it("shows a specific conflict message when deleting a meta app with attached devices", async () => {
    const user = userEvent.setup()
    const originalConfirm = window.confirm
    window.confirm = () => true
    mockFetch.mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.url
      const method = init?.method ?? "GET"
      if (method === "DELETE") {
        return new Response(
          JSON.stringify({ ok: false, error: "CONFLICT", message: "Meta app conflicts with an existing resource." }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        )
      }
      if (url.includes("/meta-apps") && method === "GET") {
        return new Response(
          JSON.stringify({ ok: true, data: [metaApp] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }
      return new Response(JSON.stringify({ ok: false }), { status: 404 })
    })

    const view = render(
      <WhatsappMetaAppInventory baseUrl="https://app.example.com" />
    )
    await view.findByText("Primary")
    await user.click(view.getByRole("button", { name: "Delete" }))

    expect(
      await view.findByText(
        "Cannot delete or deactivate this Meta App while devices are still attached. Detach the devices first."
      )
    ).toBeTruthy()
    window.confirm = originalConfirm
  })
})
