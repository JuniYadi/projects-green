import {
  VaultAuthError,
  VaultNetworkError,
  VaultSecretNotFoundError,
} from "./vault-errors"
import {
  getVaultConfig,
  parseVaultConfig,
  type VaultConfig,
  type VaultEnvironment,
} from "./vault-config"

export {
  VaultAuthError,
  VaultNetworkError,
  VaultSecretNotFoundError,
} from "./vault-errors"

export type VaultFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

export type VaultKVWriteResult = {
  version: number
  createdTime: string | null
  deletionTime: string | null
  destroyed: boolean
}

export type VaultKVMetadata = {
  createdTime: string | null
  updatedTime: string | null
  currentVersion: number
  oldestVersion: number | null
  maxVersions: number | null
  casRequired: boolean | null
  deleteVersionAfter: string | null
}

export type VaultClientOptions = {
  config?: VaultConfig
  environment?: VaultEnvironment
  fetcher?: VaultFetch
  now?: () => number
}

type CachedToken = {
  token: string
  expiresAt: number
  renewable: boolean
}

type VaultResponse = {
  data?: Record<string, unknown>
  auth?: Record<string, unknown>
}

const DEFAULT_FETCHER: VaultFetch = (input, init) => fetch(input, init)

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

const asNullableString = (value: unknown): string | null =>
  typeof value === "string" ? value : null

const asNullableNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null

const asBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === "boolean" ? value : fallback

const normalizePath = (path: string): string => {
  const normalized = path.trim().replace(/^\/+|\/+$/g, "")

  if (
    !normalized ||
    normalized.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new VaultNetworkError("Vault path must contain valid segments")
  }

  return normalized
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")
}

const asStringRecord = (
  value: unknown,
  message: string
): Record<string, string> => {
  const record = asRecord(value)
  if (!record) {
    throw new VaultNetworkError(message)
  }

  const result: Record<string, string> = {}
  for (const [key, item] of Object.entries(record)) {
    if (typeof item !== "string") {
      throw new VaultNetworkError(message)
    }
    result[key] = item
  }

  return result
}

export class VaultClient {
  private readonly config: VaultConfig | (() => VaultConfig)
  private readonly fetcher: VaultFetch
  private readonly now: () => number
  private cachedToken: CachedToken | null = null
  private tokenRefresh: Promise<string> | null = null

  constructor(options: VaultClientOptions = {}) {
    this.config =
      options.config ??
      (options.environment
        ? () => parseVaultConfig(options.environment ?? {})
        : () => getVaultConfig())
    this.fetcher = options.fetcher ?? DEFAULT_FETCHER
    this.now = options.now ?? Date.now
  }

  async writeKV(
    path: string,
    secrets: Record<string, string>
  ): Promise<VaultKVWriteResult> {
    const response = await this.requestWithToken(
      "POST",
      `/data/${normalizePath(path)}`,
      { data: secrets }
    )
    const metadata = this.getResponseMetadata(response)
    const version = asNullableNumber(metadata.version)

    if (version === null) {
      throw new VaultNetworkError(
        "Vault write response did not include a version"
      )
    }

    return {
      version,
      createdTime: asNullableString(metadata.created_time),
      deletionTime: asNullableString(metadata.deletion_time),
      destroyed: asBoolean(metadata.destroyed),
    }
  }

  async readKV(
    path: string,
    version?: number
  ): Promise<Record<string, string>> {
    const suffix = version === undefined ? "" : `?version=${version}`
    const response = await this.requestWithToken(
      "GET",
      `/data/${normalizePath(path)}${suffix}`
    )
    const data = asRecord(response.data)?.data

    return asStringRecord(
      data,
      "Vault read response did not contain secret data"
    )
  }

  async deleteKV(path: string): Promise<void> {
    await this.requestWithToken("DELETE", `/metadata/${normalizePath(path)}`)
  }

  async getKVMetadata(path: string): Promise<VaultKVMetadata> {
    const response = await this.requestWithToken(
      "GET",
      `/metadata/${normalizePath(path)}`
    )
    const metadata = this.getResponseMetadata(response)

    return {
      createdTime: asNullableString(metadata.created_time),
      updatedTime: asNullableString(metadata.updated_time),
      currentVersion: asNullableNumber(metadata.current_version) ?? 0,
      oldestVersion: asNullableNumber(metadata.oldest_version),
      maxVersions: asNullableNumber(metadata.max_versions),
      casRequired:
        typeof metadata.cas_required === "boolean"
          ? metadata.cas_required
          : null,
      deleteVersionAfter: asNullableString(metadata.delete_version_after),
    }
  }

