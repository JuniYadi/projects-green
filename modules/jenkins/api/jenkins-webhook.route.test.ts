import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

const mockVerifyToken = mock(() => Promise.resolve(true))
const mockResolveApplicationStack = mock(() => Promise.resolve(null))
const mockSyncVersion = mock(() =>
  Promise.resolve({ success: true, version: "v2.0.0" })
)
const mockGetWebhookStatus = mock(() =>
  Promise.resolve({ healthy: true, tokenConfigured: true })
)

mock.module("../jenkins-webhook.handler", () => ({
  jenkinsWebhookHandler: {
    verifyToken: mockVerifyToken,
    resolveApplicationStack: mockResolveApplicationStack,
    syncVersion: mockSyncVersion,
    getWebhookStatus: mockGetWebhookStatus,
  },
}))

import { jenkinsWebhookRoutes } from "./jenkins-webhook.route"

describe("jenkins-webhook.route", () => {
  let app: Elysia

  beforeEach(() => {
    mockVerifyToken.mockClear()
    mockResolveApplicationStack.mockClear()
    mockSyncVersion.mockClear()
    mockGetWebhookStatus.mockClear()
    app = new Elysia().use(jenkinsWebhookRoutes)
  })

  describe("GET /webhooks/jenkins/status", () => {
    it("returns webhook status", async () => {
      const res = await app.handle(
        new Request("http://localhost/webhooks/jenkins/status")
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({ healthy: true, tokenConfigured: true })
    })
  })

  describe("POST /webhooks/jenkins/version-update", () => {
    it("returns 401 when token verification fails", async () => {
      mockVerifyToken.mockResolvedValueOnce(false)

      const res = await app.handle(
        new Request("http://localhost/webhooks/jenkins/version-update", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-jenkins-token": "invalid",
          },
          body: JSON.stringify({
            application_stack: "app-1",
            version: "v1.0.0",
          }),
        })
      )

      expect(res.status).toBe(401)
    })

    it("returns 404 when stack is not found", async () => {
      mockVerifyToken.mockResolvedValueOnce(true)
      mockResolveApplicationStack.mockResolvedValueOnce(null)

      const res = await app.handle(
        new Request("http://localhost/webhooks/jenkins/version-update", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-jenkins-token": "valid",
          },
          body: JSON.stringify({
            application_stack: "unknown-stack",
            version: "v1.0.0",
          }),
        })
      )

      expect(res.status).toBe(404)
    })

    it("processes version update successfully", async () => {
      mockVerifyToken.mockResolvedValueOnce(true)
      mockResolveApplicationStack.mockResolvedValueOnce({
        id: "stack-1",
        repoName: "my-app",
        fullName: "org/my-app",
        buildConfigJson: {},
      } as unknown as never)
      mockSyncVersion.mockResolvedValueOnce({
        success: true,
        version: "v2.0.0",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/webhooks/jenkins/version-update", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-jenkins-token": "valid",
          },
          body: JSON.stringify({
            application_stack: "my-app",
            version: "v2.0.0",
          }),
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({
        success: true,
        version: "v2.0.0",
      })
    })
  })
})
