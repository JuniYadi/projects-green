import { Elysia } from "elysia"
import { z } from "zod"

import { type JenkinsJobConfig, JenkinsApiError, JenkinsAuthError } from "../jenkins.types"
import { getJenkinsJobStatus, triggerJenkinsJob, listJenkinsJobs } from "../jenkins.service"
import { generateJenkinsDsl } from "../jenkins-dsl"

const JOB_TYPES = ["php", "node", "docker"] as const

const buildTriggerSchema = z.object({
  jobName: z.string().trim().min(1),
  parameters: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])).optional(),
})

const jobDslSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(JOB_TYPES),
  repositoryUrl: z.string().url().optional(),
  branch: z.string().trim().optional(),
  credentialId: z.string().trim().optional(),
  phpVersion: z.string().optional(),
  nodeVersion: z.string().optional(),
  runNodeBuild: z.boolean().optional(),
  tagVersion: z.string().optional(),
  useAlpine: z.boolean().optional(),
  dockerImage: z.string().optional(),
  dockerRegistryUrl: z.string().optional(),
  dockerRegistryCredentialId: z.string().optional(),
  env: z.enum(["prod", "dev"]).optional(),
  port: z.number().optional(),
  environmentVariables: z.record(z.string(), z.string()).optional(),
})

export const createJenkinsRoutes = () => {
  return new Elysia({ prefix: "/integrations/jenkins" })
    .get("/status", async ({ set }) => {
      try {
        const jobs = await listJenkinsJobs()
        return { ok: true as const, connected: true, jobCount: jobs.length, jobs }
      } catch {
        return { ok: false as const, error: "CONNECTION_FAILED", message: "Cannot connect to Jenkins server" }
      }
    })
    .get("/jobs", async ({ query, set }) => {
      const limit = query.limit ? Math.min(Number(query.limit), 100) : undefined
      try {
        const jobs = await listJenkinsJobs()
        return {
          ok: true as const,
          items: limit ? jobs.slice(0, limit) : jobs,
          total: jobs.length,
        }
      } catch {
        set.status = 500
        return { ok: false as const, error: "LIST_FAILED", message: "Failed to list Jenkins jobs" }
      }
    })
    .get("/jobs/:jobName/status", async ({ params, set }) => {
      try {
        const status = await getJenkinsJobStatus(params.jobName)
        if (!status) {
          set.status = 404
          return { ok: false as const, error: "JOB_NOT_FOUND", message: `Job '${params.jobName}' not found` }
        }
        return { ok: true as const, build: status }
      } catch (error) {
        if (error instanceof JenkinsAuthError) {
          set.status = 401
          return { ok: false as const, error: "AUTH_FAILED", message: "Jenkins authentication failed" }
        }
        set.status = 500
        return { ok: false as const, error: "STATUS_FAILED", message: "Failed to fetch job status" }
      }
    })
    .post("/jobs/build", async ({ body, set }) => {
      const parsed = buildTriggerSchema.safeParse(body)
      if (!parsed.success) {
        set.status = 400
        return { ok: false as const, error: "INVALID_BODY", message: "Invalid job trigger body" }
      }
      try {
        await triggerJenkinsJob(parsed.data.jobName, parsed.data.parameters ?? {})
        return { ok: true as const, message: `Build triggered for job '${parsed.data.jobName}'` }
      } catch (error) {
        if (error instanceof JenkinsAuthError) {
          set.status = 401
          return { ok: false as const, error: "AUTH_FAILED", message: "Jenkins authentication failed" }
        }
        if (error instanceof JenkinsApiError) {
          set.status = 502
          return { ok: false as const, error: "API_ERROR", message: `Jenkins API error: ${error.message}` }
        }
        set.status = 500
        return { ok: false as const, error: "TRIGGER_FAILED", message: "Failed to trigger Jenkins build" }
      }
    })
    .post("/jobs/dsl/generate", async ({ body, set }) => {
      const parsed = jobDslSchema.safeParse(body)
      if (!parsed.success) {
        set.status = 400
        return { ok: false as const, error: "INVALID_BODY", message: parsed.error.message }
      }
      try {
        const config: JenkinsJobConfig = {
          name: parsed.data.name,
          type: parsed.data.type,
          repositoryUrl: parsed.data.repositoryUrl,
          branch: parsed.data.branch,
          credentialId: parsed.data.credentialId,
        }
        const dsl = generateJenkinsDsl(config, {
          phpVersion: parsed.data.phpVersion,
          nodeVersion: parsed.data.nodeVersion,
          runNodeBuild: parsed.data.runNodeBuild,
          tagVersion: parsed.data.tagVersion,
          useAlpine: parsed.data.useAlpine,
          dockerImage: parsed.data.dockerImage,
          dockerRegistryUrl: parsed.data.dockerRegistryUrl,
          dockerRegistryCredentialId: parsed.data.dockerRegistryCredentialId,
          env: parsed.data.env,
          port: parsed.data.port,
          environmentVariables: (parsed.data.environmentVariables as Record<string, string>) ?? undefined,
        })
        return { ok: true as const, dsl }
      } catch (error) {
        set.status = 500
        return {
          ok: false as const,
          error: "DSL_ERROR",
          message: `DSL generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        }
      }
    })
}

export const jenkinsRoutes = createJenkinsRoutes()