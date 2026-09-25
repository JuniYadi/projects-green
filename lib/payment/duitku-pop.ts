/**
 * Dynamic loader and checkout launcher for Duitku POP in-page modal.
 */

declare global {
  interface Window {
    checkout?: {
      process: (
        reference: string,
        options: {
          defaultLanguage?: "id" | "en"
          currency?: string
          successEvent?: (result: unknown) => void
          pendingEvent?: (result: unknown) => void
          errorEvent?: (result: unknown) => void
          closeEvent?: (result?: unknown) => void
        }
      ) => void
    }
  }
}

/**
 * Dynamically loads the Duitku JS script into document body.
 */
export function loadDuitkuScript(scriptUrl: string): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false)
  if (window.checkout) return Promise.resolve(true)

  return new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${scriptUrl}"]`)
    if (existing) {
      if (window.checkout) {
        resolve(true)
      } else {
        existing.addEventListener("load", () => resolve(true))
        existing.addEventListener("error", () => resolve(false))
      }
      return
    }

    const script = document.createElement("script")
    script.src = scriptUrl
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export interface LaunchDuitkuPopOptions {
  reference: string
  clientScriptUrl?: string
  fallbackUrl?: string
  defaultLanguage?: "id" | "en"
  onSuccess?: (result: unknown) => void
  onPending?: (result: unknown) => void
  onError?: (err: unknown) => void
  onClose?: () => void
}

/**
 * Launches the Duitku POP in-page checkout modal.
 * If the script fails to load, gracefully falls back to Window Redirection.
 */
export async function launchDuitkuPop(
  options: LaunchDuitkuPopOptions
): Promise<boolean> {
  if (typeof window === "undefined") return false

  const scriptUrl =
    options.clientScriptUrl || "https://app-sandbox.duitku.com/lib/js/duitku.js"

  const isLoaded = await loadDuitkuScript(scriptUrl)

  if (isLoaded && window.checkout) {
    window.checkout.process(options.reference, {
      defaultLanguage: options.defaultLanguage || "id",
      successEvent: (res) => {
        options.onSuccess?.(res)
      },
      pendingEvent: (res) => {
        options.onPending?.(res)
      },
      errorEvent: (err) => {
        options.onError?.(err)
      },
      closeEvent: () => {
        options.onClose?.()
      },
    })
    return true
  }

  // Fallback to Window Redirection if modal script cannot be loaded
  if (options.fallbackUrl) {
    window.location.href = options.fallbackUrl
    return true
  }

  return false
}
