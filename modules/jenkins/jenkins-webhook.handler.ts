import { triggerJenkinsJob } from "./jenkins.service"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export interface JenkinsVersionUpdatePayload {
  version: string
  application_stack: string
}

export interface ApplicationStack {
  id: string
  repoName: string | null
  fullName: string
  buildConfigJson: Prisma.JsonValue
}

export class JenkinsWebhookHandler {
  private static readonly DEFAULT_REGISTRY =
    process.env.JENKINS_DEFAULT_REGISTRY || "registry-apac.pfnapp.com"

  /**
   * Verify X-Jenkins-Token header
   */
  async verifyToken(token: string | null): Promise<boolean> {
    const WEBHOOK_TOKEN = process.env.JENKINS_WEBHOOK_TOKEN
    if (!WEBHOOK_TOKEN) {
      console.warn("JENKINS_WEBHOOK_TOKEN is not configured")
      return false
    }
    return token === WEBHOOK_TOKEN
  }

  /**
   * Find application stack by slug or name
   */
  async resolveApplicationStack(
    identifier: string
  ): Promise<ApplicationStack | null> {
    const app = await prisma.githubRepositoryConnection.findFirst({
      where: {
        OR: [{ repoName: identifier }, { fullName: { contains: identifier } }],
      },
      select: {
        id: true,
        repoName: true,
        fullName: true,
        buildConfigJson: true,
      },
    })

    return app
  }

  /**
   * Resolve Jenkins job name from stack config, with fallback naming convention
   */
  getJenkinsJobName(stack: ApplicationStack): string {
    const config = stack.buildConfigJson as Record<string, unknown> | null
    if (config?.jenkinsJobName && typeof config.jenkinsJobName === "string") {
      return config.jenkinsJobName
    }
    return `app-${stack.repoName || "unknown"}`
  }

  /**
   * Trigger Jenkins build for a version update on the given application stack
   */
  async syncVersion(stack: ApplicationStack, version: string) {
    const jobName = this.getJenkinsJobName(stack)

    await triggerJenkinsJob(jobName, {
      VERSION: version,
      APP_NAME: stack.repoName || "unknown",
      DOCKER_REGISTRY: JenkinsWebhookHandler.DEFAULT_REGISTRY,
    })

    return { success: true, version }
  }

  /**
   * Return status metrics
   */
  async getWebhookStatus() {
    return {
      healthy: true,
      tokenConfigured: !!process.env.JENKINS_WEBHOOK_TOKEN,
    }
  }
}

export const jenkinsWebhookHandler = new JenkinsWebhookHandler()
