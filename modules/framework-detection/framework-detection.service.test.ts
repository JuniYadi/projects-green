import { beforeEach, describe, expect, it } from "bun:test"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { detectFrameworkFromGitRepo } from "@/modules/framework-detection/framework-detection.service"
import type { FrameworkDetectionInput } from "@/modules/framework-detection/framework-detection.types"
import type { DetectorDependencies } from "@/modules/framework-detection/framework-detection.service"

const writeRepoFiles = async (
  rootPath: string,
  entries: Record<string, string>
) => {
  for (const [filePath, content] of Object.entries(entries)) {
    const absolutePath = path.join(rootPath, filePath)

    await mkdir(path.dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, content)
  }
}

const runWithMockClone = async (
  input: FrameworkDetectionInput,
  files: Record<string, string>,
  resolveWithAi?: DetectorDependencies["resolveWithAi"]
) => {
  return detectFrameworkFromGitRepo(input, {
    cloneRepository: async (_, destinationPath) => {
      await writeRepoFiles(destinationPath, files)
    },
    resolveWithAi,
  })
}

describe("detectFrameworkFromGitRepo", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY
    delete process.env.AI_DETECTOR_MODEL
  })

  it("detects Next.js and does not require AI fallback", async () => {
    let aiCalled = false

    const result = await runWithMockClone(
      { repoUrl: "https://example.com/repo.git" },
      {
        "package.json": JSON.stringify({
          dependencies: {
            next: "16.1.0",
            react: "19.0.0",
          },
          scripts: {
            dev: "next dev",
          },
        }),
        "next.config.mjs": "export default {}",
        "app/page.tsx": "export default function Page() { return null }",
        "bun.lock": "{}",
      },
      async () => {
        aiCalled = true

        return {
          primaryFrameworkId: "nextjs",
          confidence: 0.95,
          requiredRuntimeIds: ["node"],
          reasoning: ["mock"],
        }
      }
    )

    expect(result.primaryFramework?.id).toBe("nextjs")
    expect(result.requiredDependencies).toContainEqual(
      expect.objectContaining({
        id: "node",
        requiredFor: "app_runtime",
      })
    )
    expect(aiCalled).toBe(false)
  })

  it("detects Laravel as primary and Node for asset build", async () => {
    const result = await runWithMockClone(
      { repoUrl: "https://example.com/repo.git" },
      {
        "composer.json": JSON.stringify({
          require: {
            "laravel/framework": "^11.0",
          },
        }),
        "composer.lock": "{}",
        artisan: "#!/usr/bin/env php",
        "bootstrap/app.php": "<?php",
        "config/app.php": "<?php",
        "package.json": JSON.stringify({
          devDependencies: {
            "laravel-vite-plugin": "^1.0",
          },
        }),
        "vite.config.js": "export default {}",
        "package-lock.json": "{}",
      }
    )

    expect(result.primaryFramework?.id).toBe("laravel")
    expect(result.requiredDependencies).toContainEqual(
      expect.objectContaining({
        id: "php",
        requiredFor: "app_runtime",
      })
    )
    expect(result.requiredDependencies).toContainEqual(
      expect.objectContaining({
        id: "node",
        requiredFor: "asset_build",
      })
    )
  })

  it("uses AI fallback when deterministic confidence is low", async () => {
    const result = await runWithMockClone(
      { repoUrl: "https://example.com/repo.git" },
      {
        "package.json": JSON.stringify({
          dependencies: {
            react: "19.0.0",
          },
          devDependencies: {
            vite: "5.0.0",
          },
        }),
        "vite.config.ts": "export default {}",
      },
      async () => ({
        primaryFrameworkId: "react",
        confidence: 0.8,
        requiredRuntimeIds: ["node"],
        reasoning: ["React + Vite signature is strongest"],
      })
    )

    expect(result.primaryFramework?.id).toBe("react")
    expect(result.evidence).toContainEqual(
      expect.objectContaining({
        type: "ai",
        value: "ai-disambiguation",
      })
    )
  })

  it("falls back to deterministic result when AI resolver fails", async () => {
    const result = await runWithMockClone(
      { repoUrl: "https://example.com/repo.git" },
      {
        "package.json": JSON.stringify({
          dependencies: {
            react: "19.0.0",
          },
          devDependencies: {
            vite: "5.0.0",
          },
        }),
        "vite.config.ts": "export default {}",
      },
      async () => {
        throw new Error("model unavailable")
      }
    )

    expect(result.primaryFramework?.id).toBe("react")
    expect(result.warnings.some((warning) => warning.includes("AI fallback skipped"))).toBe(true)
  })
})
