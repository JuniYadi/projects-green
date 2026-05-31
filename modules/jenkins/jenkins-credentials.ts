/**
 * Jenkins credential sync — credential CRUD + job management
 * Migrated from Laravel JenkinsCredentialHandler.php
 */

import type { EnvVar, Probe, Toleration } from "../deploy/deploy.helm"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JenkinsConfig {
  url: string
  username: string
  apiToken: string
}

export interface JenkinsBuildInfo {
  number: number | null
  result: string
  duration: number | null
  timestamp: number | null
  url: string | null
}

export interface JenkinsStage {
  id: string | null
  name: string
  status: string
  duration: string
  startTime: string | null
}

export interface JenkinsCredentialSyncResult {
  success: boolean
  credentialId?: string
  message: string
  error?: string
}

// ─── HTTP Auth Headers ───────────────────────────────────────────────────────

function getBasicAuthHeader(username: string, token: string): string {
  const creds = Buffer.from(`${username}:${token}`).toString("base64")
  return `Basic ${creds}`
}

function authHeaders(config: JenkinsConfig): Record<string, string> {
  return {
    Authorization: getBasicAuthHeader(config.username, config.apiToken),
    "Content-Type": "application/xml",
  }
}

// ─── Jenkins Client ──────────────────────────────────────────────────────────

export class JenkinsClient {
  constructor(private config: JenkinsConfig) {}

