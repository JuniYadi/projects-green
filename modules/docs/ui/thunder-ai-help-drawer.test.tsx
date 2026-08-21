import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { render, act, type RenderResult } from "@testing-library/react"

const mockReplace = mock(() => {})
let currentPathname = "/en/console"
let currentParams = ""

mock.module("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mock(() => {}),
  }),
  usePathname: () => currentPathname,
  useSearchParams: () => new URLSearchParams(currentParams),
}))

const mockFetch = mock(
  async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        path: "/console",
        title: "Console Overview Guide",
        purpose: "Test purpose",
        howTo: ["Step 1", "Step 2"],
        notes: ["Note 1", "Note 2"],
        updatedAt: "2026-05-16",
      }),
      preconnect: mock(() => {}),
    }) as unknown as Response
)
const originalFetch = globalThis.fetch

import { ThunderAiHelpDrawer } from "./thunder-ai-help-drawer"

describe("ThunderAiHelpDrawer", () => {
  beforeEach(() => {
    mockFetch.mockClear()
    mockReplace.mockClear()
    globalThis.fetch = mockFetch as unknown as typeof fetch
    currentPathname = "/en/console"
    currentParams = ""
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  async function renderDrawer(params = "doc=1", pathname = "/en/console") {
    currentParams = params
    currentPathname = pathname

    let view: RenderResult | undefined

    await act(async () => {
      view = render(<ThunderAiHelpDrawer />)
    })

    return view!
  }

  describe("initial render", () => {
    it("renders AI Help button", async () => {
      const view = await renderDrawer("")

      expect(view.getByText("AI Help")).toBeTruthy()
    })

    it("renders drawer when doc=1 is set", async () => {
      const view = await renderDrawer("doc=1")

      expect(
        view.getByRole("heading", { name: "AI Help & Knowledge" })
      ).toBeTruthy()
      expect(view.getByText("Page Guides")).toBeTruthy()
    })

    it("renders chat tab when kb=1 is set", async () => {
      const view = await renderDrawer("kb=1")

      expect(
        view.getByRole("heading", { name: "AI Help & Knowledge" })
      ).toBeTruthy()
      expect(view.getByText("PFNApp AI Assistant")).toBeTruthy()
      expect(
        view.getByPlaceholderText(
          "Ask anything about this page or workflows..."
        )
      ).toBeTruthy()
    })
  })

  describe("tab switching", () => {
    it("renders both tab buttons in docs mode", async () => {
      const view = await renderDrawer("doc=1")

      expect(view.getByText("Ask AI")).toBeTruthy()
      expect(view.getByText("Page Guides")).toBeTruthy()
    })

    it("renders both tab buttons in chat mode", async () => {
      const view = await renderDrawer("kb=1")

      expect(view.getByText("Ask AI")).toBeTruthy()
      expect(view.getByText("Page Guides")).toBeTruthy()
    })

    it("switches to chat tab when clicking Ask AI button", async () => {
      const view = await renderDrawer("doc=1")

      const chatTab = view.getByText("Ask AI")
      await act(async () => {
        chatTab.click()
      })

      expect(mockReplace).toHaveBeenCalled()
      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining("kb=1"),
        expect.any(Object)
      )
    })

    it("switches to docs tab when clicking Page Guides button", async () => {
      const view = await renderDrawer("kb=1")

      const docsTab = view.getByText("Page Guides")
      await act(async () => {
        docsTab.click()
      })

      expect(mockReplace).toHaveBeenCalled()
      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining("doc=1"),
        expect.any(Object)
      )
    })
  })

  describe("AI Help button", () => {
    it("opens chat drawer by default when clicked", async () => {
      const view = await renderDrawer("")

      const button = view.getByText("AI Help")
      await act(async () => {
        button.click()
      })

      expect(mockReplace).toHaveBeenCalled()
      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining("kb=1"),
        expect.any(Object)
      )
    })
  })

  describe("chat tab UI", () => {
    it("shows suggested questions when no messages", async () => {
      const view = await renderDrawer("kb=1")

      expect(view.getByText("Suggested Questions")).toBeTruthy()
    })

    it("renders contextual starter prompt buttons for console overview", async () => {
      const view = await renderDrawer("kb=1", "/en/console")

      expect(
        view.getByText("How do I top up my organization balance?")
      ).toBeTruthy()
      expect(
        view.getByText("How do I connect and configure a WhatsApp number?")
      ).toBeTruthy()
    })

    it("renders input field and send button", async () => {
      const view = await renderDrawer("kb=1")

      expect(
        view.getByPlaceholderText(
          "Ask anything about this page or workflows..."
        )
      ).toBeTruthy()

      const buttons = view.getAllByRole("button")
      expect(buttons.length).toBeGreaterThan(2)
    })
  })

  describe("related documentation section", () => {
    it("renders related guides and full docs link in Page Guides tab", async () => {
      const view = await renderDrawer("doc=1", "/en/console")

      expect(
        view.getByText("📖 Related Guides from Documentation")
      ).toBeTruthy()
      expect(
        view.getByText("Browse Full Documentation Portal (/docs) ↗")
      ).toBeTruthy()
    })
  })

  describe("localization", () => {
    it("renders Indonesian copy when locale is id", async () => {
      const view = await renderDrawer("kb=1", "/id/console")

      expect(view.getByText("Bantuan AI")).toBeTruthy()
      expect(
        view.getByRole("heading", { name: "Pusat Bantuan & AI" })
      ).toBeTruthy()
      expect(view.getByText("Tanya AI")).toBeTruthy()
      expect(view.getByText("Artikel Panduan")).toBeTruthy()
      expect(view.getByText("Pertanyaan Populer")).toBeTruthy()
      expect(
        view.getByText("Bagaimana cara isi ulang saldo deposit organisasi?")
      ).toBeTruthy()
    })
  })

  describe("drawer closed state", () => {
    it("does not render sheet content when no params are set", async () => {
      const view = await renderDrawer("")

      expect(
        view.queryByRole("heading", { name: "AI Help & Knowledge" })
      ).toBeNull()
    })
  })

  describe("network calls", () => {
    it("fetch is called when drawer opens in docs mode", async () => {
      await renderDrawer("doc=1")

      expect(mockFetch).toHaveBeenCalled()
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/knowledge/docs?path=%2Fconsole",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })

    it("does not load page docs when drawer opens in chat mode", async () => {
      await renderDrawer("kb=1")

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe("starter prompt clicks", () => {
    it("sends a chat request when starter prompt is clicked", async () => {
      const view = await renderDrawer("kb=1")

      const prompt = view.getByText("How do I top up my organization balance?")
      await act(async () => {
        prompt.click()
      })

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/knowledge/chat",
        expect.objectContaining({ method: "POST" })
      )
    })
  })
})
