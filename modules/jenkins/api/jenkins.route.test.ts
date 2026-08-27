import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockGetJenkinsJobStatus = mock(() => Promise.resolve(null))
const mockTriggerJenkinsJob = mock(() => Promise.resolve())
const mockListJenkinsJobs = mock(() => Promise.resolve([]))

mock.module("../jenkins.service", () => ({
  getJenkinsJobStatus: mockGetJenkinsJobStatus,
  triggerJenkinsJob: mockTriggerJenkinsJob,
  listJenkinsJobs: mockListJenkinsJobs,
}))

const mockGenerateJenkinsDsl = mock(() => "// generated dsl")
mock.module("../jenkins-dsl", () => ({
  generateJenkinsDsl: mockGenerateJenkinsDsl,
}))

import { createJenkinsRoutes } from "./jenkins.route"

describe("jenkins.route", () => {
  let app: { handle: (req: Request) => Promise<Response> }

  beforeEach(() => {
    mockGetJenkinsJobStatus.mockClear()
    mockTriggerJenkinsJob.mockClear()
    mockListJenkinsJobs.mockClear()
    mockGenerateJenkinsDsl.mockClear()
    app = createJenkinsRoutes() as unknown as {
      handle: (req: Request) => Promise<Response>
    }
  })

  describe("GET /integrations/jenkins/status", () => {
    it("returns integrations status ok", async () => {
      mockListJenkinsJobs.mockResolvedValueOnce(["job-1"] as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/integrations/jenkins/status")
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({
        ok: true,
        connected: true,
        jobCount: 1,
        jobs: ["job-1"],
      })
    })
  })

  describe("GET /integrations/jenkins/jobs", () => {
    it("lists jenkins jobs", async () => {
      mockListJenkinsJobs.mockResolvedValueOnce([
        "job-1",
        "job-2",
      ] as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/integrations/jenkins/jobs")
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({
        ok: true,
        items: ["job-1", "job-2"],
        total: 2,
      })
    })
  })

  describe("GET /integrations/jenkins/jobs/:jobName/status", () => {
    it("returns 404 when job not found", async () => {
      mockGetJenkinsJobStatus.mockResolvedValueOnce(null)

      const res = await app.handle(
        new Request(
          "http://localhost/integrations/jenkins/jobs/unknown-job/status"
        )
      )

      expect(res.status).toBe(404)
    })

    it("returns build status when found", async () => {
      mockGetJenkinsJobStatus.mockResolvedValueOnce({
        id: "1",
        jobName: "app-build",
        buildNumber: 10,
        status: "SUCCESS",
      } as unknown as never)

      const res = await app.handle(
        new Request(
          "http://localhost/integrations/jenkins/jobs/app-build/status"
        )
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.build.buildNumber).toBe(10)
    })
  })

  describe("POST /integrations/jenkins/jobs/build", () => {
    it("triggers jenkins job build", async () => {
      const res = await app.handle(
        new Request("http://localhost/integrations/jenkins/jobs/build", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jobName: "deploy-app",
            parameters: { BRANCH: "main" },
          }),
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({
        ok: true,
        message: "Build triggered for job 'deploy-app'",
      })
      expect(mockTriggerJenkinsJob).toHaveBeenCalledWith("deploy-app", {
        BRANCH: "main",
      })
    })
  })

  describe("POST /integrations/jenkins/jobs/dsl/generate", () => {
    it("generates Jenkins DSL script", async () => {
      const res = await app.handle(
        new Request("http://localhost/integrations/jenkins/jobs/dsl/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "node-app",
            type: "node",
            nodeVersion: "20",
          }),
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.dsl).toBe("// generated dsl")
    })
  })
})
