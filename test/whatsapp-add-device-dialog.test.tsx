import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AddDeviceDialog } from "@/app/[lang]/portal/whatsapp/devices/_components/add-device-dialog"

const originalFetch = globalThis.fetch

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

describe("AddDeviceDialog", () => {
  beforeEach(() => {
    globalThis.fetch = mock(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.pathname
              : input.url
        if (path.includes("/api/admin/whatsapp/meta-apps")) {
          return jsonResponse({
            ok: true,
            data: [
              {
                id: "meta-1",
                name: "Primary App",
                metaAppId: "123456",
                active: true,
                callbackPath: "/api/whatsapp/meta-webhook/key-1",
              },
            ],
          })
        }
        if (path.includes("/api/admin/organizations")) {
          return jsonResponse({
            ok: true,
            data: { organizations: [{ id: "org-1", name: "Acme" }] },
          })
        }
        const method =
          init?.method ?? (input instanceof Request ? input.method : undefined)
        if (path.includes("/api/admin/devices") && method === "POST") {
          return jsonResponse(
            {
              ok: false,
              error: "DEVICE_META_APP_PHONE_CONFLICT",
              message: "Meta app is already assigned to another phone.",
            },
            409
          )
        }
        return jsonResponse({}, 404)
      }
    ) as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    cleanup()
  })

  it("shows MetaApp association errors beside selector", async () => {
    const view = render(<AddDeviceDialog />)
    const user = userEvent.setup()
    await user.click(view.getByRole("button", { name: "Add Device" }))

    await waitFor(() =>
      expect(view.getAllByRole("combobox").length).toBeGreaterThan(0)
    )
    await user.click(view.getAllByRole("combobox")[0])
    await waitFor(() =>
      expect(view.getByRole("option", { name: "Acme" })).toBeTruthy()
    )
    await user.click(view.getByRole("option", { name: "Acme" }))
    await user.type(view.getByPlaceholderText("+1234567890"), "+1234567890")
    await waitFor(() => expect(view.getByLabelText("MetaApp")).toBeTruthy())
    await user.selectOptions(view.getByLabelText("MetaApp"), "meta-1")
    await user.click(
      within(view.getByRole("dialog")).getByRole("button", {
        name: "Add Device",
      })
    )
    await waitFor(() =>
      expect(
        view.getByText("Meta app is already assigned to another phone.")
      ).toBeTruthy()
    )
  })
})
