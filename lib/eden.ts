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
  fetcher: (...args: Parameters<typeof fetch>) => fetch(...args),
})
