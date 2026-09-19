import { resolveClusterIntegration } from "./cluster-integration.service"
import { getDeployLogs } from "./deploy-event.service"
import { mapStackStatusToDeployStatus } from "./deploy-monitor.dto"
import type { DeployStatus } from "./deploy.types"

export type JenkinsStreamResult = {
  ok: boolean
  text: string
  isBuilding: boolean
  status: DeployStatus
  buildNumber: number | null
  error?: string
  message?: string
}

export async function getDeploymentJenkinsLog(params: {
  stack: {
    id: string
    slug: string
    clusterId?: string | null
    sourceType?: string
  }
  deployment: {
    id: string
    status: string
    attempt: number
    events?: Array<{
      type: string
      metadataJson?: unknown
      createdAt: Date
    }>
    containerImages?: Array<{
      buildNumber: number
    }>
  }
}): Promise<JenkinsStreamResult> {
  const { stack, deployment } = params
  const deployStatus = mapStackStatusToDeployStatus(deployment.status)

  // 1. Try to determine build number from events or container images
  let buildNumber: number | null = null
  let jobName = stack.slug

  if (deployment.containerImages && deployment.containerImages.length > 0) {
    buildNumber = deployment.containerImages[0]?.buildNumber ?? null
  }

  if (buildNumber === null && deployment.events) {
    for (let i = deployment.events.length - 1; i >= 0; i--) {
      const ev = deployment.events[i]
      if (ev && ev.metadataJson && typeof ev.metadataJson === "object") {
        const meta = ev.metadataJson as Record<string, unknown>
        if (typeof meta.buildNumber === "number") {
          buildNumber = meta.buildNumber
        }
        if (typeof meta.jobName === "string" && meta.jobName.trim()) {
          jobName = meta.jobName.trim()
        }
        if (buildNumber !== null) break
      }
    }
  }

  // 2. Resolve Jenkins Cluster Config
  let jenkinsConfig: {
    baseUrl: string
    username: string
    apiToken: string
  } | null = null

  try {
    const config = await resolveClusterIntegration(stack.id, "JENKINS")
    if (config?.baseUrl && config?.username && config?.apiToken) {
      jenkinsConfig = {
        baseUrl: config.baseUrl,
        username: config.username,
        apiToken: config.apiToken,
      }
    }
  } catch {
    jenkinsConfig = null
  }

  // Fallback to environment variables if cluster integration is not set
  if (
    !jenkinsConfig &&
    process.env.JENKINS_URL &&
    process.env.JENKINS_API_TOKEN
  ) {
    jenkinsConfig = {
      baseUrl: process.env.JENKINS_URL,
      username: process.env.JENKINS_USERNAME || "admin",
      apiToken: process.env.JENKINS_API_TOKEN,
    }
  }

  // 3. If Jenkins is configured, proxy console log from Jenkins
  if (jenkinsConfig) {
    const targetUrl = buildNumber
      ? `${jenkinsConfig.baseUrl.replace(/\/$/, "")}/job/${encodeURIComponent(jobName)}/${buildNumber}/consoleText`
      : `${jenkinsConfig.baseUrl.replace(/\/$/, "")}/job/${encodeURIComponent(jobName)}/lastBuild/consoleText`

    const authHeader = `Basic ${Buffer.from(`${jenkinsConfig.username}:${jenkinsConfig.apiToken}`).toString("base64")}`

    try {
      const res = await fetch(targetUrl, {
        headers: {
          Authorization: authHeader,
        },
      })

      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          error: "JENKINS_AUTH_FAILED",
          message:
            "Jenkins runner authentication failed (401/403). Check runner credentials.",
          text: `[Error] Jenkins authentication failed: ${res.statusText} (${res.status})\nRunner token is invalid or expired.`,
          isBuilding: false,
          status: "failed",
          buildNumber,
        }
      }

      if (res.status === 404) {
        if (
          deployment.status === "QUEUED" ||
          deployment.status === "BUILDING"
        ) {
          return {
            ok: true,
            text: `[Platform] Job '${jobName}' queued. Waiting for Jenkins runner to allocate executor...\n[Runner] Preparing container workspace...`,
            isBuilding: true,
            status: deployStatus,
            buildNumber,
          }
        }
        return {
          ok: true,
          text: `[Platform] No console log found for job '${jobName}'.`,
          isBuilding: false,
          status: deployStatus,
          buildNumber,
        }
      }

      if (!res.ok) {
        return {
          ok: true,
          text: `[Platform] Jenkins console returned HTTP ${res.status}: ${res.statusText}`,
          isBuilding: deployStatus === "building" || deployStatus === "queued",
          status: deployStatus,
          buildNumber,
        }
      }

      const text = await res.text()
      return {
        ok: true,
        text,
        isBuilding:
          deployment.status === "BUILDING" || deployment.status === "QUEUED",
        status: deployStatus,
        buildNumber,
      }
    } catch (fetchErr) {
      const errMsg =
        fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
      return {
        ok: true,
        text: `[Platform] Unable to reach Jenkins runner at ${jenkinsConfig.baseUrl}: ${errMsg}`,
        isBuilding: false,
        status: deployStatus,
        buildNumber,
      }
    }
  }

  // 4. If Jenkins is not configured, fall back to DB deployment logs
  const dbLogs = await getDeployLogs(deployment.id)
  if (dbLogs.length > 0) {
    const formatted = dbLogs
      .map((l) => `[${l.scope.toUpperCase()}] ${l.message}`)
      .join("\n")
    return {
      ok: true,
      text: formatted,
      isBuilding: deployStatus === "building" || deployStatus === "queued",
      status: deployStatus,
      buildNumber: null,
    }
  }

  return {
    ok: true,
    text:
      deployStatus === "building" || deployStatus === "queued"
        ? "[Platform] Waiting for Jenkins build runner to allocate execution slot..."
        : "[Platform] Deployment initialized. No log output recorded.",
    isBuilding: deployStatus === "building" || deployStatus === "queued",
    status: deployStatus,
    buildNumber: null,
  }
}
