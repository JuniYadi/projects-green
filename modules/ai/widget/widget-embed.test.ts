import { beforeEach, describe, expect, it } from "bun:test"
import { readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"

describe("widget embed script (public/widget.js)", () => {
  const widgetScriptPath = resolve(__dirname, "../../../public/widget.js")
  const scriptContent = readFileSync(widgetScriptPath, "utf-8")

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = ""
    localStorage.clear()
    const win = window as unknown as Record<string, unknown>
    delete win.__PFNAPP_WIDGET_LOADED__
  })

  it("should have bundle size less than 15KB", () => {
    const stat = statSync(widgetScriptPath)
    expect(stat.size).toBeLessThan(15 * 1024)
    expect(stat.size).toBeGreaterThan(500)
  })

  it("should mount inside Shadow Root with custom root element", () => {
    // Setup script element in DOM
    const scriptEl = document.createElement("script")
    scriptEl.setAttribute("data-agent-id", "test-agent-123")
    scriptEl.setAttribute("data-color", "#2563EB")
    scriptEl.setAttribute("data-position", "bottom-left")
    document.body.appendChild(scriptEl)

    // Execute script in browser context
    const fn = new Function(scriptContent)
    fn()

    const rootEl = document.getElementById("pfnapp-chat-widget-root")
    expect(rootEl).not.toBeNull()
    expect(rootEl?.shadowRoot).not.toBeNull()

    const launcherBtn = rootEl?.shadowRoot?.getElementById("launcher-btn")
    expect(launcherBtn).not.toBeNull()

    const chatWin = rootEl?.shadowRoot?.getElementById("chat-win")
    expect(chatWin).not.toBeNull()
    expect(chatWin?.classList.contains("hidden")).toBe(true)

    // Check visitorId generated in localStorage
    const visitorKey = "pfnapp_widget_visitor_id_test-agent-123"
    const visitorId = localStorage.getItem(visitorKey)
    expect(visitorId).not.toBeNull()
    expect(visitorId?.startsWith("vis_")).toBe(true)
  })

  it("should toggle open/closed on launcher and close click", () => {
    const scriptEl = document.createElement("script")
    scriptEl.setAttribute("data-agent-id", "test-agent-toggle")
    document.body.appendChild(scriptEl)

    const fn = new Function(scriptContent)
    fn()

    const rootEl = document.getElementById("pfnapp-chat-widget-root")
    const launcherBtn = rootEl?.shadowRoot?.getElementById("launcher-btn")
    const closeBtn = rootEl?.shadowRoot?.getElementById("close-btn")
    const chatWin = rootEl?.shadowRoot?.getElementById("chat-win")

    expect(chatWin?.classList.contains("hidden")).toBe(true)

    // Open chat
    launcherBtn?.click()
    expect(chatWin?.classList.contains("hidden")).toBe(false)

    // Close chat
    closeBtn?.click()
    expect(chatWin?.classList.contains("hidden")).toBe(true)
  })

  it("should render welcome message by default in box", () => {
    const scriptEl = document.createElement("script")
    scriptEl.setAttribute("data-agent-id", "test-agent-welcome")
    scriptEl.setAttribute(
      "data-welcome-message",
      "Halo selamat datang di toko!"
    )
    document.body.appendChild(scriptEl)

    const fn = new Function(scriptContent)
    fn()

    const rootEl = document.getElementById("pfnapp-chat-widget-root")
    const msgsBox = rootEl?.shadowRoot?.getElementById("msgs-box")
    expect(msgsBox?.textContent).toContain("Halo selamat datang di toko!")
  })
})
