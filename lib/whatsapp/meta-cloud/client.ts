import { MetaCloudError } from "./errors"
import { apiCallTracker } from "@/modules/whatsapp/rate-limit/rate-limit.service"

export type OperationHookEvent = {
  operation: string
  endpoint: string
  method: string
  request?: unknown
  status?: number
  response?: unknown
  error?: string
}

export type OperationHook = (event: OperationHookEvent) => Promise<void> | void

export interface MetaCloudHttpClientConfig {
  accessToken: string
  timeoutMs?: number
  operationHook?: OperationHook
  phoneNumberId?: string
}

export class MetaCloudHttpClient {
  private readonly accessToken: string
  private readonly timeoutMs: number
  private readonly operationHook?: OperationHook
  private readonly phoneNumberId?: string

  constructor(config: MetaCloudHttpClientConfig) {
    this.accessToken = config.accessToken
    this.timeoutMs = config.timeoutMs ?? 10000
    this.operationHook = config.operationHook
    this.phoneNumberId = config.phoneNumberId
  }

  async request<T>(
    operation: string,
    endpoint: string,
    method: "GET" | "POST" | "DELETE" = "GET",
    body?: unknown,
    retries = 3,
  ): Promise<T> {
    let lastError: Error | null = null
    let attempt = 0

    while (attempt <= retries) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${this.accessToken}`,
        }

        let requestBody: any = undefined
        if (body) {
          if (body instanceof FormData) {
            requestBody = body
          } else {
            headers["Content-Type"] = "application/json"
            requestBody = JSON.stringify(body)
          }
        }

        const response = await fetch(endpoint, {
          method,
          headers,
          body: requestBody,
          signal: controller.signal,
        })

        const responseData = await response.json().catch(() => ({}))

        await this.operationHook?.({
          operation,
          endpoint,
          method,
          request: body,
          status: response.status,
          response: responseData,
        })

        // Fire-and-forget: record API call for rate-limit tracking
        apiCallTracker.recordCall({
          operation,
          phoneNumberId: this.phoneNumberId,
          status: response.status,
        }).catch((err) => console.error("[MetaCloudHttpClient] recordCall failed:", err))

        if (response.ok) {
          return responseData as T
        }

        // Handle Rate Limit and 5xx
        const isRateLimit = response.status === 429 || (responseData.error?.code === 4 || responseData.error?.code === 80007)
        const isServerError = response.status >= 500

        if ((isRateLimit || isServerError) && attempt < retries) {
          const retryAfter = response.headers.get("Retry-After")
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000
          await new Promise((resolve) => setTimeout(resolve, delay))
          attempt++
          continue
        }

        throw new MetaCloudError(
          responseData.error?.message || `Request failed with status ${response.status}`,
          {
            code: responseData.error?.code,
            type: responseData.error?.type,
            fbtrace_id: responseData.error?.fbtrace_id,
            httpStatus: response.status,
          },
        )
      } catch (error: any) {
        lastError = error
        if (error.name === "AbortError") {
          lastError = new Error(`Request timeout after ${this.timeoutMs}ms`)
        }

        await this.operationHook?.({
          operation,
          endpoint,
          method,
          request: body,
          error: lastError?.message,
        })

        if (attempt >= retries) break
        
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000))
        attempt++
      } finally {
        clearTimeout(timeout)
      }
    }

    throw lastError || new Error("Unknown error during request")
  }
}
