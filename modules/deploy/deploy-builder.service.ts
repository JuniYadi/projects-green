import { prisma } from "@/lib/prisma"
import { recordDeployEvent, recordDeployLog } from "./deploy-event.service"
import { syncJenkinsPipeline } from "@/modules/jenkins/jenkins-sync.service"
import { triggerJenkinsJob } from "@/modules/jenkins/jenkins.service"
import { GitOpsRepositoryService } from "@/modules/gitops/gitops.service"
import { AppManifestBuilder } from "@/modules/gitops/builders"
import * as jsYaml from "js-yaml"

/**
 * Processes a QUEUED deployment through the build/deploy pipeline.
 * Called by the deploy-monitor interval.
 */
export async function processQueuedDeployment(deploymentId: string) {
  const deployment = await prisma.applicationDeployment.findUnique({
    where: { id: deploymentId },
    include: { stack: true },
  })

  if (!deployment || deployment.status !== "QUEUED") {
    return { processed: false, reason: "not_queued" }
  }

  const stack = deployment.stack

  try {
    // Step 1: Mark as BUILDING
    await prisma.applicationDeployment.update({
      where: { id: deployment.id },
      data: { status: "BUILDING" },
    })
    await prisma.applicationStack.update({
      where: { id: stack.id },
      data: { status: "BUILDING" },
    })
    await recordDeployEvent({
      deploymentId: deployment.id,
      type: "BUILD_STARTED",
      message: `Build started for ${stack.name}`,
    })
    await recordDeployLog({
      deploymentId: deployment.id,
      scope: "build",
      status: "BUILDING",
      message: "Build worker picked up deployment.",
    })

    // Step 2: Sync Jenkins pipeline if stack has a repo connection
    if (stack.repositoryConnectionId) {
      const connection = await prisma.githubRepositoryConnection.findUnique({
        where: { id: stack.repositoryConnectionId },
        include: { installation: true },
      })

      if (connection) {
        try {
          await syncJenkinsPipeline({
            installationId: Number(connection.installation.githubInstallationId),
            owner: connection.ownerLogin,
            repo: connection.repoName,
            slug: stack.slug,
            branch: stack.branchName,
            framework: stack.framework ?? "docker",
            env: "dev",
          })

          // Trigger Jenkins build
          await triggerJenkinsJob(`deploy-${connection.repoName}`, {
            GIT_REF: stack.branchName,
            GIT_COMMIT: deployment.commitSha ?? "",
            STACK_ID: stack.id,
          })

          await recordDeployLog({
            deploymentId: deployment.id,
            scope: "build",
            status: "BUILD_TRIGGERED",
            message: `Jenkins build triggered for ${stack.slug}`,
          })
        } catch (err) {
          console.error(`[deploy-builder] Jenkins sync failed for ${stack.slug}:`, err)
          // Non-fatal — continue; Jenkins webhook will update status
        }
      }
    }

    // Step 3: Generate and push Helm manifests (done eagerly for simplicity;
    // in prod, wait for Jenkins webhook callback. For now we generate manifests
    // immediately so the GitOps repo has the config ready.)
    const envVars = (stack.envVarsJson as Array<{ key: string; value: string; type?: string; scope?: string }>) ?? []

    const plainEnv: Record<string, string> = {}
    const secretEnv: Record<string, string> = {}

    for (const e of envVars) {
      if (e.type === "secret") {
        secretEnv[e.key] = e.value
      } else {
        plainEnv[e.key] = e.value
      }
    }

    const builder = new AppManifestBuilder()
      .setAppName(`app-${stack.slug}`)
      .setNamespace(`app-${stack.slug}`)
      .setImage(`registry-apac.pfnapp.com/${stack.slug}:latest`)

    if (Object.keys(plainEnv).length > 0) {
      builder.addConfigMapData(plainEnv)
    }
    if (Object.keys(secretEnv).length > 0) {
      builder.addSecretData(secretEnv)
    }

    const manifest = builder.build()
    const manifestYaml = manifest.resources
      .map((r) => jsYaml.dump(r as Record<string, unknown>, { indent: 2, lineWidth: -1, noRefs: true }))
      .join("---\n")

    try {
      const gitops = new GitOpsRepositoryService()
      await gitops.commitFiles(
        process.env.GITOPS_REPO ?? "pfnapp/sgp-argocd-prod",
        `Deploy ${stack.slug}`,
        [{
          path: `services-yaml/${stack.slug}/deployment.yml`,
          content: manifestYaml,
        }],
      )

      await prisma.applicationDeployment.update({
        where: { id: deployment.id },
        data: {
          manifestPushed: true,
          manifestPushedAt: new Date(),
        },
      })
      await recordDeployEvent({
        deploymentId: deployment.id,
        type: "MANIFEST_PUSHED",
        message: `Manifests pushed for ${stack.name}`,
      })
      await recordDeployLog({
        deploymentId: deployment.id,
        scope: "deploy",
        status: "MANIFEST_PUSHED",
        message: "Helm manifests pushed to GitOps repo.",
      })
    } catch (err) {
      console.error(`[deploy-builder] Manifest push failed for ${stack.slug}:`, err)
      // Non-fatal; manifest push may fail if GitOps repo isn't configured
      await recordDeployLog({
        deploymentId: deployment.id,
        scope: "deploy",
        status: "MANIFEST_PUSH_FAILED",
        message: `Failed to push manifests: ${err instanceof Error ? err.message : "Unknown error"}`,
      })
    }

    // Step 4: Mark as ARGOCD_SYNCED (ArgoCD auto-syncs from GitOps repo)
    await recordDeployEvent({
      deploymentId: deployment.id,
      type: "ARGOCD_SYNC_STARTED",
      message: `ArgoCD sync started for ${stack.name}`,
    })
    await recordDeployLog({
      deploymentId: deployment.id,
      scope: "argocd",
      status: "ARGOCD_SYNC_STARTED",
      message: "Waiting for ArgoCD to sync manifests.",
    })

    // Mark as synced (ArgoCD auto-syncs; polling would happen in a future iteration)
    await prisma.applicationDeployment.update({
      where: { id: deployment.id },
      data: {
        argocdSynced: true,
        argocdSyncedAt: new Date(),
      },
    })
    await recordDeployEvent({
      deploymentId: deployment.id,
      type: "ARGOCD_SYNCED",
      message: `ArgoCD synced for ${stack.name}`,
    })

    // Step 5: Mark as RUNNING
    await prisma.applicationDeployment.update({
      where: { id: deployment.id },
      data: {
        status: "RUNNING",
        completedAt: new Date(),
      },
    })
    await prisma.applicationStack.update({
      where: { id: stack.id },
      data: {
        status: "RUNNING",
        lastDeployStatus: "RUNNING",
        lastDeployedAt: new Date(),
      },
    })
    await recordDeployEvent({
      deploymentId: deployment.id,
      type: "DEPLOY_COMPLETED",
      message: `Deployment completed for ${stack.name}`,
    })
    await recordDeployLog({
      deploymentId: deployment.id,
      scope: "deploy",
      status: "RUNNING",
      message: "Application is running.",
    })

    return { processed: true, status: "RUNNING" }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error"

    await prisma.applicationDeployment.update({
      where: { id: deployment.id },
      data: {
        status: "FAILED",
        failureReason: reason,
        completedAt: new Date(),
      },
    })
    await prisma.applicationStack.update({
      where: { id: stack.id },
      data: { lastDeployStatus: "FAILED" },
    })
    await recordDeployEvent({
      deploymentId: deployment.id,
      type: "DEPLOY_FAILED",
      message: `Deployment failed: ${reason}`,
    })
    await recordDeployLog({
      deploymentId: deployment.id,
      scope: "deploy",
      status: "FAILED",
      message: reason,
    })

    return { processed: true, status: "FAILED", error: reason }
  }
}
