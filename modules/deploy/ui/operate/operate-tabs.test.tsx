import { afterEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { useState } from "react"
import { INITIAL_LOGS } from "@/modules/deploy/operate.mock"
import { TabDomains } from "@/modules/deploy/ui/operate/tab-domains"
import { TabEnv } from "@/modules/deploy/ui/operate/tab-env"
import { TabLogs } from "@/modules/deploy/ui/operate/tab-logs"
import { TabMounts } from "@/modules/deploy/ui/operate/tab-mounts"
import { TabOverview } from "@/modules/deploy/ui/operate/tab-overview"
import type {
  TenantDomainDTO,
  VolumeMount,
  EnvVar,
} from "@/modules/deploy/operate.types"

const tenantDomain: TenantDomainDTO = {
  id: "dom-1",
  hostname: "shop.acme.test",
  kind: "CUSTOM",
  isPrimary: true,
  cluster: { id: "cluster-1", code: "iad", name: "IAD", region: "us-east" },
  dnsStatus: "PENDING",
  expectedCnameTarget: "shop.edge.example",
  endpoint: {
    managedBaseDomain: "edge.example",
    cnameTarget: "shop.edge.example",
    ipv4Addresses: ["203.0.113.10"],
    ipv6Addresses: ["2001:db8::10"],
  },
  certificate: {
    source: "MANUAL",
    status: "PENDING",
    expiresAt: null,
    fingerprint: null,
    validationError: null,
  },
  allowlistMode: "OPEN",
  allowlistEntries: [],
}

const domainCallbacks = {
  onAddDomain: mock(async () => undefined),
  onDeleteDomain: mock(async () => undefined),
  onVerifyDomain: mock(async () => undefined),
  onUploadCertificate: mock(async () => undefined),
  onUpdateAllowlist: mock(async () => undefined),
  onAddAllowlistEntry: mock(async () => undefined),
  onDeleteAllowlistEntry: mock(async () => undefined),
  onRetry: mock(async () => undefined),
}

function DomainsHarness() {
  return (
    <TabDomains
      stackSlug="shop"
      apiDomains={[tenantDomain]}
      api={domainCallbacks}
    />
  )
}
function LogsHarness({ diagnosticMode }: { diagnosticMode: string }) {
  const [logs, setLogs] = useState(INITIAL_LOGS)

  return (
    <TabLogs logs={logs} setLogs={setLogs} diagnosticMode={diagnosticMode} />
  )
}

describe("Operate tabs coverage", () => {
  afterEach(() => {
    cleanup()
  })
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

      fireEvent.click(view.getByRole("button", { name: "Rebuild & Deploy" }))
      expect(
        view.getByRole("button", { name: "Rebuild & Deploy" })
      ).toBeTruthy()
    } finally {
      globalThis.setTimeout = originalSetTimeout
    }
  })
  it("loads DNS targets and calls persisted domain operations", async () => {
    const view = render(<DomainsHarness />)

    expect(view.getByText("CUSTOM")).toBeTruthy()
    expect(view.getByText("us-east")).toBeTruthy()
    expect(view.getByText("shop.edge.example")).toBeTruthy()
    expect(view.getByText("203.0.113.10")).toBeTruthy()
    expect(view.getByText("2001:db8::10")).toBeTruthy()

    fireEvent.input(view.getByPlaceholderText("e.g. shop.acme.com"), {
      target: { value: "api.acme.test" },
    })
    fireEvent.click(view.getByRole("button", { name: "Add Domain" }))
    await waitFor(() =>
      expect(domainCallbacks.onAddDomain).toHaveBeenCalledWith("api.acme.test")
    )
    fireEvent.click(view.getByRole("button", { name: /delete domain/i }))
    await waitFor(() =>
      expect(domainCallbacks.onDeleteDomain).toHaveBeenCalledWith("dom-1")
    )
    fireEvent.click(view.getByRole("button", { name: "Verify" }))
    await waitFor(() =>
      expect(domainCallbacks.onVerifyDomain).toHaveBeenCalledWith("dom-1")
    )
  })

  it("covers log streaming branches, filters, and live-tail toggle", () => {
    const originalSetInterval = globalThis.setInterval
    const originalClearInterval = globalThis.clearInterval
    const originalScrollIntoView = Element.prototype.scrollIntoView

    const immediateInterval: typeof setInterval = ((handler: TimerHandler) => {
      if (typeof handler === "function") {
        handler()
      }
      return 0 as unknown as ReturnType<typeof setInterval>
    }) as unknown as typeof setInterval

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

  it("covers TabMounts rendering and Read-Only Mount switch toggle", () => {
    const mounts: Record<string, VolumeMount[]> = {
      prod: [
        {
          id: "mnt-1",
          name: "app-secret",
          mountPath: "/var/secrets/app.key",
          sourceType: "secret",
          fileMode: "0400",
          readOnly: true,
          contentSummary: "[REDACTED] type=key bytes=64 fingerprint=abc123",
        },
      ],
    }
    const setMounts = mock(() => {})

    const view = render(
      <TabMounts selectedEnv="prod" mounts={mounts} setMounts={setMounts} />
    )

    expect(view.getByText("File Mounts & Configurations")).toBeDefined()
    expect(view.getByText("Active Pod File Mounts")).toBeDefined()
    expect(view.getByText("/var/secrets/app.key")).toBeDefined()

    const switchControl = view.getByRole("switch", {
      name: "Set mount as read-only",
    })
    expect(switchControl.getAttribute("aria-checked")).toBe("true")

    fireEvent.click(switchControl)
    expect(switchControl.getAttribute("aria-checked")).toBe("false")

    // Submit empty form to trigger validation error
    fireEvent.click(view.getByRole("button", { name: "Create File Mount" }))
    expect(view.getByText("All fields are required")).toBeDefined()
  })

  it("covers TabEnv rendering", () => {
    const envVars: Record<string, EnvVar[]> = {
      prod: [
        {
          id: "env-1",
          key: "NODE_ENV",
          value: "production",
          type: "plain",
          scope: "runtime",
          isSecret: false,
          masked: false,
          isStoredSecret: false,
          updatedAt: new Date().toISOString(),
        },
      ],
    }
    const setEnvVars = mock(() => {})

    const view = render(
      <TabEnv selectedEnv="prod" envVars={envVars} setEnvVars={setEnvVars} />
    )

    expect(view.getByText("Environment Variables")).toBeDefined()
    expect(view.getByText("NODE_ENV")).toBeDefined()
    expect(view.queryByText("Reverse Proxy Ingress")).toBeNull()
  })
})
