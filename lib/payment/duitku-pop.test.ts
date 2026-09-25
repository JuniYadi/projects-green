import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test"
import { loadDuitkuScript, launchDuitkuPop } from "./duitku-pop"

describe("duitku-pop client helper", () => {
  let originalWindow: typeof globalThis.window
  let originalDocument: typeof globalThis.document

  beforeEach(() => {
    originalWindow = globalThis.window
    originalDocument = globalThis.document
  })

  afterEach(() => {
    globalThis.window = originalWindow
    globalThis.document = originalDocument
  })

  it("handles server-side execution gracefully when window is undefined", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).window
    const loadResult = await loadDuitkuScript("https://example.com/duitku.js")
    expect(loadResult).toBe(false)

    const launchResult = await launchDuitkuPop({ reference: "REF1" })
    expect(launchResult).toBe(false)
  })

  it("calls checkout.process and triggers all callback events", async () => {
    let capturedOptions:
      | {
          defaultLanguage?: "id" | "en"
          successEvent?: (result: unknown) => void
          pendingEvent?: (result: unknown) => void
          errorEvent?: (result: unknown) => void
          closeEvent?: () => void
        }
      | undefined

    const mockProcess = mock(
      (_ref: string, options: typeof capturedOptions) => {
        capturedOptions = options
      }
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).window = {
      checkout: {
        process: mockProcess,
      },
    }

    const onSuccess = mock(() => {})
    const onPending = mock(() => {})
    const onError = mock(() => {})
    const onClose = mock(() => {})

    const launched = await launchDuitkuPop({
      reference: "DUI-POP-99",
      defaultLanguage: "en",
      onSuccess,
      onPending,
      onError,
      onClose,
    })

    expect(launched).toBe(true)
    expect(mockProcess).toHaveBeenCalledWith("DUI-POP-99", expect.any(Object))
    expect(capturedOptions?.defaultLanguage).toBe("en")

    // Test each callback
    capturedOptions?.successEvent?.({ status: "00" })
    expect(onSuccess).toHaveBeenCalledWith({ status: "00" })

    capturedOptions?.pendingEvent?.({ status: "01" })
    expect(onPending).toHaveBeenCalledWith({ status: "01" })

    capturedOptions?.errorEvent?.({ status: "err" })
    expect(onError).toHaveBeenCalledWith({ status: "err" })

    capturedOptions?.closeEvent?.()
    expect(onClose).toHaveBeenCalled()
  })

  it("loads script dynamically via document.createElement on happy path", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let createdScript: any
    const appendChildStub = mock((node: unknown) => {
      createdScript = node
      setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(globalThis as any).window.checkout = {
          process: mock(() => {}),
        }
        createdScript.onload?.(new Event("load"))
      }, 0)
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).window = {}
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

    const loaded = await loadDuitkuScript(
      "https://app-sandbox.duitku.com/lib/js/duitku.js"
    )
    expect(loaded).toBe(true)
    expect(appendChildStub).toHaveBeenCalled()
  })

  it("resolves true when existing script element is in DOM with window.checkout", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).window = {
      checkout: { process: () => {} },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).document = {
      querySelector: () => ({}),
    }

    const loaded = await loadDuitkuScript("https://example.com/existing.js")
    expect(loaded).toBe(true)
  })

  it("attaches load and error listeners when existing script is loading", async () => {
    const listeners: Record<string, () => void> = {}
    const existingElement = {
      addEventListener: (evt: string, fn: () => void) => {
        listeners[evt] = fn
      },
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).window = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).document = {
      querySelector: () => existingElement,
    }

    const loadPromise = loadDuitkuScript("https://example.com/loading.js")
    expect(listeners.load).toBeDefined()
    listeners.load()
    const result = await loadPromise
    expect(result).toBe(true)

    // Test error listener on existing
    const errorListeners: Record<string, () => void> = {}
    const existingErrorElement = {
      addEventListener: (evt: string, fn: () => void) => {
        errorListeners[evt] = fn
      },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).document = {
      querySelector: () => existingErrorElement,
    }
    const errorPromise = loadDuitkuScript("https://example.com/loading-err.js")
    errorListeners.error()
    const errorResult = await errorPromise
    expect(errorResult).toBe(false)
  })

  it("falls back to window.location.href when script cannot load and fallbackUrl is provided", async () => {
    const locationStub = { href: "" }
    const appendChildStub = mock((node: unknown) => {
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

  it("returns false when script fails to load and no fallbackUrl is provided", async () => {
    const appendChildStub = mock((node: unknown) => {
      setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(node as any).onerror?.(new Event("error"))
      }, 0)
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).window = {}
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
      reference: "DUI-POP-NO-FALLBACK",
    })

    expect(launched).toBe(false)
  })
})
