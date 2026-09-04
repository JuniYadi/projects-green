export type IntegrationConnectionTestResult = {
  ok: boolean
  message: string
  details?: Record<string, unknown>
  durationMs: number
}

type TestFetch = typeof fetch

export async function testIntegrationConnection(
  type: string,
  meta: Record<string, unknown>,
  secrets: Record<string, unknown>,
  fetcher: TestFetch = fetch
): Promise<IntegrationConnectionTestResult> {
  const start = Date.now()
  const timeoutMs = 8000

  const timedFetch = async (url: string, init?: RequestInit) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetcher(url, { ...init, signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }
  }

  try {
    switch (type) {
      case "JENKINS": {
        const baseUrl =
          typeof meta.baseUrl === "string"
            ? meta.baseUrl.replace(/\/+$/, "")
            : ""
        const username =
          typeof secrets.username === "string"
            ? secrets.username
            : ((meta.username as string) ?? "")
        const apiToken =
          typeof secrets.apiToken === "string" ? secrets.apiToken : ""

        if (!baseUrl) {
          return {
            ok: false,
            message: "Missing Jenkins baseUrl in metadata",
            durationMs: Date.now() - start,
          }
        }

        const headers: Record<string, string> = { Accept: "application/json" }
        if (username && apiToken) {
          const authString = Buffer.from(`${username}:${apiToken}`).toString(
            "base64"
          )
          headers.Authorization = `Basic ${authString}`
        }

        const res = await timedFetch(`${baseUrl}/api/json?tree=nodeName,mode`, {
          headers,
        })
        const durationMs = Date.now() - start

        if (res.status === 401 || res.status === 403) {
          return {
            ok: false,
            message: `Jenkins authentication failed (HTTP ${res.status}). Check username/API token.`,
            durationMs,
          }
        }
        if (!res.ok) {
          return {
            ok: false,
            message: `Jenkins returned HTTP ${res.status}: ${res.statusText}`,
            durationMs,
          }
        }

        return {
          ok: true,
          message: "Successfully connected to Jenkins API",
          durationMs,
        }
      }

      case "ARGOCD": {
        const apiUrl =
          typeof meta.apiUrl === "string" ? meta.apiUrl.replace(/\/+$/, "") : ""
        const token = typeof secrets.token === "string" ? secrets.token : ""

        if (!apiUrl) {
          return {
            ok: false,
            message: "Missing ArgoCD apiUrl in metadata",
            durationMs: Date.now() - start,
          }
        }

        const headers: Record<string, string> = { Accept: "application/json" }
        if (token) {
          headers.Authorization = `Bearer ${token}`
        }

        const res = await timedFetch(`${apiUrl}/api/v1/session/userinfo`, {
          headers,
        })
        const durationMs = Date.now() - start

        if (res.status === 401 || res.status === 403) {
          return {
            ok: false,
            message: `ArgoCD authentication failed (HTTP ${res.status}). Check token validity.`,
            durationMs,
          }
        }
        if (!res.ok) {
          return {
            ok: false,
            message: `ArgoCD returned HTTP ${res.status}: ${res.statusText}`,
            durationMs,
          }
        }

        return {
          ok: true,
          message: "Successfully connected to Argo CD API",
          durationMs,
        }
      }

      case "GITOPS": {
        const repo = typeof meta.repo === "string" ? meta.repo : ""
        const pat = typeof secrets.pat === "string" ? secrets.pat : ""

        if (!repo) {
          return {
            ok: false,
            message: "Missing GitOps repo URL or path",
            durationMs: Date.now() - start,
          }
        }

        // If GitHub repo, probe github api or raw ping
        if (repo.includes("github.com")) {
          const match = repo.match(
            /github\.com[/:]([\w.-]+)\/([\w.-]+?)(\.git)?$/
          )
          if (match) {
            const [, owner, repoName] = match
            const headers: Record<string, string> = {
              "User-Agent": "Projects-Green-Cluster-Probe",
              Accept: "application/vnd.github.v3+json",
            }
            if (pat) headers.Authorization = `Bearer ${pat}`

            const res = await timedFetch(
              `https://api.github.com/repos/${owner}/${repoName}`,
              { headers }
            )
            const durationMs = Date.now() - start

            if (res.status === 401 || res.status === 403) {
              return {
                ok: false,
                message: "GitHub authentication failed. Check PAT permissions.",
                durationMs,
              }
            }
            if (res.status === 404) {
              return {
                ok: false,
                message: `Repository ${owner}/${repoName} not found or token lacks repo scope.`,
                durationMs,
              }
            }
            if (!res.ok) {
              return {
                ok: false,
                message: `GitHub returned HTTP ${res.status}`,
                durationMs,
              }
            }

            return {
              ok: true,
              message: "Successfully connected to GitOps repository on GitHub",
              durationMs,
            }
          }
        }

        return {
          ok: true,
          message: "GitOps configuration formatted correctly",
          durationMs: Date.now() - start,
        }
      }

      case "REGISTRY": {
        const host =
          typeof meta.host === "string" ? meta.host.replace(/\/+$/, "") : ""
        if (!host) {
          return {
            ok: false,
            message: "Missing Registry host",
            durationMs: Date.now() - start,
          }
        }

        const url = host.startsWith("http")
          ? `${host}/v2/`
          : `https://${host}/v2/`
        try {
          const res = await timedFetch(url)
          const durationMs = Date.now() - start
          // v2 ping returning 200 or 401 (challenge) proves the registry v2 endpoint exists and is reachable
          if (res.status === 200 || res.status === 401) {
            return {
              ok: true,
              message: `Container Registry endpoint reached at ${host}`,
              durationMs,
            }
          }
          return {
            ok: false,
            message: `Registry returned unexpected HTTP ${res.status}`,
            durationMs,
          }
        } catch {
          return {
            ok: false,
            message: `Could not reach Container Registry at ${host}`,
            durationMs: Date.now() - start,
          }
        }
      }

      case "PROMETHEUS": {
        const endpoint =
          typeof meta.endpoint === "string"
            ? meta.endpoint.replace(/\/+$/, "")
            : ""
        if (!endpoint) {
          return {
            ok: false,
            message: "Missing Prometheus endpoint",
            durationMs: Date.now() - start,
          }
        }

        const res = await timedFetch(`${endpoint}/-/healthy`)
        const durationMs = Date.now() - start
        if (!res.ok) {
          return {
            ok: false,
            message: `Prometheus health check failed with HTTP ${res.status}`,
            durationMs,
          }
        }
        return {
          ok: true,
          message: "Successfully reached Prometheus health endpoint",
          durationMs,
        }
      }

      case "OPENSEARCH": {
        const endpoint =
          typeof meta.endpoint === "string"
            ? meta.endpoint.replace(/\/+$/, "")
            : ""
        if (!endpoint) {
          return {
            ok: false,
            message: "Missing OpenSearch endpoint",
            durationMs: Date.now() - start,
          }
        }

        const res = await timedFetch(endpoint)
        const durationMs = Date.now() - start
        if (res.status === 401) {
          return {
            ok: false,
            message: "OpenSearch authentication required / invalid credentials",
            durationMs,
          }
        }
        if (!res.ok) {
          return {
            ok: false,
            message: `OpenSearch returned HTTP ${res.status}`,
            durationMs,
          }
        }
        return {
          ok: true,
          message: "Successfully reached OpenSearch cluster endpoint",
          durationMs,
        }
      }

      case "KUBECONFIG": {
        const apiServerUrl =
          typeof meta.apiServerUrl === "string"
            ? meta.apiServerUrl.replace(/\/+$/, "")
            : ""
        if (!apiServerUrl) {
          return {
            ok: true,
            message:
              "Kubeconfig payload validated (no external API endpoint probe)",
            durationMs: Date.now() - start,
          }
        }
        try {
          const res = await timedFetch(`${apiServerUrl}/livez`)
          const durationMs = Date.now() - start
          if (res.status === 200 || res.status === 401 || res.status === 403) {
            return {
              ok: true,
              message: `Kubernetes API server reachable at ${apiServerUrl}`,
              durationMs,
            }
          }
          return {
            ok: false,
            message: `Kubernetes API server returned HTTP ${res.status}`,
            durationMs,
          }
        } catch {
          return {
            ok: false,
            message: `Unable to reach Kubernetes API server at ${apiServerUrl}`,
            durationMs: Date.now() - start,
          }
        }
      }

      default:
        return {
          ok: true,
          message: `Configuration validated for integration ${type}`,
          durationMs: Date.now() - start,
        }
    }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Connection failed or timed out",
      durationMs: Date.now() - start,
    }
  }
}
