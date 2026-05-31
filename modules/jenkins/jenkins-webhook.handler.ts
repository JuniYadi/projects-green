import { triggerJenkinsJob } from "./jenkins.service"
import { prisma } from "@/lib/prisma"

export interface JenkinsVersionUpdatePayload {
  version: string
  application_stack: string
}

export class JenkinsWebhookHandler {
  private static readonly DEFAULT_REGISTRY = "registry-apac.pfnapp.com"

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
  async resolveApplicationStack(identifier: string) {
    let app = await prisma.githubRepositoryConnection.findFirst({
      where: {
        OR: [
          { repoName: identifier },
          { fullName: { contains: identifier } }
        ]
      }
    })

    return app
  }

  /**
   * Set default docker fields if empty
   */
  populateDockerFields(stack: any) {
    const slug = stack.repoName || "unknown"
    const updates: any = {}

    if (!stack.dockerRegistry) updates.dockerRegistry = JenkinsWebhookHandler.DEFAULT_REGISTRY
    if (!stack.dockerImage) updates.dockerImage = slug
    if (!stack.jenkinsJobName) updates.jenkinsJobName = `app-${slug}`

    return updates
  }

  /**
   * Update version and trigger GitSync
   */
  async syncVersion(stack: any, version: string) {
    if (stack.version === version) {
      console.log(`Version unchanged (${version}) for ${stack.repoName}`)
      return { success: true, version, unchanged: true }
    }

    const dockerUpdates = this.populateDockerFields(stack)
    
    await prisma.githubRepositoryConnection.update({
      where: { id: stack.id },
      data: {
        ...dockerUpdates,
      }
    })

    console.log(`Triggering sync for ${stack.repoName} with version ${version}`)
    
    await triggerJenkinsJob(dockerUpdates.jenkinsJobName || stack.jenkinsJobName || `app-${stack.repoName}`, {
      VERSION: version,
      APP_NAME: stack.repoName
    })

    return { success: true, version }
  }

  /**
   * Return status metrics
   */
  async getWebhookStatus() {
    return {
      healthy: true,
      tokenConfigured: !!process.env.JENKINS_WEBHOOK_TOKEN
    }
  }
}

export const jenkinsWebhookHandler = new JenkinsWebhookHandler()
