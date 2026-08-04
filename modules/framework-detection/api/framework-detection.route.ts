import { withAuth } from "@workos-inc/authkit-nextjs"
import { Elysia } from "elysia"
import { z } from "zod"

import {
  detectFrameworkFromGitRepo,
  detectFrameworkFromGithubApi,
} from "@/modules/framework-detection/framework-detection.service"
import { toDetectionResultDTO } from "@/modules/framework-detection/framework-detection.dto"
import { parsePublicGitUrl } from "@/modules/deploy/public-source"
import type {
  DetectionFailureCode,
  DetectionResult,
} from "@/modules/framework-detection/framework-detection.types"

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

type DetectionErrorCode =
  | DetectionFailureCode
  | "DETECTION_FAILED"
  | "NETWORK_ERROR"

const DETECTION_ERROR_CODES: Record<string, true> = {
  DETECTION_CONFIG_ERROR: true,
  DETECTION_SCHEMA_ERROR: true,
  DETECTION_PROVIDER_ERROR: true,
  DETECTION_TRANSIENT_PROVIDER_ERROR: true,
  DETECTION_FAILED: true,
  NETWORK_ERROR: true,
}

const isDetectionErrorCode = (value: unknown): value is DetectionErrorCode =>
  typeof value === "string" && DETECTION_ERROR_CODES[value] === true

const getDetectionFailure = (
  error: unknown
): {
  code: DetectionErrorCode
  message: string
  inspectionLogId?: string
} => {
  const candidate = error as {
    code?: unknown
    message?: unknown
    inspectionLogId?: unknown
  }
  const message = typeof candidate.message === "string" ? candidate.message : ""

  let code: DetectionErrorCode = "DETECTION_FAILED"
  if (isDetectionErrorCode(candidate.code)) {
    code = candidate.code
  } else if (
    /AI_API_KEY|OPENAI_API_KEY|not configured|credentials?/i.test(message)
  ) {
    code = "DETECTION_CONFIG_ERROR"
  } else if (
    /invalid-schema|invalid decision schema|valid decision/i.test(message)
  ) {
    code = "DETECTION_SCHEMA_ERROR"
  } else if (
    /rate limit|temporar|timeout|network|\b429\b|\b5\d{2}\b/i.test(message)
  ) {
    code = "DETECTION_TRANSIENT_PROVIDER_ERROR"
  } else if (/provider returned error|provider/i.test(message)) {
    code = "DETECTION_PROVIDER_ERROR"
  }

  const safeMessage =
    isDetectionErrorCode(candidate.code) && message
      ? message
      : message === "Repository not found" ||
          message === "GitHub API rate limit exceeded"
        ? message
        : code === "DETECTION_CONFIG_ERROR"
          ? "Automatic detection is not configured. Configure build settings manually."
          : code === "DETECTION_SCHEMA_ERROR"
            ? "Automatic detection could not validate the AI response. Retry detection or configure build settings manually."
            : code === "DETECTION_TRANSIENT_PROVIDER_ERROR" ||
                code === "NETWORK_ERROR"
              ? "Automatic detection provider is temporarily unavailable. Retry detection or configure build settings manually."
              : "Unable to detect frameworks for this repository."

  return {
    code,
    message: safeMessage,
    ...(typeof candidate.inspectionLogId === "string"
      ? { inspectionLogId: candidate.inspectionLogId }
      : {}),
  }
}

// --- Routes ---

export const createFrameworkDetectionRoutes = (
  detectFramework: DetectFrameworkFunction = detectFrameworkFromGitRepo,
  detectFrameworkFromApi: DetectFrameworkFromGithubApiFunction = detectFrameworkFromGithubApi
) =>
  new Elysia()
    .post("/framework-detection", async ({ body, set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return {
          ok: false as const,
          error: "UNAUTHORIZED",
          message: "Unauthorized",
        }
      }
      if (!auth.organizationId) {
        set.status = 403
        return {
          ok: false as const,
          error: "FORBIDDEN",
          message: "Organization required",
        }
      }

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

      const publicUrl = parsePublicGitUrl(parsed.data.repoUrl)
      if ("error" in publicUrl) {
        set.status = 400
        return {
          ok: false as const,
          error: "INVALID_PAYLOAD" as const,
          message: "Invalid framework detection payload.",
          fieldErrors: { repoUrl: [publicUrl.error] },
        }
      }

      try {
        const result = await detectFramework({
          ...parsed.data,
          repoUrl: publicUrl.url,
        })
        return { ok: true as const, ...toDetectionResultDTO(result) }
      } catch (error) {
        set.status = 422
        const failure = getDetectionFailure(error)
        return {
          ok: false as const,
          error: failure.code,
          message: failure.message,
          ...(failure.inspectionLogId
            ? { inspectionLogId: failure.inspectionLogId }
            : {}),
        }
      }
    })
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
        return { ok: true as const, ...toDetectionResultDTO(result) }
      } catch (error) {
        set.status = 422
        const failure = getDetectionFailure(error)
        return {
          ok: false as const,
          error: failure.code,
          message: failure.message,
          ...(failure.inspectionLogId
            ? { inspectionLogId: failure.inspectionLogId }
            : {}),
        }
      }
    })

export const frameworkDetectionRoutes = createFrameworkDetectionRoutes()
