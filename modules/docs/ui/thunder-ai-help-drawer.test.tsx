import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { render, act } from "@testing-library/react"

const mockReplace = mock(() => {})
const mockFetch = mock(
  async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({
        path: "/console",
        title: "Test Doc",
        purpose: "Test purpose",
        howTo: ["Step 1", "Step 2"],
        notes: ["Note 1", "Note 2"],
        updatedAt: "2024-01-01",
      }),
      preconnect: mock(() => {}),
    }) as unknown as Response
) as unknown as typeof fetch
const originalFetch = globalThis.fetch

let currentParams = ""
let ThunderAiHelpDrawer: React.ComponentType

describe("ThunderAiHelpDrawer", () => {
  beforeEach(async () => {
    mock.restore()
    globalThis.fetch = mockFetch
    currentParams = ""

    mock.module("next/navigation", () => ({
      useRouter: () => ({
        replace: mockReplace,
      }),
      usePathname: () => "/en/console",
      useSearchParams: () => new URLSearchParams(currentParams),
    }))

    mock.module("next/navigation.js", () => ({
      useRouter: () => ({
        replace: mockReplace,
      }),
      usePathname: () => "/en/console",
      useSearchParams: () => new URLSearchParams(currentParams),
    }))

    const mod = await import("./thunder-ai-help-drawer")
    ThunderAiHelpDrawer = mod.ThunderAiHelpDrawer
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  async function renderDrawer(params = "doc=1") {
    currentParams = params

    let view: ReturnType<typeof render> | undefined

    await act(async () => {
      view = render(
        <ThunderAiHelpDrawer />
      )
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
        view.getByRole("heading", { name: "Thunder AI Help" })
      ).toBeTruthy()
      expect(view.getByText("Page Guides")).toBeTruthy()
    })

    it("renders chat tab when kb=1 is set", async () => {
      const view = await renderDrawer("kb=1")

      expect(
        view.getByRole("heading", { name: "Thunder AI Help" })
      ).toBeTruthy()
      expect(view.getByText("Thunder AI Assistant")).toBeTruthy()
      expect(
        view.getByPlaceholderText("Ask about this page or system workflows...")
      ).toBeTruthy()
    })
  })

  describe("tab switching", () => {
    it("renders both tab buttons in docs mode", async () => {
      const view = await renderDrawer("doc=1")

      expect(view.getByText("Thunder AI Chat")).toBeTruthy()
      expect(view.getByText("Page Guides")).toBeTruthy()
    })

    it("renders both tab buttons in chat mode", async () => {
      const view = await renderDrawer("kb=1")

      expect(view.getByText("Thunder AI Chat")).toBeTruthy()
      expect(view.getByText("Page Guides")).toBeTruthy()
    })

    it("switches to chat tab when clicking Thunder AI Chat button", async () => {
      const view = await renderDrawer("doc=1")

      const chatTab = view.getByText("Thunder AI Chat")
      await act(async () => {
        chatTab.click()
      })

      expect(mockReplace).toHaveBeenCalled()
    })

    it("switches to docs tab when clicking Page Guides button", async () => {
      const view = await renderDrawer("kb=1")

      const docsTab = view.getByText("Page Guides")
      await act(async () => {
        docsTab.click()
      })

      expect(mockReplace).toHaveBeenCalled()
    })
  })

  describe("AI Help button", () => {
    it("opens docs drawer when clicked", async () => {
      const view = await renderDrawer("")

      const button = view.getByText("AI Help")
      await act(async () => {
        button.click()
      })

      expect(mockReplace).toHaveBeenCalled()
      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining("doc=1"),
        expect.any(Object)
      )
    })
  })

  describe("chat tab UI", () => {
    it("shows suggested questions when no messages", async () => {
      const view = await renderDrawer("kb=1")

      expect(view.getByText("Suggested Questions")).toBeTruthy()
    })

    it("renders starter prompt buttons", async () => {
      const view = await renderDrawer("kb=1")

      expect(view.getByText(/Tell me about/)).toBeTruthy()
      expect(
        view.getByText("What are some common tasks I can do here?")
      ).toBeTruthy()
      expect(
        view.getByText("How does deployment work in this cluster?")
      ).toBeTruthy()
    })

    it("renders input field", async () => {
      const view = await renderDrawer("kb=1")

      expect(
        view.getByPlaceholderText("Ask about this page or system workflows...")
      ).toBeTruthy()
    })

    it("renders send button", async () => {
      const view = await renderDrawer("kb=1")

      const buttons = view.getAllByRole("button")
      expect(buttons.length).toBeGreaterThan(3)
    })
  })

  describe("drawer header", () => {
    it("shows correct title", async () => {
      const view = await renderDrawer("doc=1")

      expect(view.getByText("Thunder AI Help")).toBeTruthy()
    })

    it("shows route path in description", async () => {
      const view = await renderDrawer("doc=1")

      expect(view.getByText(/\/console/)).toBeTruthy()
    })
  })

  describe("drawer closed state", () => {
    it("does not render sheet when no params are set", async () => {
      const view = await renderDrawer("")

      expect(
        view.queryByRole("heading", { name: "Thunder AI Help" })
      ).toBeNull()
    })
  })

  describe("network calls", () => {
    it("fetch is called when drawer opens in docs mode", async () => {
      await renderDrawer("doc=1")

      expect(mockFetch).toHaveBeenCalled()
    })

    it("fetch is called when drawer opens in chat mode", async () => {
      await renderDrawer("kb=1")

      expect(mockFetch).toHaveBeenCalled()
    })
  })

  describe("starter prompt clicks", () => {
    it("calls router when starter prompt is clicked", async () => {
      const view = await renderDrawer("kb=1")

      const prompt = view.getByText(/Tell me about/)
      await act(async () => {
        prompt.click()
      })

      expect(mockReplace).toHaveBeenCalled()
    })
  })
})
