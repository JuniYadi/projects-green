import { edenTreaty } from "@elysia/eden"

import type { App } from "@/lib/api"

const DEV_FALLBACK_BASE_URL = "http://localhost:3300"

export const getApiBaseUrl = () => {
  const envBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()

  if (envBaseUrl) {
    return envBaseUrl.replace(/\/+$/, "")
  }

  if (typeof window !== "undefined") {
    return window.location.origin
  }

  return DEV_FALLBACK_BASE_URL
}

export const eden = edenTreaty<App>(getApiBaseUrl(), {
   // Delegate to globalThis.fetch at call time so tests can replace it between
  // module init and test execution without the eden client holding a stale ref.
  fetcher: ((...args: Parameters<typeof fetch>) =>
    globalThis.fetch(...args)) as typeof fetch,
})
