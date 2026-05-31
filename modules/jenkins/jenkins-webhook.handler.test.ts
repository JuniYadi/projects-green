import { describe, expect, it, mock, beforeEach } from "bun:test"

// 1. define mock objects
const mockPrisma = {
  githubRepositoryConnection: {
    findFirst: mock(),
    update: mock(),
  },
}

const mockTriggerJenkinsJob = mock()

// 2. register module mocks
mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))
mock.module("./jenkins.service", () => ({
  triggerJenkinsJob: mockTriggerJenkinsJob,
}))

// 3. only then import the thing under test
const { JenkinsWebhookHandler } = await import("./jenkins-webhook.handler")

describe("JenkinsWebhookHandler", () => {
  let handler: any

  beforeEach(() => {
    handler = new JenkinsWebhookHandler()
    mockPrisma.githubRepositoryConnection.findFirst.mockClear()
    mockPrisma.githubRepositoryConnection.update.mockClear()
    mockTriggerJenkinsJob.mockClear()
    process.env.JENKINS_WEBHOOK_TOKEN = "secret-token"
  })

  describe("verifyToken", () => {
    it("returns true if token matches env", async () => {
      expect(await handler.verifyToken("secret-token")).toBe(true)
    })

    it("returns false if token does not match", async () => {
      expect(await handler.verifyToken("wrong-token")).toBe(false)
    })
  })

  describe("resolveApplicationStack", () => {
    it("finds app by repoName or fullName", async () => {
      mockPrisma.githubRepositoryConnection.findFirst.mockResolvedValue({ id: "1", repoName: "test-app" })
      
      const result = await handler.resolveApplicationStack("test-app")
      
      expect(result).toBeDefined()
      expect(mockPrisma.githubRepositoryConnection.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { repoName: "test-app" },
            { fullName: { contains: "test-app" } }
          ]
        }
      })
    })
  })

  describe("syncVersion", () => {
    it("skips if version is unchanged", async () => {
      const stack = { id: "1", repoName: "test-app", version: "1.0.0" }
      const result = await handler.syncVersion(stack, "1.0.0")
      
      expect(result.unchanged).toBe(true)
      expect(mockPrisma.githubRepositoryConnection.update).not.toHaveBeenCalled()
    })

    it("updates version and triggers build if changed", async () => {
      const stack = { id: "1", repoName: "test-app", version: "1.0.0" }
      mockPrisma.githubRepositoryConnection.update.mockResolvedValue({ ...stack, version: "1.1.0" })
      mockTriggerJenkinsJob.mockResolvedValue(undefined)

      const result = await handler.syncVersion(stack, "1.1.0")
      
      expect(result.version).toBe("1.1.0")
      expect(mockPrisma.githubRepositoryConnection.update).toHaveBeenCalled()
      expect(mockTriggerJenkinsJob).toHaveBeenCalledWith("app-test-app", {
        VERSION: "1.1.0",
        APP_NAME: "test-app"
      })
    })
  })
})
