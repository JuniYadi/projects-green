import { tool } from "ai"
import { z } from "zod"
import type { GitProviderAdapter } from "@/modules/deploy/git-provider"
import type { AiDeploymentSessionActor } from "@/modules/deploy/ai-deployment-session.service"
import type { AiDetectionToolTrace } from "../framework-detection.trace"

export type CreateRepoInspectorToolsParams = {
  adapter: GitProviderAdapter
  repoUrl: string
  ref?: string
  subpath?: string
  actor?: AiDeploymentSessionActor
  onStep?: (traceItem: AiDetectionToolTrace) => void
}

export function createRepoInspectorTools(
  params: CreateRepoInspectorToolsParams
) {
  const { adapter, repoUrl, ref, subpath, actor, onStep } = params

  return {
    list_repo_files: tool({
      description:
        "List files in the repository using the Git provider. Returns an array of file paths.",
      parameters: z.object({
        path: z
          .string()
          .optional()
          .describe("Subdirectory path or prefix to filter by"),
      }),
      execute: async ({ path }: { path?: string }) => {
        const start = Date.now()
        const targetPath = path ?? subpath
        try {
          const result = await adapter.listTree(repoUrl, ref, targetPath, actor)
          const durationMs = Date.now() - start
          const traceItem: AiDetectionToolTrace = {
            name: "list_repo_files",
            inputSummary: {
              requestedPath: targetPath,
            },
            path: targetPath,
            outcome: "completed",
            status: "completed",
            durationMs,
            listedFileCount: result.files.length,
          }
          onStep?.(traceItem)
          return {
            files: result.files,
            truncated: result.truncated,
          }
        } catch (error) {
          const durationMs = Date.now() - start
          const traceItem: AiDetectionToolTrace = {
            name: "list_repo_files",
            inputSummary: {
              requestedPath: targetPath,
            },
            path: targetPath,
            outcome: "failed",
            status: "failed",
            durationMs,
            errorCategory: "tool_failure",
          }
          onStep?.(traceItem)
          throw error
        }
      },
    }),

    read_repo_file: tool({
      description:
        "Read the content of a file in the repository (e.g. package.json, composer.json, Dockerfile, .env.example).",
      parameters: z.object({
        filePath: z.string().describe("Path to the file to read"),
      }),
      execute: async ({ filePath }: { filePath: string }) => {
        const start = Date.now()
        const cleanSubpath = subpath ? subpath.replace(/^\/+|\/+$/g, "") : ""
        const cleanFilePath = filePath.replace(/^\/+/, "")
        const targetPath =
          cleanSubpath &&
          !cleanFilePath.startsWith(`${cleanSubpath}/`) &&
          cleanFilePath !== cleanSubpath
            ? `${cleanSubpath}/${cleanFilePath}`
            : filePath

        try {
          let result: { content: string; size: number }
          try {
            result = await adapter.readFile(repoUrl, targetPath, ref, actor)
          } catch (initialError) {
            if (targetPath !== filePath) {
              result = await adapter.readFile(repoUrl, filePath, ref, actor)
            } else {
              throw initialError
            }
          }

          const durationMs = Date.now() - start
          // Redacted trace item: records path, size, duration, status, but NO raw file content.
          const traceItem: AiDetectionToolTrace = {
            name: "read_repo_file",
            inputSummary: {
              requestedPath: filePath,
            },
            path: filePath,
            outcome: "completed",
            status: "completed",
            durationMs,
            fileSizeBytes: result.size,
            size: result.size,
          }
          onStep?.(traceItem)

          const maxContentLength = 20_000
          const content =
            result.content.length > maxContentLength
              ? result.content.slice(0, maxContentLength) + "\n... (truncated)"
              : result.content

          return {
            content,
            path: filePath,
            size: result.size,
          }
        } catch (error) {
          const durationMs = Date.now() - start
          const traceItem: AiDetectionToolTrace = {
            name: "read_repo_file",
            inputSummary: {
              requestedPath: filePath,
            },
            path: filePath,
            outcome: "failed",
            status: "failed",
            durationMs,
            errorCategory: "tool_failure",
          }
          onStep?.(traceItem)
          throw error
        }
      },
    }),
  }
}
