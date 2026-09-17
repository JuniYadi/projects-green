import type { AiDeploymentSessionActor } from "@/modules/deploy/ai-deployment-session.service"
import type {
  GitProviderAccessResult,
  GitProviderAdapter,
} from "./git-provider.interface"
import { GitHubProviderAdapter } from "./github-provider.adapter"
import { GitLabProviderAdapter } from "./gitlab-provider.adapter"

export class GitProviderRegistry {
  private readonly adapters: GitProviderAdapter[] = []

  constructor(initialAdapters: GitProviderAdapter[] = []) {
    for (const adapter of initialAdapters) {
      this.register(adapter)
    }
  }

  register(adapter: GitProviderAdapter): void {
    const index = this.adapters.findIndex((a) => a.name === adapter.name)
    if (index >= 0) {
      this.adapters[index] = adapter
    } else {
      this.adapters.push(adapter)
    }
  }

  resolve(url: string): GitProviderAdapter {
    const matched = this.adapters.find((adapter) => adapter.matches(url))
    if (!matched) {
      throw new Error(`No git provider adapter found for URL: ${url}`)
    }
    return matched
  }

  async checkAccess(
    url: string,
    actor?: AiDeploymentSessionActor
  ): Promise<GitProviderAccessResult> {
    try {
      const adapter = this.resolve(url)
      return await adapter.checkAccess(url, actor)
    } catch (error) {
      return {
        accessible: false,
        reason:
          error instanceof Error ? error.message : "Unknown git provider error",
        provider: "generic",
      }
    }
  }
}

export const gitProviderRegistry = new GitProviderRegistry([
  new GitHubProviderAdapter(),
  new GitLabProviderAdapter(),
])

export function resolveGitProvider(url: string): GitProviderAdapter {
  return gitProviderRegistry.resolve(url)
}

export function checkGitAccess(
  url: string,
  actor?: AiDeploymentSessionActor
): Promise<GitProviderAccessResult> {
  return gitProviderRegistry.checkAccess(url, actor)
}