  private baseUrl(): string {
    return this.config.url.replace(/\/$/, "")
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl()}${path}`
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: getBasicAuthHeader(this.config.username, this.config.apiToken),
        ...options.headers,
      },
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Jenkins ${options.method ?? "GET"} ${path} failed: ${response.status} - ${text}`)
    }

    return response.json() as Promise<T>
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request<Record<string, unknown>>("/api/json")
      return true
    } catch {
      return false
    }
  }

  async jobExists(jobName: string): Promise<boolean> {
    try {
      const res = await this.request<Record<string, unknown>>(`/job/${jobName}/api/json`)
      return !!res
    } catch (e) {
      if (e instanceof Error && e.message.includes("404")) return false
      throw e
    }
  }

  async createJob(jobName: string, jobConfigXml: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl()}/createItem`, {
      method: "POST",
      headers: {
        Authorization: getBasicAuthHeader(this.config.username, this.config.apiToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ name: jobName }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Create job failed: ${res.status} - ${text}`)
    }
    return true
  }

  async triggerJob(jobName: string, parameters: Record<string, string> = {}): Promise<boolean> {
    // Get CSRF crumb
    const crumbRes = await this.request<{ crumbRequestField: string; crumb: string }>("/crumbIssuer/api/json")
    const headers: Record<string, string> = {}
    if (crumbRes.crumb) {
      headers[crumbRes.crumbRequestField] = crumbRes.crumb
    }

    const params = Object.keys(parameters).length > 0 ? parameters : { trigger: "manual" }
    const endpoint = `/job/${jobName}/buildWithParameters`

    const res = await fetch(`${this.baseUrl()}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: getBasicAuthHeader(this.config.username, this.config.apiToken),
        "Content-Type": "application/x-www-form-urlencoded",
        ...headers,
      },
      body: new URLSearchParams(params),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Trigger job failed: ${res.status} - ${text}`)
    }
    return true
  }

  async getBuildStatus(jobName: string, buildNumber?: number): Promise<JenkinsBuildInfo | null> {
    const path = buildNumber
      ? `/job/${jobName}/${buildNumber}/api/json`
      : `/job/${jobName}/lastBuild/api/json`

    try {
      const info = await this.request<{
        number: number
        result: string | null
        duration: number
        timestamp: number
        url: string
      }>(path)

      return {
        number: info.number,
        result: info.result ?? "IN_PROGRESS",
        duration: info.duration,
        timestamp: info.timestamp,
        url: info.url,
      }
    } catch {
      return null
    }
  }

  async getBuildStages(jobName: string, buildNumber?: number): Promise<JenkinsStage[] | null> {
    const path = buildNumber
      ? `/job/${jobName}/${buildNumber}/wfapi/describe`
      : `/job/${jobName}/lastBuild/wfapi/describe`

    try {
      const info = await this.request<{ stages: Array<{ id: string; name: string; status: string; durationMillis: number; startTimeMillis: number }> }>(path)

      return info.stages.map((s) => ({
        id: s.id,
        name: s.name,
        status: this.mapStageStatus(s.status),
        duration: this.formatDuration(s.durationMillis),
        startTime: s.startTimeMillis ? new Date(s.startTimeMillis).toISOString() : null,
      }))
    } catch {
      // Fallback: basic build info
      const build = await this.getBuildStatus(jobName, buildNumber)
      if (!build) return null

      return [{
        id: "build",
        name: "Build",
        status: this.mapBuildResult(build.result),
        duration: build.duration ? this.formatDuration(build.duration) : "N/A",
        startTime: build.timestamp ? new Date(build.timestamp).toISOString() : null,
      }]
    }
  }

  async getConsoleLog(jobName: string, buildNumber?: number): Promise<string | null> {
    const path = buildNumber
      ? `/job/${jobName}/${buildNumber}/consoleText`
      : `/job/${jobName}/lastBuild/consoleText`

    try {
      const res = await fetch(`${this.baseUrl()}${path}`, {
        headers: { Authorization: getBasicAuthHeader(this.config.username, this.config.apiToken) },
      })
      if (!res.ok) return null
      return res.text()
    } catch {
      return null
    }
  }

  async deleteJob(jobName: string): Promise<boolean> {
    // Get CSRF crumb first
    const crumbRes = await this.request<{ crumbRequestField: string; crumb: string }>("/crumbIssuer/api/json")
    const headers: Record<string, string> = {}
    if (crumbRes.crumb) {
      headers[crumbRes.crumbRequestField] = crumbRes.crumb
    }

    const res = await fetch(`${this.baseUrl()}/job/${jobName}`, {
      method: "DELETE",
      headers: {
        Authorization: getBasicAuthHeader(this.config.username, this.config.apiToken),
        ...headers,
      },
    })
    return res.ok
  }

  // ─── Credential Store (system domain) ─────────────────────────────────────

  async credentialExists(credentialId: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl()}/credentials/store/system/domain/_/credential/${credentialId}/config.xml`, {
        headers: { Authorization: getBasicAuthHeader(this.config.username, this.config.apiToken) },
      })
      return res.ok
    } catch {
      return false
    }
  }

  async deleteCredential(credentialId: string): Promise<boolean> {
    // Get CSRF crumb
    const crumbRes = await this.request<{ crumbRequestField: string; crumb: string }>("/crumbIssuer/api/json")
    const headers: Record<string, string> = {}
    if (crumbRes.crumb) {
      headers[crumbRes.crumbRequestField] = crumbRes.crumb
    }

    const res = await fetch(`${this.baseUrl()}/credentials/store/system/domain/_/credential/${credentialId}`, {
      method: "DELETE",
      headers: {
        Authorization: getBasicAuthHeader(this.config.username, this.config.apiToken),
        ...headers,
      },
    })
    return res.ok || res.status === 404
  }

  // ─── Status Mappers ───────────────────────────────────────────────────────

  private mapStageStatus(status: string): string {
    switch (status.toUpperCase()) {
      case "SUCCESS": return "success"
      case "FAILED": return "failed"
      case "IN_PROGRESS": return "running"
      case "ABORTED": return "failed"
      case "UNSTABLE": return "warning"
      case "NOT_EXECUTED": return "pending"
      default: return "unknown"
    }
  }

  private mapBuildResult(result: string | null): string {
    if (!result) return "running"
    switch (result.toUpperCase()) {
      case "SUCCESS": return "success"
      case "FAILURE": return "failed"
      case "ABORTED": return "failed"
      case "UNSTABLE": return "warning"
      case "NOT_BUILT": return "pending"
      default: return "unknown"
    }
  }

  private formatDuration(ms: number): string {
    if (ms <= 0) return "N/A"
    const s = Math.floor(ms / 1000)
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    const rem = s % 60
    if (m < 60) return rem > 0 ? `${m}m ${rem}s` : `${m}m`
    const h = Math.floor(m / 60)
    const remM = m % 60
    return remM > 0 ? `${h}h ${remM}m` : `${h}h`
  }
}

// ─── Credential Sync ────────────────────────────────────────────────────────

/**
 * Sync GitHub credentials to Jenkins credential store.
 * Called when a new GitHub credential is created or updated.
 */
export async function syncGitHubCredentialToJenkins(
  jenkinsClient: JenkinsClient,
  credentialId: string,
  githubToken: string,
  githubUsername: string
): Promise<JenkinsCredentialSyncResult> {
  try {
    const exists = await jenkinsClient.credentialExists(credentialId)
    if (exists) {
      return { success: true, credentialId, message: "Credential already exists in Jenkins" }
    }

    // Create GitHub token credential in Jenkins system store
    const configXml = buildGitHubCredentialXml(credentialId, githubToken, githubUsername)
    const createRes = await fetch(`${jenkinsClient["baseUrl"]()}/credentials/store/system/domain/_/credential/${credentialId}/config.xml`, {
      method: "POST",
      headers: {
        Authorization: getBasicAuthHeader(jenkinsClient["config"].username, jenkinsClient["config"].apiToken),
        "Content-Type": "application/xml",
      },
      body: configXml,
    })

    if (!createRes.ok) {
      return { success: false, message: "Failed to create credential in Jenkins", error: await createRes.text() }
    }

    return { success: true, credentialId, message: "GitHub credential synced to Jenkins" }
  } catch (error) {
    return { success: false, message: "Credential sync failed", error: error instanceof Error ? error.message : "Unknown" }
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function buildGitHubCredentialXml(id: string, token: string, username: string): string {
  return `<com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl>
 <id>${escapeXml(id)}</id>
  <username>${escapeXml(username)}</username>
  <password>${escapeXml(token)}</password>
  <description>GitHub Token for ${escapeXml(username)}</description>
</com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl>`
}

/**
 * Remove a credential from Jenkins when deleted from the app.
 */
export async function removeCredentialFromJenkins(
  jenkinsClient: JenkinsClient,
  credentialId: string
): Promise<JenkinsCredentialSyncResult> {
  try {
    const deleted = await jenkinsClient.deleteCredential(credentialId)
    return {
      success: deleted,
      message: deleted ? "Credential removed from Jenkins" : "Failed to remove credential",
    }
  } catch (error) {
    return { success: false, message: "Credential removal failed", error: error instanceof Error ? error.message : "Unknown" }
  }
}
