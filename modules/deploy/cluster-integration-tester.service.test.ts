import { describe, it, expect, mock } from "bun:test"
import { testIntegrationConnection } from "./cluster-integration-tester.service"

describe("testIntegrationConnection", () => {
  it("tests Jenkins connection successfully", async () => {
    const mockFetcher = mock(
      async () =>
        new Response(JSON.stringify({ mode: "NORMAL" }), { status: 200 })
    )
    const result = await testIntegrationConnection(
      "JENKINS",
      { baseUrl: "https://jenkins.example.com" },
      { username: "admin", apiToken: "tok_123" },
      mockFetcher as unknown as typeof fetch
    )

    expect(result.ok).toBe(true)
    expect(result.message).toContain("Successfully connected to Jenkins API")
    expect(mockFetcher).toHaveBeenCalledWith(
      "https://jenkins.example.com/api/json?tree=nodeName,mode",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining("Basic "),
        }),
      })
    )
  })

  it("handles Jenkins 401 unauthorized", async () => {
    const mockFetcher = mock(
      async () => new Response("Unauthorized", { status: 401 })
    )
    const result = await testIntegrationConnection(
      "JENKINS",
      { baseUrl: "https://jenkins.example.com" },
      { username: "admin", apiToken: "wrong_token" },
      mockFetcher as unknown as typeof fetch
    )

    expect(result.ok).toBe(false)
    expect(result.message).toContain("Jenkins authentication failed (HTTP 401)")
  })

  it("tests ArgoCD connection successfully", async () => {
    const mockFetcher = mock(
      async () =>
        new Response(JSON.stringify({ loggedIn: true }), { status: 200 })
    )
    const result = await testIntegrationConnection(
      "ARGOCD",
      { apiUrl: "https://argocd.example.com" },
      { token: "argo_secret_token" },
      mockFetcher as unknown as typeof fetch
    )

    expect(result.ok).toBe(true)
    expect(result.message).toContain("Successfully connected to Argo CD API")
    expect(mockFetcher).toHaveBeenCalledWith(
      "https://argocd.example.com/api/v1/session/userinfo",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer argo_secret_token",
        }),
      })
    )
  })

  it("returns false on missing baseUrl for Jenkins", async () => {
    const result = await testIntegrationConnection("JENKINS", {}, {})
    expect(result.ok).toBe(false)
    expect(result.message).toContain("Missing Jenkins baseUrl")
  })

  it("tests Prometheus connection successfully with basic auth", async () => {
    const mockFetcher = mock(
      async () => new Response("Prometheus Server is Healthy.", { status: 200 })
    )
    const result = await testIntegrationConnection(
      "PROMETHEUS",
      { endpoint: "https://prometheus.example.com" },
      { username: "prom_user", password: "prom_password" },
      mockFetcher as unknown as typeof fetch
    )

    expect(result.ok).toBe(true)
    expect(result.message).toContain(
      "Successfully reached Prometheus health endpoint"
    )
    const expectedAuth = Buffer.from("prom_user:prom_password").toString(
      "base64"
    )
    expect(mockFetcher).toHaveBeenCalledWith(
      "https://prometheus.example.com/-/healthy",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Basic ${expectedAuth}`,
        }),
      })
    )
  })

  it("tests Prometheus connection successfully without auth", async () => {
    const mockFetcher = mock(
      async () => new Response("Prometheus Server is Healthy.", { status: 200 })
    )
    const result = await testIntegrationConnection(
      "PROMETHEUS",
      { endpoint: "https://prometheus.example.com" },
      {},
      mockFetcher as unknown as typeof fetch
    )

    expect(result.ok).toBe(true)
    expect(mockFetcher).toHaveBeenCalledWith(
      "https://prometheus.example.com/-/healthy",
      expect.objectContaining({
        headers: { Accept: "application/json" },
      })
    )
  })

  it("handles Prometheus 401 unauthorized with descriptive error", async () => {
    const mockFetcher = mock(
      async () => new Response("Unauthorized", { status: 401 })
    )
    const result = await testIntegrationConnection(
      "PROMETHEUS",
      { endpoint: "https://prometheus.example.com" },
      { username: "prom_user", password: "wrong_password" },
      mockFetcher as unknown as typeof fetch
    )

    expect(result.ok).toBe(false)
    expect(result.message).toContain(
      "Prometheus authentication failed (HTTP 401). Check username and password."
    )
  })

  it("supports Prometheus basic auth credentials from meta as fallback", async () => {
    const mockFetcher = mock(
      async () => new Response("Prometheus Server is Healthy.", { status: 200 })
    )
    const result = await testIntegrationConnection(
      "PROMETHEUS",
      {
        endpoint: "https://prometheus.example.com/-/healthy",
        username: "meta_user",
        password: "meta_password",
      },
      {},
      mockFetcher as unknown as typeof fetch
    )

    expect(result.ok).toBe(true)
    const expectedAuth = Buffer.from("meta_user:meta_password").toString(
      "base64"
    )
    expect(mockFetcher).toHaveBeenCalledWith(
      "https://prometheus.example.com/-/healthy",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Basic ${expectedAuth}`,
        }),
      })
    )
  })

  it("handles Prometheus 403 forbidden", async () => {
    const mockFetcher = mock(
      async () => new Response("Forbidden", { status: 403 })
    )
    const result = await testIntegrationConnection(
      "PROMETHEUS",
      { endpoint: "https://prometheus.example.com/-/ready" },
      { username: "u", password: "p" },
      mockFetcher as unknown as typeof fetch
    )

    expect(result.ok).toBe(false)
    expect(result.message).toContain(
      "Prometheus authentication failed (HTTP 403). Check username and password."
    )
  })

  it("handles Prometheus 500 error", async () => {
    const mockFetcher = mock(
      async () => new Response("Internal Server Error", { status: 500 })
    )
    const result = await testIntegrationConnection(
      "PROMETHEUS",
      { endpoint: "https://prometheus.example.com" },
      {},
      mockFetcher as unknown as typeof fetch
    )

    expect(result.ok).toBe(false)
    expect(result.message).toContain(
      "Prometheus health check failed with HTTP 500"
    )
  })

  it("tests OpenSearch connection successfully with basic auth", async () => {
    const mockFetcher = mock(
      async () =>
        new Response(JSON.stringify({ version: { number: "2.11.0" } }), {
          status: 200,
        })
    )
    const result = await testIntegrationConnection(
      "OPENSEARCH",
      { endpoint: "https://opensearch.example.com:9200" },
      { username: "os_admin", password: "os_password" },
      mockFetcher as unknown as typeof fetch
    )

    expect(result.ok).toBe(true)
    expect(result.message).toContain(
      "Successfully reached OpenSearch cluster endpoint"
    )
    const expectedAuth = Buffer.from("os_admin:os_password").toString("base64")
    expect(mockFetcher).toHaveBeenCalledWith(
      "https://opensearch.example.com:9200",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Basic ${expectedAuth}`,
        }),
      })
    )
  })

  it("handles OpenSearch 401 unauthorized", async () => {
    const mockFetcher = mock(
      async () => new Response("Unauthorized", { status: 401 })
    )
    const result = await testIntegrationConnection(
      "OPENSEARCH",
      { endpoint: "https://opensearch.example.com:9200" },
      { username: "os_admin", password: "bad_password" },
      mockFetcher as unknown as typeof fetch
    )

    expect(result.ok).toBe(false)
    expect(result.message).toContain(
      "OpenSearch authentication required / invalid credentials"
    )
  })

  it("returns error when OpenSearch endpoint is missing", async () => {
    const result = await testIntegrationConnection("OPENSEARCH", {}, {})
    expect(result.ok).toBe(false)
    expect(result.message).toBe("Missing OpenSearch endpoint")
  })

  it("supports OpenSearch legacy host field fallback", async () => {
    const mockFetcher = mock(
      async () =>
        new Response(JSON.stringify({ version: { number: "2.11.0" } }), {
          status: 200,
        })
    )
    const result = await testIntegrationConnection(
      "OPENSEARCH",
      { host: "https://opensearch.example.com:9200" },
      { username: "os_admin", password: "os_password" },
      mockFetcher as unknown as typeof fetch
    )
    expect(result.ok).toBe(true)
    expect(result.message).toContain(
      "Successfully reached OpenSearch cluster endpoint"
    )
  })

  it("supports OpenSearch basic auth credentials from meta as fallback", async () => {
    const mockFetcher = mock(
      async () =>
        new Response(JSON.stringify({ version: { number: "2.11.0" } }), {
          status: 200,
        })
    )
    const result = await testIntegrationConnection(
      "OPENSEARCH",
      {
        endpoint: "https://opensearch.example.com:9200",
        username: "os_meta_user",
        password: "os_meta_password",
      },
      {},
      mockFetcher as unknown as typeof fetch
    )

    expect(result.ok).toBe(true)
    const expectedAuth = Buffer.from("os_meta_user:os_meta_password").toString(
      "base64"
    )
    expect(mockFetcher).toHaveBeenCalledWith(
      "https://opensearch.example.com:9200",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Basic ${expectedAuth}`,
        }),
      })
    )
  })

  it("succeeds when OpenSearch root returns 403 but security account endpoint returns 200", async () => {
    const mockFetcher = mock(async (url: string | Request | URL) => {
      const urlStr = String(url)
      if (urlStr.endsWith("/_plugins/_security/api/account")) {
        return new Response(JSON.stringify({ user_name: "pfnapp-readonly" }), {
          status: 200,
        })
      }
      return new Response("Forbidden", { status: 403 })
    })
    const result = await testIntegrationConnection(
      "OPENSEARCH",
      { endpoint: "https://opensearch.example.com:9200" },
      { username: "pfnapp-readonly", password: "secret_password" },
      mockFetcher as unknown as typeof fetch
    )
    expect(result.ok).toBe(true)
    expect(result.message).toContain(
      "Successfully reached OpenSearch cluster endpoint"
    )
  })

  it("handles OpenSearch 403 forbidden and 500 error", async () => {
    const mockFetcher403 = mock(
      async () => new Response("Forbidden", { status: 403 })
    )
    const result403 = await testIntegrationConnection(
      "OPENSEARCH",
      { endpoint: "https://opensearch.example.com:9200" },
      { username: "u", password: "p" },
      mockFetcher403 as unknown as typeof fetch
    )
    expect(result403.ok).toBe(false)
    expect(result403.message).toContain(
      "OpenSearch authentication required / invalid credentials"
    )

    const mockFetcher500 = mock(
      async () => new Response("Error", { status: 500 })
    )
    const result500 = await testIntegrationConnection(
      "OPENSEARCH",
      { endpoint: "https://opensearch.example.com:9200" },
      {},
      mockFetcher500 as unknown as typeof fetch
    )
    expect(result500.ok).toBe(false)
    expect(result500.message).toContain("OpenSearch returned HTTP 500")
  })

  it("validates INTERNAL configuration without probing the portal cluster", async () => {
    const mockFetcher = mock(async () => new Response("ok", { status: 200 }))
    const result = await testIntegrationConnection(
      "KUBECONFIG",
      { connectionMode: "INTERNAL", namespacePattern: "app-{slug}" },
      {},
      mockFetcher as unknown as typeof fetch
    )
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        message:
          "Kubernetes configuration is valid; target health requires an explicit API server URL.",
      })
    )
    expect(mockFetcher).not.toHaveBeenCalled()
  })

  it("probes only an explicitly configured INTERNAL target and credentials", async () => {
    const mockFetcher = mock(async () => new Response("ok", { status: 200 }))
    const result = await testIntegrationConnection(
      "KUBECONFIG",
      { connectionMode: "INTERNAL", apiServerUrl: "https://k8s.example.com" },
      {},
      mockFetcher as unknown as typeof fetch
    )
    expect(result.ok).toBe(true)
    expect(mockFetcher).toHaveBeenCalledWith(
      "https://k8s.example.com/livez",
      expect.objectContaining({
        headers: { Accept: "application/json" },
      })
    )
  })

  it("tests KUBECONFIG external connection successfully with token and caCertificate", async () => {
    const mockFetcher = mock(async () => new Response("ok", { status: 200 }))
    const result = await testIntegrationConnection(
      "KUBECONFIG",
      { connectionMode: "EXTERNAL" },
      {
        apiServerUrl: "https://k8s.example.com",
        serviceAccountToken: "sa-token-12345",
        caCertificate:
          "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----",
      },
      mockFetcher as unknown as typeof fetch
    )
    expect(result.ok).toBe(true)
    expect(result.message).toContain("Kubernetes API server reachable")
    expect(mockFetcher).toHaveBeenCalledWith(
      "https://k8s.example.com/livez",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer sa-token-12345",
        }),
        tls: expect.objectContaining({
          ca: ["-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----"],
        }),
      })
    )
  })

  it("handles KUBECONFIG unreachable external API server with error details", async () => {
    const mockFetcher = mock(async () => {
      throw new Error("unable to verify the first certificate")
    })
    const result = await testIntegrationConnection(
      "KUBECONFIG",
      { connectionMode: "EXTERNAL" },
      { apiServerUrl: "https://k8s-unreachable.example.com" },
      mockFetcher as unknown as typeof fetch
    )
    expect(result.ok).toBe(false)
    expect(result.message).toContain("unable to verify the first certificate")
  })
})
