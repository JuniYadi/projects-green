import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"

const mockPut = mock(() =>
  Promise.resolve({
    data: { ok: true },
  })
)

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      console: {
        ai: {
          agents: {
            agent_test_1: {
              put: mockPut,
            },
          },
        },
      },
    },
  },
}))

mock.module("sonner", () => ({
  toast: {
    success: mock(() => {}),
    error: mock(() => {}),
  },
}))

import WidgetEmbedCustomizer, {
  isValidDomainPattern,
} from "./widget-embed-customizer"

describe("WidgetEmbedCustomizer", () => {
  const mockAgent = {
    id: "agent_test_1",
    name: "Tanya P",
    widgetColor: "#10B981",
    widgetPosition: "bottom-right",
    welcomeMessage: "Halo! Ada yang bisa kami bantu?",
    allowedDomains: ["*.toko.co.id", "klinik.com"],
  }

  const originalClipboard = navigator.clipboard

  beforeEach(() => {
    mockPut.mockClear()
    // Setup mock clipboard
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: mock(() => Promise.resolve()),
      },
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    cleanup()
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      configurable: true,
      writable: true,
    })
  })

  describe("isValidDomainPattern", () => {
    it("validates exact domains and wildcard subdomains", () => {
      expect(isValidDomainPattern("klinik.com")).toBe(true)
      expect(isValidDomainPattern("*.toko.co.id")).toBe(true)
      expect(isValidDomainPattern("sub.domain.co.id")).toBe(true)
      expect(isValidDomainPattern("localhost")).toBe(true)
      expect(isValidDomainPattern("localhost:3000")).toBe(true)
      expect(isValidDomainPattern("127.0.0.1:8080")).toBe(true)
      expect(isValidDomainPattern("*")).toBe(true)
      expect(isValidDomainPattern("https://example.com")).toBe(true)
    })

    it("rejects invalid domain patterns", () => {
      expect(isValidDomainPattern("")).toBe(false)
      expect(isValidDomainPattern("   ")).toBe(false)
      expect(isValidDomainPattern("invalid..domain")).toBe(false)
      expect(isValidDomainPattern("http://")).toBe(false)
      expect(isValidDomainPattern("not-a-valid-tld")).toBe(false)
    })
  })

  it("updates live preview color when color preset or input changes", () => {
    const { getByText, getByLabelText, getByRole } = render(
      <WidgetEmbedCustomizer
        agents={[mockAgent]}
        selectedAgentId="agent_test_1"
        lang="id"
      />
    )

    // Initially #10B981
    const launcherBtn = getByRole("button", {
      name: /Toggle widget launcher preview/i,
    })
    expect(launcherBtn.style.backgroundColor).toBe("#10B981")

    // Click preset Blue (#2563EB)
    const bluePreset = getByText("Blue")
    fireEvent.click(bluePreset)

    expect(launcherBtn.style.backgroundColor).toBe("#2563EB")

    // Change via color input
    const colorInput = getByLabelText("Warna Tema Utama")
    fireEvent.change(colorInput, { target: { value: "#7C3AED" } })

    expect(launcherBtn.style.backgroundColor.toLowerCase()).toBe("#7c3aed")
  })

  it("toggles launcher position between bottom-right and bottom-left", () => {
    const { getByText, getByRole } = render(
      <WidgetEmbedCustomizer
        agents={[mockAgent]}
        selectedAgentId="agent_test_1"
        lang="id"
      />
    )

    const launcherBtn = getByRole("button", {
      name: /Toggle widget launcher preview/i,
    })
    const launcherContainer = launcherBtn.parentElement
    expect(launcherContainer?.className).toContain("right-4")

    // Click Kiri Bawah
    const leftBtn = getByText("Kiri Bawah")
    fireEvent.click(leftBtn)

    expect(launcherContainer?.className).toContain("left-4")

    // Click Kanan Bawah
    const rightBtn = getByText("Kanan Bawah")
    fireEvent.click(rightBtn)

    expect(launcherContainer?.className).toContain("right-4")
  })

  it("copies HTML and Next.js snippets in 1-click", async () => {
    const { getByText, getByRole } = render(
      <WidgetEmbedCustomizer
        agents={[mockAgent]}
        selectedAgentId="agent_test_1"
        lang="id"
      />
    )

    // Click copy in HTML tab
    const copyHtmlBtn = getByRole("button", { name: /Salin Kode/i })
    fireEvent.click(copyHtmlBtn)

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('src="https://app.pfnapp.com/widget.js"')
    )
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('data-agent-id="agent_test_1"')
    )

    await waitFor(() => {
      expect(getByText("Tersalin!")).toBeDefined()
    })

    // Switch to Next.js tab
    const nextjsTab = getByRole("tab", { name: /React \/ Next\.js/i })
    fireEvent.pointerDown(nextjsTab, { button: 0 })
    fireEvent.keyDown(nextjsTab, { key: "Enter" })

    const copyNextBtn = getByRole("button", { name: /Salin Kode/i })
    fireEvent.click(copyNextBtn)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('import Script from "next/script"')
      )
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('strategy="lazyOnload"')
      )
    })
  })

  it("validates allowed domains and handles save action", async () => {
    const onAgentUpdated = mock(() => {})
    const { getByText, getByLabelText } = render(
      <WidgetEmbedCustomizer
        agents={[mockAgent]}
        selectedAgentId="agent_test_1"
        onAgentUpdated={onAgentUpdated}
        lang="id"
      />
    )

    const domainsTextarea = getByLabelText(
      /Domain yang Diizinkan \(Whitelist\)/i
    )

    // Set invalid domain
    fireEvent.change(domainsTextarea, {
      target: { value: "invalid..domain\n*.valid.com" },
    })

    expect(getByText(/Format domain tidak valid:/i)).toBeDefined()
    const saveBtn = getByText("Simpan Pengaturan Widget")
    expect(saveBtn.hasAttribute("disabled")).toBe(true)

    // Fix to valid domains
    fireEvent.change(domainsTextarea, {
      target: { value: "my-shop.com, *.partner.co.id" },
    })

    expect(saveBtn.hasAttribute("disabled")).toBe(false)
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        expect.objectContaining({
          allowedDomains: ["my-shop.com", "*.partner.co.id"],
          widgetColor: "#10B981",
          widgetPosition: "bottom-right",
        })
      )
      expect(onAgentUpdated).toHaveBeenCalled()
    })
  })
})
