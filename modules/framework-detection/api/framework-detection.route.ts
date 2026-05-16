import { Elysia } from "elysia"
import { z } from "zod"

import { detectFrameworkFromGitRepo } from "@/modules/framework-detection/framework-detection.service"
import type { DetectionResult } from "@/modules/framework-detection/framework-detection.types"

const detectionRequestSchema = z.object({
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

export const createFrameworkDetectionRoutes = (
  detectFramework: DetectFrameworkFunction = detectFrameworkFromGitRepo
) =>
  new Elysia().post("/framework-detection", async ({ body, set }) => {
    const parsed = detectionRequestSchema.safeParse(body)

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
        ...result,
      }
    } catch (error) {
      set.status = 422

      return {
        ok: false as const,
        error: "DETECTION_FAILED" as const,
        message:
          error instanceof Error
            ? error.message
            : "Unable to detect frameworks for this repository.",
      }
    }
  })

export const frameworkDetectionRoutes = createFrameworkDetectionRoutes()
