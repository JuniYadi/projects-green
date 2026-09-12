import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { TabDomains } from "@/modules/deploy/ui/operate/tab-domains"
import type {
  TenantDomainDTO,
  CustomDomain,
} from "@/modules/deploy/operate.types"

const sampleDomain: TenantDomainDTO = {
  id: "dom-1",
  hostname: "shop.acme.test",
  kind: "CUSTOM",
  isPrimary: true,
  cluster: { id: "cluster-1", code: "iad", name: "IAD", region: "us-east" },
  dnsStatus: "PENDING",
  expectedCnameTarget: "shop.edge.example",
  endpoint: {
    cnameTarget: "shop.edge.example",
    ipv4Addresses: ["192.0.2.1"],
    ipv6Addresses: ["2001:db8::1"],
    managedBaseDomain: "example.org",
  },
  certificate: {
    source: "LET_S_ENCRYPT",
    status: "READY",
    expiresAt: "2026-12-31T00:00:00.000Z",
    fingerprint: null,
    validationError: null,
  },
  allowlistMode: "OPEN",
  allowlistEntries: [],
}

const mockApi = {
  onAddDomain: mock(async () => undefined),
  onDeleteDomain: mock(async () => undefined),
  onVerifyDomain: mock(async () => undefined),
  onUploadCertificate: mock(async () => undefined),
  onUpdateAllowlist: mock(async () => undefined),
  onAddAllowlistEntry: mock(async () => undefined),
  onDeleteAllowlistEntry: mock(async () => undefined),
  onRetry: mock(async () => undefined),
}

describe("TabDomains", () => {
  const originalClipboard = navigator.clipboard
  let writeTextMock: (text: string) => Promise<void>

  beforeEach(() => {
    writeTextMock = mock(() => Promise.resolve())
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      writable: true,
      value: {
        writeText: writeTextMock,
      },
    })
  })

  afterEach(() => {
    cleanup()
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      writable: true,
      value: originalClipboard,
    })
  })

  it("renders canonical domain endpoint full URL when domain is present", () => {
    const view = render(
      <TabDomains stackSlug="shop" apiDomains={[sampleDomain]} api={mockApi} />
    )

    expect(view.getByText("https://shop.acme.test")).toBeTruthy()
    expect(view.getByText("Domain endpoint")).toBeTruthy()
    expect(view.getByText("shop")).toBeTruthy()
    expect(view.getByText("us-east")).toBeTruthy()
  })

  it("renders fallback canonical domain endpoint full URL when no domain is present", () => {
    const view = render(
      <TabDomains stackSlug="my-app" apiDomains={[]} api={mockApi} />
    )

    expect(view.getByText("https://my-app.pfnapp.my.id")).toBeTruthy()
    expect(view.getByText("Domain endpoint")).toBeTruthy()
  })

  it("copies the endpoint URL when the copy button is clicked", async () => {
    const view = render(
      <TabDomains stackSlug="shop" apiDomains={[sampleDomain]} api={mockApi} />
    )

    const endpointEl = view.getByText("https://shop.acme.test")
    const copyButton = endpointEl.parentElement?.querySelector("button")
    expect(copyButton).toBeTruthy()
    fireEvent.click(copyButton!)
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("https://shop.acme.test")
    })
  })

  it("uses semantic tokens and does not use hardcoded white or dark background classes", () => {
    const view = render(
      <TabDomains stackSlug="shop" apiDomains={[sampleDomain]} api={mockApi} />
    )

    const container = view.container
    const html = container.innerHTML

    expect(html).not.toContain("text-white")
    expect(html).not.toContain("hover:text-white")
    expect(html).not.toContain("border-white")
    expect(html).not.toContain("bg-black")
    expect(html).not.toContain("bg-neutral-900")
  })

  it("does not contain hardcoded white borders in legacy mode form", () => {
    const legacyDomains: Record<string, CustomDomain[]> = {
      prod: [],
    }
    const setDomainsMock = mock(() => {})

    const view = render(
      <TabDomains
        selectedEnv="prod"
        domains={legacyDomains}
        setDomains={setDomainsMock}
      />
    )

    const container = view.container
    const html = container.innerHTML

    expect(html).not.toContain("border-white/[0.06]")
  })

  it("renders Reverse Proxy Ingress as a collapsed advanced section and toggles Trust Forwarded Headers switch", () => {
    const view = render(
      <TabDomains stackSlug="shop" apiDomains={[sampleDomain]} api={mockApi} />
    )

    expect(view.getByText("Reverse Proxy Ingress")).toBeDefined()
    expect(view.queryByText("Trust Forwarded Headers")).toBeNull()

    fireEvent.click(view.getByText("Reverse Proxy Ingress"))

    const trustProxySwitch = view.getByRole("switch", {
      name: "Trust Forwarded Headers",
    })
    expect(trustProxySwitch.getAttribute("aria-checked")).toBe("false")
    expect(
      view.getByText(
        "Off by default. Turn this on only if you're behind a proxy and need real client IPs in your app."
      )
    ).toBeDefined()

    fireEvent.click(trustProxySwitch)
    expect(trustProxySwitch.getAttribute("aria-checked")).toBe("true")
    expect(
      view.getByText(
        "Trust proxies is active. Real client IPs will be available to application code."
      )
    ).toBeDefined()
  })

  it("shows the managed default domain as ready without exposing Verify/DNS-target/certificate-upload controls", () => {
    const managedDomain: TenantDomainDTO = {
      ...sampleDomain,
      id: "dom-managed",
      hostname: "shop.pfnapp.dev",
      kind: "MANAGED",
      dnsStatus: "PENDING",
    }
    const view = render(
      <TabDomains stackSlug="shop" apiDomains={[managedDomain]} api={mockApi} />
    )

    expect(
      view.getByText(
        "Included by default and already reachable. You usually don't need to manage DNS or SSL for it."
      )
    ).toBeDefined()
    expect(view.queryByText("Verify")).toBeNull()
    expect(view.queryByText("DNS targets")).toBeNull()
    expect(view.queryByText("Certificate PEM")).toBeNull()
    expect(
      view.getByLabelText(`Delete domain ${managedDomain.hostname}`)
    ).toBeDefined()
  })
})
