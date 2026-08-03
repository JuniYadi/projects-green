import { Elysia } from "elysia"
import { z } from "zod"

import {
  detectFrameworkFromGitRepo,
  detectFrameworkFromGithubApi,
} from "@/modules/framework-detection/framework-detection.service"
import { toDetectionResultDTO } from "@/modules/framework-detection/framework-detection.dto"
import type { DetectionResult } from "@/modules/framework-detection/framework-detection.types"

// --- Git Clone Mode (Legacy) ---

const gitDetectionRequestSchema = z.object({
  repoUrl: z.url("repoUrl must be a valid URL."),
  ref: z.string().trim().min(1).optional(),
  subdir: z.string().trim().min(1).optional(),
  maxScanFiles: z.number().int().positive().max(20_000).optional(),
  maxDepth: z.number().int().positive().max(20).optional(),
  cloneTimeoutMs: z.number().int().positive().max(300_000).optional(),
  scanTimeoutMs: z.number().int().positive().max(120_000).optional(),
})

type DetectFrameworkFunction = (input: {
  repoUrl: string
  ref?: string
  subdir?: string
  maxScanFiles?: number
  maxDepth?: number
  cloneTimeoutMs?: number
  scanTimeoutMs?: number
}) => Promise<DetectionResult>

// --- GitHub API Mode ---

const githubApiDetectionRequestSchema = z.object({
  installationId: z.number().int().positive(),
  owner: z.string().trim().min(1),
  repo: z.string().trim().min(1),
  ref: z.string().trim().min(1).optional(),
  subdir: z.string().trim().min(1).optional(),
})

type DetectFrameworkFromGithubApiFunction = (input: {
  installationId: number
  owner: string
  repo: string
  ref?: string
  subdir?: string
}) => Promise<DetectionResult>

const getDetectionErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : ""

  if (
    message.includes("AI returned an invalid decision schema") ||
    message.includes("AI failed to return a valid decision") ||
    message.includes("invalid-schema")
  ) {
    return "Automatic detection could not validate the AI response. Retry detection or configure build settings manually."
  }

  if (message === "Repository not found") {
    return message
  }
  if (message === "GitHub API rate limit exceeded") {
    return message
  }

  return "Unable to detect frameworks for this repository."
}

// --- Routes ---

export const createFrameworkDetectionRoutes = (
  detectFramework: DetectFrameworkFunction = detectFrameworkFromGitRepo,
  detectFrameworkFromApi: DetectFrameworkFromGithubApiFunction = detectFrameworkFromGithubApi
) =>
  new Elysia()
    // Git Clone Mode (Legacy)
    .post("/framework-detection", async ({ body, set }) => {
      const parsed = gitDetectionRequestSchema.safeParse(body)

      if (!parsed.success) {
        set.status = 400
        return {
          ok: false as const,
          error: "INVALID_PAYLOAD" as const,
          message: "Invalid framework detection payload.",
          fieldErrors: z.flattenError(parsed.error).fieldErrors,
        }
      }

      try {
        const result = await detectFramework(parsed.data)

        return {
          ok: true as const,
          ...toDetectionResultDTO(result),
        }
      } catch (error) {
        set.status = 422

        return {
          ok: false as const,
          error: "DETECTION_FAILED" as const,
          message: getDetectionErrorMessage(error),
        }
      }
    })
    // GitHub API Mode (AI-First with Tool Calling)
    .post("/framework-detection/github", async ({ body, set }) => {
      const parsed = githubApiDetectionRequestSchema.safeParse(body)

      if (!parsed.success) {
        set.status = 400
        return {
          ok: false as const,
          error: "INVALID_PAYLOAD" as const,
          message: "Invalid GitHub API detection payload.",
          fieldErrors: z.flattenError(parsed.error).fieldErrors,
        }
      }

      try {
        const result = await detectFrameworkFromApi(parsed.data)

        return {
          ok: true as const,
          ...toDetectionResultDTO(result),
        }
      } catch (error) {
        set.status = 422

        return {
          ok: false as const,
          error: "DETECTION_FAILED" as const,
          message: getDetectionErrorMessage(error),
        }
      }
    })

export const frameworkDetectionRoutes = createFrameworkDetectionRoutes()
