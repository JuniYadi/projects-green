import { describe, it, expect, mock, beforeEach } from "bun:test"
import { GithubPushEventHandler, GithubPushDispatcher } from "../github-push-dispatcher"

// Mock Jenkins service
mock.module("@/modules/jenkins/jenkins.service", () => ({
  triggerJenkinsJob: mock(() => Promise.resolve())
}))

describe("GithubPushEventHandler", () => {
  const handler = new GithubPushEventHandler()
  
  const mockStack = {
    id: "stack-123",
    autoDeploy: true,
    branchFilter: "main,develop",
    jenkinsJobName: "deploy-job",
    metadata: {}
  }

  const mockPayload = {
    ref: "refs/heads/main",
    after: "sha123",
    commits: [
      {
        id: "sha123",
        message: "feat: update",
        author: { name: "John Doe", email: "john@example.com" },
        url: "http://github.com/commit/123",
        timestamp: new Date().toISOString()
      }
    ],
    pusher: { name: "johndoe", email: "john@example.com" },
    repository: {
      id: 1,
      full_name: "org/repo",
      name: "repo",
      owner: { login: "org" }
    }
  }

  it("extracts branch correctly", () => {
    expect(handler.extractBranch("refs/heads/main")).toBe("main")
    expect(handler.extractBranch("refs/tags/v1")).toBe(null)
  })

  it("should trigger deploy based on branch filter", () => {
    expect(handler.shouldTriggerDeploy(mockStack, "main")).toBe(true)
    expect(handler.shouldTriggerDeploy(mockStack, "develop")).toBe(true)
    expect(handler.shouldTriggerDeploy(mockStack, "feature")).toBe(false)
  })

  it("should not trigger deploy if autoDeploy is false", () => {
    const inactiveStack = { ...mockStack, autoDeploy: false }
    expect(handler.shouldTriggerDeploy(inactiveStack, "main")).toBe(false)
  })

  it("extracts commits correctly", () => {
    const commits = handler.extractCommits(mockPayload)
    expect(commits.length).toBe(1)
    expect(commits[0].id).toBe("sha123")
    expect(commits[0].author).toBe("John Doe")
  })

  it("syncs push metadata", async () => {
    const stack = { ...mockStack }
    await handler.syncPushMetadata(stack, "main", [{ id: "1" }], "johndoe")
    expect(stack.metadata.lastPush).toBeDefined()
    expect(stack.metadata.lastPush?.ref).toBe("main")
    expect(stack.metadata.lastPush?.author).toBe("johndoe")
  })
})

describe("GithubPushDispatcher", () => {
  it("dispatches deployment to Jenkins", async () => {
    const { triggerJenkinsJob } = await import("@/modules/jenkins/jenkins.service")
    const dispatcher = new GithubPushDispatcher()
    
    const stack = {
      id: "stack-123",
      autoDeploy: true,
      jenkinsJobName: "deploy-job",
      metadata: {}
    }
    
    const payload = {
      ref: "refs/heads/main",
      after: "sha123",
      commits: [],
      pusher: { name: "johndoe", email: "john@example.com" },
      repository: {
        id: 1,
        full_name: "org/repo",
        name: "repo",
        owner: { login: "org" }
      }
    }

    await dispatcher.dispatchDeployment(stack, payload)
    
    expect(triggerJenkinsJob).toHaveBeenCalledWith("deploy-job", {
      GIT_REF: "main",
      GIT_COMMIT: "sha123",
      PUSHER: "johndoe",
      STACK_ID: "stack-123"
    })
  })
})