  async listKV(prefix: string): Promise<string[]> {
    const response = await this.requestWithToken(
      "GET",
      `/metadata/${normalizePath(prefix)}?list=true`
    )
    const data = asRecord(response.data)?.keys

    if (
      !Array.isArray(data) ||
      !data.every((item) => typeof item === "string")
    ) {
      throw new VaultNetworkError("Vault list response did not contain keys")
    }

    return data
  }

  clearTokenCache(): void {
    this.cachedToken = null
  }

  private getConfig(): VaultConfig {
    return typeof this.config === "function" ? this.config() : this.config
  }

  private getResponseMetadata(
    response: VaultResponse
  ): Record<string, unknown> {
    const data = asRecord(response.data)
    const metadata = data?.metadata

    return asRecord(metadata) ?? data ?? {}
  }

  private async requestWithToken(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<VaultResponse> {
    const token = await this.getToken()
    return this.requestJson(method, path, token, body)
  }

  private async requestJson(
    method: string,
    path: string,
    token?: string,
    body?: Record<string, unknown>
  ): Promise<VaultResponse> {
    const config = this.getConfig()
    const headers: Record<string, string> = {
      Accept: "application/json",
    }

    if (body !== undefined) {
      headers["Content-Type"] = "application/json"
    }
    if (token) {
      headers["X-Vault-Token"] = token
    }
    if (config.namespace) {
      headers["X-Vault-Namespace"] = config.namespace
    }

    let response: Response
    try {
      const apiPath = path.startsWith("/auth/")
        ? path
        : `/${config.mountPath}${path}`
      response = await this.fetcher(`${config.address}/v1${apiPath}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (error) {
      throw new VaultNetworkError("Unable to reach Vault", { cause: error })
    }

    const text = await response.text().catch(() => "")
    let payload: VaultResponse = {}
    if (text) {
      try {
        payload = JSON.parse(text) as VaultResponse
      } catch (error) {
        throw new VaultNetworkError("Vault returned invalid JSON", {
          cause: error,
          status: response.status,
        })
      }
    }

    if (!response.ok) {
      throw this.toHttpError(response.status, payload)
    }

    return payload
  }

  private toHttpError(status: number, payload: VaultResponse): Error {
    const errors = asRecord(payload)?.errors
    const message = Array.isArray(errors)
      ? errors
          .filter((error): error is string => typeof error === "string")
          .join("; ")
      : `Vault request failed with status ${status}`

    if (status === 401 || status === 403) {
      return new VaultAuthError(message, { status })
    }
    if (status === 404) {
      return new VaultSecretNotFoundError(message, { status })
    }

    return new VaultNetworkError(message, { status })
  }

  private async getToken(): Promise<string> {
    const config = this.getConfig()
    const now = this.now()
    const bufferMs = config.tokenRenewBufferSeconds * 1000

    if (this.cachedToken && this.cachedToken.expiresAt > now + bufferMs) {
      return this.cachedToken.token
    }

    if (!this.tokenRefresh) {
      this.tokenRefresh = this.refreshToken().finally(() => {
        this.tokenRefresh = null
      })
    }

    return this.tokenRefresh
  }

  private async refreshToken(): Promise<string> {
    if (this.cachedToken?.renewable) {
      try {
        return await this.renewToken(this.cachedToken.token)
      } catch (error) {
        if (!(error instanceof VaultAuthError)) {
          throw error
        }
        this.cachedToken = null
      }
    }

    return this.login()
  }

  private async login(): Promise<string> {
    const config = this.getConfig()
    const response = await this.requestJson(
      "POST",
      "/auth/approle/login",
      undefined,
      {
        role_id: config.roleId,
        secret_id: config.secretId,
      }
    )

    return this.cacheAuthResponse(response, "AppRole login")
  }

  private async renewToken(token: string): Promise<string> {
    const response = await this.requestJson(
      "POST",
      "/auth/token/renew-self",
      token
    )

    return this.cacheAuthResponse(response, "Vault token renewal", token)
  }

  private cacheAuthResponse(
    response: VaultResponse,
    operation: string,
    fallbackToken?: string
  ): string {
    const auth = asRecord(response.auth)
    const token =
      (typeof auth?.client_token === "string" && auth.client_token) ||
      fallbackToken
    const leaseDuration = asNullableNumber(auth?.lease_duration)

    if (!token || leaseDuration === null) {
      throw new VaultAuthError(
        `${operation} response was missing token details`
      )
    }

    this.cachedToken = {
      token,
      expiresAt: this.now() + leaseDuration * 1000,
      renewable: asBoolean(auth?.renewable),
    }

    return token
  }
}
