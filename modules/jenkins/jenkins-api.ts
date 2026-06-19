import type { JenkinsServer } from "./jenkins.types" // eslint-disable-line @typescript-eslint/no-unused-vars

// ─── Timeout wrapper ──────────────────────────────────────────────────────────

async function withTimeout<T>(fn: () => Promise<T>, ms = 30000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fn()
  } finally {
    clearTimeout(timer)
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────

const JENKINS_URL = process.env.JENKINS_URL ?? ""
const JENKINS_USERNAME = process.env.JENKINS_USERNAME ?? ""
const JENKINS_API_TOKEN = process.env.JENKINS_API_TOKEN ?? ""

function getAuthHeader(): string {
  if (!JENKINS_USERNAME || !JENKINS_API_TOKEN) {
    throw new Error("Jenkins credentials not configured")
  }
  return `Basic ${Buffer.from(`${JENKINS_USERNAME}:${JENKINS_API_TOKEN}`).toString("base64")}`
}

export async function jenkinsApiFetch(
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  if (!JENKINS_URL) {
    throw new Error("JENKINS_URL is not defined")
  }

  const url = `${JENKINS_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`
  const authHeader = getAuthHeader()

  const headers = new Headers(
    options.headers as Record<string, string> | undefined
  )
  headers.set("Authorization", authHeader)

  try {
    const response = await withTimeout(async () =>
      fetch(url, { ...options, headers })
    )

    if (response.status === 401 || response.status === 403) {
      throw new Error(`Jenkins authentication failed: ${response.statusText}`)
    }

    if (!response.ok) {
      await response.text() // consume body to allow connection reuse
      throw new Error(`Jenkins API error: ${response.statusText}`)
    }

    const contentType = response.headers.get("content-type")
    if (contentType && contentType.includes("application/json")) {
      return await response.json()
    }
    return await response.text()
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Jenkins API timed out after 30s: ${path}`)
    }
    if (error instanceof Error && error.message.startsWith("Jenkins")) {
      throw error
    }
    throw new Error(
      `Failed to connect to Jenkins: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export async function getCsrfCrumb(): Promise<{
  field: string
  value: string
} | null> {
  try {
    const data = (await jenkinsApiFetch("crumbIssuer/api/json")) as {
      crumbRequestField: string
      crumb: string
    }
    return {
      field: data.crumbRequestField,
      value: data.crumb,
    }
  } catch {
    // Some Jenkins setups don't have CSRF protection enabled
    return null
  }
}

export async function buildWithParameters(
  jobName: string,
  parameters: Record<string, string | boolean | number>
): Promise<void> {
  const crumb = await getCsrfCrumb()
  const headers: Record<string, string> = {}

  if (crumb) {
    headers[crumb.field] = crumb.value
  }

  const formData = new URLSearchParams()
  for (const [key, value] of Object.entries(parameters)) {
    formData.append(key, String(value))
  }

  await jenkinsApiFetch(`job/${jobName}/buildWithParameters`, {
    method: "POST",
    headers,
    body: formData,
  })
}
