import { commitFileToRepo } from "@/modules/github/github.service"
import {
  generatePhpDsl,
  generateNodeDsl,
  generateDockerDsl,
} from "./jenkins-dsl"

// ─── Types ────────────────────────────────────────────────────────────────────

export type JenkinsSyncInput = {
  /** GitHub installation ID for API access */
  installationId: number
  /** Repository owner (e.g., "pfnapp") */
  owner: string
  /** Repository name (e.g., "pfnapp") */
  repo: string
  /** Stack slug (e.g., "app-myapp-dev") */
  slug: string
  /** Git branch to build */
  branch: string
  /** Detected framework (e.g., "laravel", "nextjs", "bun") */
  framework: string
  /** Environment: "dev" or "prod" */
  env: "dev" | "prod"
  /** Jenkins repo owner (default: same as app owner) */
  jenkinsOwner?: string
  /** Jenkins repo name (default: "Jenkins") */
  jenkinsRepo?: string
  /** Credential ID for Git access (default: "github-token") */
  gitCredentialId?: string
}

export type JenkinsSyncResult = {
  /** Whether the DSL file was created or updated */
  action: "created" | "updated"
  /** Path to the DSL file in Jenkins repo */
  filePath: string
  /** Commit SHA */
  commitSha: string
  /** Pipeline type used */
  pipelineType: string
}

// ─── Framework → Pipeline Mapping ─────────────────────────────────────────────

type PipelineType = "php" | "node" | "docker"

const FRAMEWORK_TO_PIPELINE: Record<string, PipelineType> = {
  laravel: "php",
  php: "php",
  nextjs: "node",
  node: "node",
  nuxt: "node",
  bun: "node",
  docker: "docker",
}

function resolvePipelineType(framework: string): PipelineType {
  const normalized = framework.toLowerCase().trim()
  const pipelineType = FRAMEWORK_TO_PIPELINE[normalized]

  if (!pipelineType) {
    throw new Error(
      `Unsupported framework "${framework}". Supported: ${Object.keys(FRAMEWORK_TO_PIPELINE).join(", ")}`
    )
  }

  return pipelineType
}

// ─── DSL File Path ────────────────────────────────────────────────────────────

function buildDslFilePath(slug: string): string {
  return `jobs/pfnapp/${slug}.groovy`
}

// ─── Main Sync Function ──────────────────────────────────────────────────────

/**
 * Sync a Jenkins pipeline DSL file for an app hosting stack.
 *
 * Flow:
 * 1. Map framework → pipeline type
 * 2. Generate DSL content using existing generators
 * 3. Commit to pfnapp/Jenkins via GitHub API
 *
 * The existing GitHub workflow in pfnapp/Jenkins auto-triggers the seed job
 * when files in jobs/** are pushed, so no manual Jenkins API call is needed.
 */
export async function syncJenkinsPipeline(
  input: JenkinsSyncInput
): Promise<JenkinsSyncResult> {
  const {
    installationId,
    owner,
    repo,
    slug,
    branch,
    framework,
    env,
    jenkinsOwner = owner,
    jenkinsRepo = "Jenkins",
    gitCredentialId = "github-token",
  } = input

  // 1. Resolve pipeline type from framework
  const pipelineType = resolvePipelineType(framework)

  // 2. Build repo URL and DSL options
  const repoUrl = `https://github.com/${owner}/${repo}`
  const filePath = buildDslFilePath(slug)

  const dslOptions = {
    appStackSlug: slug,
    gitRepoUrl: repoUrl,
    gitRepoBranch: branch,
    gitCredentialId,
    env,
  }

  // 3. Generate DSL content
  let dslContent: string
  switch (pipelineType) {
    case "php":
      dslContent = generatePhpDsl(dslOptions)
      break
    case "node":
      dslContent = generateNodeDsl(dslOptions)
      break
    case "docker":
      dslContent = generateDockerDsl(dslOptions)
      break
  }

  // 4. Commit to Jenkins repo via GitHub API
  const commitMessage = `feat: add Jenkins pipeline for ${slug}`

  const result = await commitFileToRepo({
    installationId,
    owner: jenkinsOwner,
    repo: jenkinsRepo,
    filePath,
    content: dslContent,
    message: commitMessage,
    branch: "main",
  })

  return {
    action: result.action,
    filePath: result.filePath,
    commitSha: result.commitSha,
    pipelineType,
  }
}
