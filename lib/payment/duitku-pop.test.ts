import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test"
import { loadDuitkuScript, launchDuitkuPop } from "./duitku-pop"

describe("duitku-pop client helper", () => {
  let originalWindow: typeof globalThis.window

  beforeEach(() => {
    originalWindow = globalThis.window
  })

  afterEach(() => {
    globalThis.window = originalWindow
  })

  it("handles server-side execution gracefully when window is undefined", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).window
    const loadResult = await loadDuitkuScript("https://example.com/duitku.js")
    expect(loadResult).toBe(false)

    const launchResult = await launchDuitkuPop({ reference: "REF1" })
    expect(launchResult).toBe(false)
  })

  it("calls checkout.process when checkout is already on window", async () => {
    const mockProcess = mock(() => {})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).window = {
      checkout: {
        process: mockProcess,
      },
    }

    const onSuccess = mock(() => {})
    const launched = await launchDuitkuPop({
      reference: "DUI-POP-99",
      onSuccess,
    })

    expect(launched).toBe(true)
    expect(mockProcess).toHaveBeenCalled()
  })

  it("falls back to window.location.href when script cannot load and fallbackUrl is provided", async () => {
    const locationStub = { href: "" }
    const appendChildStub = mock((node: unknown) => {
      // Simulate script error
      setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(node as any).onerror?.(new Event("error"))
      }, 0)
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).window = {
      location: locationStub,
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).document = {
      querySelector: () => null,
      createElement: () => ({
        set src(val: string) {},
        addEventListener: () => {},
      }),
      body: {
        appendChild: appendChildStub,
      },
    }

    const launched = await launchDuitkuPop({
      reference: "DUI-POP-99",
      fallbackUrl: "https://sandbox.duitku.com/redirect",
    })

    expect(launched).toBe(true)
    expect(locationStub.href).toBe("https://sandbox.duitku.com/redirect")
  })
})
