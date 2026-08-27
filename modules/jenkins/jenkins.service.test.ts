import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockBuildWithParameters = mock(() => Promise.resolve())
const mockJenkinsApiFetch = mock(() => Promise.resolve({}))

mock.module("./jenkins-api", () => ({
  buildWithParameters: mockBuildWithParameters,
  jenkinsApiFetch: mockJenkinsApiFetch,
}))

import {
  createJenkinsBuildDispatcher,
  getJenkinsJobStatus,
  listJenkinsJobs,
  triggerJenkinsJob,
} from "./jenkins.service"

describe("jenkins.service", () => {
  beforeEach(() => {
    mockBuildWithParameters.mockClear()
    mockJenkinsApiFetch.mockClear()
  })

  describe("createJenkinsBuildDispatcher", () => {
    it("returns a dispatcher that triggers buildWithParameters", async () => {
      const dispatcher = createJenkinsBuildDispatcher()
      await dispatcher({
        eventId: "event-1",
        jobName: "build-deploy",
        parameters: { BRANCH: "main", RETRIES: 3 },
      })

      expect(mockBuildWithParameters).toHaveBeenCalledWith(
        "build-deploy",
        { BRANCH: "main", RETRIES: 3 },
        undefined
      )
    })
  })

  describe("triggerJenkinsJob", () => {
    it("calls buildWithParameters with provided parameters and config", async () => {
      const config = {
        baseUrl: "https://jenkins.example.com",
        username: "admin",
        apiToken: "token123",
      }

      await triggerJenkinsJob("app-pipeline", { ENV: "production" }, config)

      expect(mockBuildWithParameters).toHaveBeenCalledWith(
        "app-pipeline",
        { ENV: "production" },
        config
      )
    })
  })

  describe("getJenkinsJobStatus", () => {
    it("fetches and maps job last build status successfully", async () => {
      mockJenkinsApiFetch.mockResolvedValueOnce({
        id: "42",
        number: 42,
        result: "SUCCESS",
        building: false,
        url: "https://jenkins.example.com/job/app/42",
        timestamp: 1700000000000,
      })

      const status = await getJenkinsJobStatus("app")

      expect(status).toEqual({
        id: "42",
        jobName: "app",
        buildNumber: 42,
        status: "SUCCESS",
        url: "https://jenkins.example.com/job/app/42",
        timestamp: 1700000000000,
      })
      expect(mockJenkinsApiFetch).toHaveBeenCalledWith(
        "job/app/lastBuild/api/json",
        {},
        undefined
      )
    })

    it("maps building state to BUILDING when result is null and building is true", async () => {
      mockJenkinsApiFetch.mockResolvedValueOnce({
        id: "43",
        number: 43,
        result: null,
        building: true,
        url: "https://jenkins.example.com/job/app/43",
        timestamp: 1700000001000,
      })

      const status = await getJenkinsJobStatus("app")

      expect(status?.status).toBe("BUILDING")
    })

    it("maps building state to PENDING when result is null and building is false", async () => {
      mockJenkinsApiFetch.mockResolvedValueOnce({
        id: "44",
        number: 44,
        result: null,
        building: false,
        url: "https://jenkins.example.com/job/app/44",
        timestamp: 1700000002000,
      })

      const status = await getJenkinsJobStatus("app")

      expect(status?.status).toBe("PENDING")
    })

    it("returns null when jenkinsApiFetch throws error", async () => {
      mockJenkinsApiFetch.mockRejectedValueOnce(new Error("Network timeout"))

      const status = await getJenkinsJobStatus("nonexistent-job")

      expect(status).toBeNull()
    })
  })

  describe("listJenkinsJobs", () => {
    it("returns list of job names", async () => {
      mockJenkinsApiFetch.mockResolvedValueOnce({
        jobs: [{ name: "job-alpha" }, { name: "job-beta" }],
      })

      const jobs = await listJenkinsJobs()

      expect(jobs).toEqual(["job-alpha", "job-beta"])
      expect(mockJenkinsApiFetch).toHaveBeenCalledWith(
        "api/json?tree=jobs[name]",
        {},
        undefined
      )
    })
  })
})
