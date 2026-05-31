import { describe, expect, it, mock, beforeEach } from "bun:test"
import type { JenkinsWebhookHandler } from "./jenkins-webhook.handler"

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
const { JenkinsWebhookHandler: Handler } = await import(
  "./jenkins-webhook.handler"
)

describe("JenkinsWebhookHandler", () => {
  const consoleWarn = console.warn
  let handler: JenkinsWebhookHandler

  beforeEach(() => {
    handler = new Handler()
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

    it("returns false and warns when env var is not set", async () => {
      delete process.env.JENKINS_WEBHOOK_TOKEN
      const warnMessages: string[] = []
      const originalWarn = process.env.JENKINS_WEBHOOK_TOKEN
      console.warn = (...args: string[]) => {
        warnMessages.push(args.join(" "))
      }

      try {
        const result = await handler.verifyToken(null)
        expect(result).toBe(false)
        expect(warnMessages.length).toBe(1)
        expect(warnMessages[0]).toBe(
          "JENKINS_WEBHOOK_TOKEN is not configured"
        )
      } finally {
        console.warn = consoleWarn
      }
    })
  })

  describe("resolveApplicationStack", () => {
    it("finds app by repoName or fullName", async () => {
      const mockApp = {
        id: "1",
        repoName: "test-app",
        fullName: "org/test-app",
        buildConfigJson: null,
      }
      mockPrisma.githubRepositoryConnection.findFirst.mockResolvedValue(
        mockApp
      )

      const result = await handler.resolveApplicationStack("test-app")

      expect(result).toBeDefined()
      expect(result?.id).toBe("1")
      expect(
        mockPrisma.githubRepositoryConnection.findFirst
      ).toHaveBeenCalledWith({
        where: {
          OR: [
            { repoName: "test-app" },
            { fullName: { contains: "test-app" } },
          ],
        },
        select: {
          id: true,
          repoName: true,
          fullName: true,
          buildConfigJson: true,
        },
      })
    })

    it("returns null when app is not found", async () => {
      mockPrisma.githubRepositoryConnection.findFirst.mockResolvedValue(null)

      const result = await handler.resolveApplicationStack("nonexistent")

      expect(result).toBeNull()
    })
  })

  describe("getJenkinsJobName", () => {
    it("uses jenkinsJobName from buildConfigJson when available", () => {
      const stack = {
        id: "1",
        repoName: "my-app",
        fullName: "org/my-app",
        buildConfigJson: { jenkinsJobName: "custom-job" },
      }

      const jobName = handler.getJenkinsJobName(stack)

      expect(jobName).toBe("custom-job")
    })

    it("falls back to app-{repoName} convention when buildConfigJson is null", () => {
      const stack = {
        id: "1",
        repoName: "my-app",
        fullName: "org/my-app",
        buildConfigJson: null,
      }

      const jobName = handler.getJenkinsJobName(stack)

      expect(jobName).toBe("app-my-app")
    })

    it("falls back even when buildConfigJson exists but has no jenkinsJobName", () => {
      const stack = {
        id: "1",
        repoName: "my-app",
        fullName: "org/my-app",
        buildConfigJson: { someOtherField: "value" },
      }

      const jobName = handler.getJenkinsJobName(stack)

      expect(jobName).toBe("app-my-app")
    })

    it("handles missing repoName gracefully", () => {
      const stack = {
        id: "1",
        repoName: null,
        fullName: "org/my-app",
        buildConfigJson: null,
      }

      const jobName = handler.getJenkinsJobName(stack)

      expect(jobName).toBe("app-unknown")
    })
  })

  describe("syncVersion", () => {
    it("triggers Jenkins build with version and app name", async () => {
      const stack = {
        id: "1",
        repoName: "test-app",
        fullName: "org/test-app",
        buildConfigJson: null,
      }
      mockTriggerJenkinsJob.mockResolvedValue(undefined)

      const result = await handler.syncVersion(stack, "2.0.0")

      expect(result.success).toBe(true)
      expect(result.version).toBe("2.0.0")
      expect(mockTriggerJenkinsJob).toHaveBeenCalledWith("app-test-app", {
        VERSION: "2.0.0",
        APP_NAME: "test-app",
        DOCKER_REGISTRY: expect.any(String),
      })
    })

    it("uses custom job name from buildConfigJson", async () => {
      const stack = {
        id: "1",
        repoName: "test-app",
        fullName: "org/test-app",
        buildConfigJson: { jenkinsJobName: "custom-job" },
      }
      mockTriggerJenkinsJob.mockResolvedValue(undefined)

      await handler.syncVersion(stack, "1.5.0")

      expect(mockTriggerJenkinsJob).toHaveBeenCalledWith("custom-job", {
        VERSION: "1.5.0",
        APP_NAME: "test-app",
        DOCKER_REGISTRY: expect.any(String),
      })
    })
  })

  describe("getWebhookStatus", () => {
    it("returns healthy status with token config info", async () => {
      process.env.JENKINS_WEBHOOK_TOKEN = "test-token"

      const status = await handler.getWebhookStatus()

      expect(status.healthy).toBe(true)
      expect(status.tokenConfigured).toBe(true)
    })

    it("reports token not configured when env var missing", async () => {
      delete process.env.JENKINS_WEBHOOK_TOKEN

      const status = await handler.getWebhookStatus()

      expect(status.healthy).toBe(true)
      expect(status.tokenConfigured).toBe(false)
    })
  })
})
