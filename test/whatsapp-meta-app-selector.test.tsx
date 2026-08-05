import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { useState } from "react"
import { MetaAppSelector } from "@/components/whatsapp/meta-app-selector"

const originalFetch = globalThis.fetch

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

describe("MetaAppSelector", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
    cleanup()
  })

  it("loads active apps and redacts secrets while showing callback metadata", async () => {
    globalThis.fetch = mock(async () =>
      jsonResponse({
        ok: true,
        data: [
          {
            id: "meta-1",
            name: "Primary App",
            metaAppId: "123456",
            active: true,
            callbackPath: "/api/whatsapp/meta-webhook/key-1",
            appSecret: "secret-value",
            verifyToken: "verify-value",
          },
          {
            id: "meta-2",
            name: "Inactive App",
            metaAppId: "999999",
            active: false,
            callbackPath: "/api/whatsapp/meta-webhook/key-2",
          },
        ],
      })
    ) as unknown as typeof fetch

    const onChange = mock((_value: string) => {})
    function ControlledSelector() {
      const [value, setValue] = useState("")
      return (
        <MetaAppSelector
          value={value}
          environment="LIVE"
          onChange={(nextValue) => {
            onChange(nextValue)
            setValue(nextValue)
          }}
        />
      )
    }
    const view = render(<ControlledSelector />)

    expect(view.getByText("Loading Meta Apps…")).toBeTruthy()
    await waitFor(() => expect(view.getByRole("combobox")).toBeTruthy())
    expect(view.getByText("No MetaApp selected")).toBeTruthy()
    expect(view.queryByText("Inactive App")).toBeNull()
    expect(view.queryByText("secret-value")).toBeNull()
    expect(view.queryByText("verify-value")).toBeNull()

    fireEvent.change(view.getByRole("combobox"), {
      target: { value: "meta-1" },
    })
    expect(onChange).toHaveBeenCalledWith("meta-1")
    expect(view.getByText("Primary App")).toBeTruthy()
    expect(view.getByText("Meta App ID: 123456")).toBeTruthy()
    expect(
      view.getByText("Callback path: /api/whatsapp/meta-webhook/key-1")
    ).toBeTruthy()
  })

  it("requires app for LIVE and allows unassignment for SANDBOX", async () => {
    globalThis.fetch = mock(async () =>
      jsonResponse({ ok: true, data: [] })
    ) as unknown as typeof fetch

    const live = render(
      <MetaAppSelector value="" environment="LIVE" onChange={() => {}} />
    )
    await waitFor(() =>
      expect(live.getByText("No active Meta Apps available.")).toBeTruthy()
    )
    expect(
      live.getByText("MetaApp selection is required for LIVE devices.")
    ).toBeTruthy()
    cleanup()

    const sandbox = render(
      <MetaAppSelector
        value=""
        environment="SANDBOX"
        onChange={() => {}}
        allowUnassign
      />
    )
    await waitFor(() =>
      expect(sandbox.getByText("No active Meta Apps available.")).toBeTruthy()
    )
    expect(
      sandbox.queryByText("MetaApp selection is required for LIVE devices.")
    ).toBeNull()
  })
})
