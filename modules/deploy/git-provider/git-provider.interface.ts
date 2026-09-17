import type { AiDeploymentSessionActor } from "@/modules/deploy/ai-deployment-session.service"

export type GitProviderAccessResult = {
  accessible: boolean
  reason?: string
  requiresAuth?: boolean
  provider: "github" | "gitlab" | "generic"
  isPrivate?: boolean
  defaultBranch?: string
}

export interface GitProviderAdapter {
  readonly name: string
  matches(url: string): boolean
  checkAccess(
    url: string,
    actor?: AiDeploymentSessionActor
  ): Promise<GitProviderAccessResult>
  listTree(
    url: string,
    ref?: string,
    subpath?: string,
    actor?: AiDeploymentSessionActor
  ): Promise<{ files: string[]; truncated: boolean }>
  readFile(
    url: string,
    filePath: string,
    ref?: string,
    actor?: AiDeploymentSessionActor
  ): Promise<{ content: string; size: number }>
}
