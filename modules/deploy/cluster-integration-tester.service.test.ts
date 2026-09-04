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
})
