import { describe, expect, it, mock } from "bun:test"
import { fireEvent, render } from "@testing-library/react"
import { useState } from "react"

import {
  INITIAL_DOMAINS,
  INITIAL_LOGS,
} from "@/modules/deploy/operate.mock"
import { TabDomains } from "@/modules/deploy/ui/operate/tab-domains"
import { TabLogs } from "@/modules/deploy/ui/operate/tab-logs"
import { TabOverview } from "@/modules/deploy/ui/operate/tab-overview"

function DomainsHarness() {
  const [domains, setDomains] = useState(INITIAL_DOMAINS)

  return (
    <TabDomains
      selectedEnv="prod"
      domains={domains}
      setDomains={setDomains}
    />
  )
}

function LogsHarness({ diagnosticMode }: { diagnosticMode: string }) {
  const [logs, setLogs] = useState(INITIAL_LOGS)

  return (
    <TabLogs
      logs={logs}
      setLogs={setLogs}
      diagnosticMode={diagnosticMode}
    />
  )
}

describe("Operate tabs coverage", () => {
  it("covers overview diagnostic states and rebuild progression", () => {
    const originalSetTimeout = globalThis.setTimeout
    const immediateTimeout: typeof setTimeout = ((handler: TimerHandler) => {
      if (typeof handler === "function") {
        handler()
      }
      return 0 as unknown as ReturnType<typeof setTimeout>
    }) as unknown as typeof setTimeout
    globalThis.setTimeout = immediateTimeout

    try {
      const view = render(
        <TabOverview
          diagnosticMode="healthy"
          replicas={2}
          cloudflareEnabled={false}
          dbConnected={true}
          setCloudflareEnabled={mock(() => {})}
          setDbConnected={mock(() => {})}
          domains={[]}
        />
      )
      expect(view.getByText("HTTP 200 OK")).toBeTruthy()

      view.rerender(
        <TabOverview
          diagnosticMode="error_502"
          replicas={2}
          cloudflareEnabled={false}
          dbConnected={true}
          setCloudflareEnabled={mock(() => {})}
          setDbConnected={mock(() => {})}
          domains={[]}
        />
      )
      expect(view.getByText("HTTP 502 Bad Gateway")).toBeTruthy()

      view.rerender(
        <TabOverview
          diagnosticMode="ssl_expired"
          replicas={2}
          cloudflareEnabled={false}
          dbConnected={true}
          setCloudflareEnabled={mock(() => {})}
          setDbConnected={mock(() => {})}
          domains={[]}
        />
      )
      expect(view.getByText("SSL Certificate Expired")).toBeTruthy()

      view.rerender(
        <TabOverview
          diagnosticMode="redirect_loop"
          replicas={3}
          cloudflareEnabled={false}
          dbConnected={true}
          setCloudflareEnabled={mock(() => {})}
          setDbConnected={mock(() => {})}
          domains={[]}
        />
      )
      expect(view.getByText("HTTP 301 Redirection Loop")).toBeTruthy()
      expect(view.getByText("3 active")).toBeTruthy()

      fireEvent.click(
        view.getByRole("button", { name: "Rebuild & Deploy" })
      )
      expect(
        view.getByRole("button", { name: "Rebuild & Deploy" })
      ).toBeTruthy()
    } finally {
      globalThis.setTimeout = originalSetTimeout
    }
  })

  it("covers domains add/delete/ssl/clipboard interactions", () => {
    const writeTextMock = mock(() => Promise.resolve())
    const originalClipboard = navigator.clipboard

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    })

    try {
      const view = render(<DomainsHarness />)

      fireEvent.change(view.getByPlaceholderText("e.g. shop.acme.com"), {
        target: { value: "api.acme.test" },
      })
      fireEvent.change(view.getByRole("combobox"), {
        target: { value: "pending" },
      })
      fireEvent.click(view.getByRole("button", { name: "Add Domain" }))

      const renewButtons = view.queryAllByRole("button", {
        name: "Force Renew SSL",
      })
      if (renewButtons.length > 0) {
        fireEvent.click(renewButtons[0])
      }

      const copyButtons = view.getAllByRole("button", { name: "Copy" })
      fireEvent.click(copyButtons[0])
      fireEvent.click(copyButtons[1])
      expect(writeTextMock).toHaveBeenCalledWith("76.76.21.21")
      expect(writeTextMock).toHaveBeenCalledWith(
        "laravel-shop.projects-green.dev"
      )

      const deleteButtons = view.getAllByRole("button", {
        name: /delete domain/i,
      })
      fireEvent.click(deleteButtons[0])
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: originalClipboard,
      })
    }
  })

  it("covers log streaming branches, filters, and live-tail toggle", () => {
    const originalSetInterval = globalThis.setInterval
    const originalClearInterval = globalThis.clearInterval
    const originalScrollIntoView = Element.prototype.scrollIntoView

    const immediateInterval: typeof setInterval = (
      (handler: TimerHandler) => {
        if (typeof handler === "function") {
          handler()
        }
        return 0 as unknown as ReturnType<typeof setInterval>
      }
    ) as unknown as typeof setInterval

    globalThis.setInterval = immediateInterval
    globalThis.clearInterval = (() => undefined) as typeof clearInterval
    Element.prototype.scrollIntoView = (() => undefined) as (
      arg?: boolean | ScrollIntoViewOptions
    ) => void

    try {
      const view = render(<LogsHarness diagnosticMode="healthy" />)
      expect(view.getByText("Opensearch Log Viewer")).toBeTruthy()

      view.rerender(<LogsHarness diagnosticMode="error_502" />)
      view.rerender(<LogsHarness diagnosticMode="ssl_expired" />)
      view.rerender(<LogsHarness diagnosticMode="redirect_loop" />)

      fireEvent.change(
        view.getByPlaceholderText(
          "Search logs (e.g. nginx, connect, database)..."
        ),
        {
          target: { value: "not-found-keyword" },
        }
      )

      fireEvent.click(view.getByRole("button", { name: "ERROR" }))
      fireEvent.click(view.getByRole("button", { name: "WARN" }))
      fireEvent.click(view.getByRole("button", { name: "INFO" }))
      fireEvent.click(view.getByRole("button", { name: "ALL" }))

      fireEvent.click(view.getByLabelText("Live Tail"))
      fireEvent.click(view.getByLabelText("Live Tail"))
    } finally {
      globalThis.setInterval = originalSetInterval
      globalThis.clearInterval = originalClearInterval
      Element.prototype.scrollIntoView = originalScrollIntoView
    }
  })
})
