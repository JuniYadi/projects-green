import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import {
  buildWithParameters,
  getCsrfCrumb,
  jenkinsApiFetch,
} from "./jenkins-api"

describe("jenkins-api", () => {
  const originalFetch = globalThis.fetch
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.JENKINS_URL = "https://jenkins.example.com"
    process.env.JENKINS_USERNAME = "admin"
    process.env.JENKINS_API_TOKEN = "token123"
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    process.env = { ...originalEnv }
  })

  describe("jenkinsApiFetch", () => {
    it("attaches HTTP status to error on non-ok response", async () => {
      globalThis.fetch = (async () => {
        return new Response("Not Found", {
          status: 404,
          statusText: "Not Found",
        })
      }) as unknown as typeof fetch

      try {
        await jenkinsApiFetch("job/test/build")
        expect.unreachable("Should have thrown")
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error & { status?: number }).status).toBe(404)
        expect((error as Error).message).toContain(
          "Jenkins API error: Not Found"
        )
      }
    })

    it("attaches 401 status on auth failure", async () => {
      globalThis.fetch = (async () => {
        return new Response("Unauthorized", {
          status: 401,
          statusText: "Unauthorized",
        })
      }) as unknown as typeof fetch

      try {
        await jenkinsApiFetch("job/test/build")
        expect.unreachable("Should have thrown")
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error & { status?: number }).status).toBe(401)
        expect((error as Error).message).toContain(
          "Jenkins authentication failed"
        )
      }
    })

    it("returns json when content-type is application/json", async () => {
      globalThis.fetch = (async () => {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      }) as unknown as typeof fetch

      const result = await jenkinsApiFetch("api/json")
      expect(result).toEqual({ ok: true })
    })
  })

  describe("getCsrfCrumb", () => {
    it("returns crumb when present", async () => {
      globalThis.fetch = (async () => {
        return new Response(
          JSON.stringify({
            crumbRequestField: "Jenkins-Crumb",
            crumb: "crumb-value",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      }) as unknown as typeof fetch

      const crumb = await getCsrfCrumb()
      expect(crumb).toEqual({
        field: "Jenkins-Crumb",
        value: "crumb-value",
      })
    })

    it("returns null when crumb issuer fails", async () => {
      globalThis.fetch = (async () => {
        return new Response("Error", { status: 404 })
      }) as unknown as typeof fetch

      const crumb = await getCsrfCrumb()
      expect(crumb).toBeNull()
    })
  })

  describe("buildWithParameters", () => {
    it("submits form data with crumb headers", async () => {
      let requestedUrl = ""
      let requestedMethod = ""
      let requestedHeaders: Headers | undefined

      globalThis.fetch = (async (url: string, init?: RequestInit) => {
        if (url.includes("crumbIssuer")) {
          return new Response(
            JSON.stringify({
              crumbRequestField: "Jenkins-Crumb",
              crumb: "test-crumb",
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          )
        }

        requestedUrl = url
        requestedMethod = init?.method ?? ""
        requestedHeaders = new Headers(init?.headers as HeadersInit)
        return new Response("Created", { status: 201 })
      }) as unknown as typeof fetch

      await buildWithParameters("test-job", { BRANCH: "main" })

      expect(requestedUrl).toBe(
        "https://jenkins.example.com/job/test-job/buildWithParameters"
      )
      expect(requestedMethod).toBe("POST")
      expect(requestedHeaders?.get("Jenkins-Crumb")).toBe("test-crumb")
    })
  })
})
