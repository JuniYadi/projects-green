import { prisma } from "@/lib/prisma"
import { recordDeployEventOnce, recordDeployLog } from "./deploy-event.service"
import { syncJenkinsPipeline } from "@/modules/jenkins/jenkins-sync.service"
import {
  triggerJenkinsJob,
  type JenkinsApiConfig,
} from "@/modules/jenkins/jenkins.service"
import {
  resolveClusterIntegration,
  type GitOpsClusterConfig,
  type JenkinsClusterConfig,
  type RegistryClusterConfig,
} from "@/modules/deploy/cluster-integration.service"
import { GitOpsRepositoryService } from "@/modules/gitops/gitops.service"
import { AppManifestBuilder } from "@/modules/gitops/builders"
import * as jsYaml from "js-yaml"

/**
 * Processes a QUEUED deployment through the build/deploy pipeline.
 * Called by the deploy-monitor interval.
 *
 * Jenkins/registry credentials come from the cluster integration resolver
 * (AppHostingClusterIntegration) when a cluster is configured; otherwise
 * the legacy env-based fallback is used. The eager BUILDING -> RUNNING
 * transition is gated on APP_HOSTING_EAGER_DEPLOY_FALLBACK so the new
 * Jenkins image-ready + ArgoCD polling flow can drive completion honestly.
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

  let jenkinsConfig: JenkinsClusterConfig | null = null
  let registryConfig: RegistryClusterConfig | null = null
  try {
    jenkinsConfig = await resolveClusterIntegration(stack.id, "JENKINS")
  } catch {
    jenkinsConfig = null
  }
  try {
    registryConfig = await resolveClusterIntegration(stack.id, "REGISTRY")
  } catch {
    registryConfig = null
  }
  let gitopsConfig: GitOpsClusterConfig | null = null
  try {
    gitopsConfig = await resolveClusterIntegration(stack.id, "GITOPS")
  } catch {
    gitopsConfig = null
  }

  const jenkinsApiConfig: JenkinsApiConfig | undefined = jenkinsConfig
    ? {
        baseUrl: jenkinsConfig.baseUrl,
        username: jenkinsConfig.username,
        apiToken: jenkinsConfig.apiToken,
      }
    : undefined

  const eagerFallback = process.env.APP_HOSTING_EAGER_DEPLOY_FALLBACK === "true"

  try {
    await prisma.$transaction(async (tx) => {
      // Step 1: Mark as BUILDING
      await tx.applicationDeployment.update({
        where: { id: deployment.id },
        data: { status: "BUILDING" },
      })
      await tx.applicationStack.update({
        where: { id: stack.id },
        data: { status: "BUILDING" },
      })
      await recordDeployEventOnce(
        {
          deploymentId: deployment.id,
          type: "BUILD_STARTED",
          message: `Build started for ${stack.name}`,
        },
        tx
      )
      await recordDeployLog(
        {
          deploymentId: deployment.id,
          scope: "build",
          status: "BUILDING",
          message: "Build worker picked up deployment.",
        },
        tx
      )

      // Step 2: Sync Jenkins pipeline if stack has a repo connection
      if (stack.repositoryConnectionId) {
        const connection = await prisma.githubRepositoryConnection.findUnique({
          where: { id: stack.repositoryConnectionId },
          include: { installation: true },
        })

        if (connection) {
          try {
            const jenkinsOwner =
              jenkinsConfig?.dslOwner ?? connection.ownerLogin
            const jenkinsRepo = jenkinsConfig?.dslRepo ?? connection.repoName
            const gitCredentialId =
              jenkinsConfig?.gitCredentialId ?? "github-token"

            await syncJenkinsPipeline({
              installationId: Number(
                connection.installation.githubInstallationId
              ),
              owner: jenkinsOwner,
              repo: jenkinsRepo,
              slug: stack.slug,
              branch: stack.branchName,
              framework: stack.framework ?? "docker",
              env: "dev",
              gitCredentialId,
            })

            // Trigger Jenkins build
            const jobName = `deploy-${connection.repoName}`
            await triggerJenkinsJob(
              jobName,
              {
                GIT_REF: stack.branchName,
                GIT_COMMIT: deployment.commitSha ?? "",
                STACK_ID: stack.id,
                ...(jenkinsConfig?.webhookToken
                  ? { PFNAPP_WEBHOOK_TOKEN: jenkinsConfig.webhookToken }
                  : {}),
              },
              jenkinsApiConfig
            )

            await recordDeployEventOnce(
              {
                deploymentId: deployment.id,
                type: "JENKINS_JOB_TRIGGERED",
                message: `Jenkins job triggered for ${stack.slug}`,
                metadata: {
                  jobName,
                  commitSha: deployment.commitSha ?? null,
                  clusterCode: jenkinsConfig ? "sgp" : "env-fallback",
                },
              },
              tx
            )
            await recordDeployLog(
              {
                deploymentId: deployment.id,
                scope: "build",
                status: "BUILD_TRIGGERED",
                message: `Jenkins build triggered for ${stack.slug}`,
              },
              tx
            )
          } catch (err) {
            console.error(
              `[deploy-builder] Jenkins sync failed for ${stack.slug}:`,
              err
            )
            // Non-fatal — continue; Jenkins webhook will update status
          }
        }
      } else if (stack.sourceType === "PUBLIC" && stack.publicSourceUrl) {
        try {
          const jobName = `deploy-${stack.slug}`
          await triggerJenkinsJob(
            jobName,
            {
              PUBLIC_SOURCE_URL: stack.publicSourceUrl,
              GIT_REF: stack.publicSourceRef ?? stack.branchName,
              STACK_ID: stack.id,
              ...(jenkinsConfig?.webhookToken
                ? { PFNAPP_WEBHOOK_TOKEN: jenkinsConfig.webhookToken }
                : {}),
            },
            jenkinsApiConfig
          )
          await recordDeployEventOnce(
            {
              deploymentId: deployment.id,
              type: "JENKINS_JOB_TRIGGERED",
              message: `Jenkins public-source job triggered for ${stack.slug}`,
              metadata: { jobName, sourceUrl: stack.publicSourceUrl },
            },
            tx
          )
        } catch (error) {
          console.error(
            `[deploy-builder] Public Jenkins trigger failed for ${stack.slug}:`,
            error
          )
        }
      }

      // Step 3: Generate and push Helm manifests. With the image-ready webhook
      // in place, the GitOps commit is owned by /jenkins-image-ready. Keep this
      // path only as a fallback for environments that have not migrated yet.
      if (eagerFallback) {
        const envVars =
          (stack.envVarsJson as Array<{
            key: string
            value: string
            type?: string
            scope?: string
          }>) ?? []

        const plainEnv: Record<string, string> = {}
        const secretEnv: Record<string, string> = {}

        for (const e of envVars) {
          if (e.type === "secret") {
            secretEnv[e.key] = e.value
          } else {
            plainEnv[e.key] = e.value
          }
        }

        const registryHost = registryConfig?.host ?? "registry-apac.pfnapp.com"
        const imageRepository = registryConfig?.namespace
          ? `${registryHost}/${registryConfig.namespace}/${stack.slug}`
          : `${registryHost}/${stack.slug}`

        const builder = new AppManifestBuilder()
          .setAppName(`app-${stack.slug}`)
          .setNamespace(`app-${stack.slug}`)
          .setImage(`${imageRepository}:latest`)

        if (Object.keys(plainEnv).length > 0) {
          builder.addConfigMapData(plainEnv)
        }
        if (Object.keys(secretEnv).length > 0) {
          builder.addSecretData(secretEnv)
        }

        const manifest = builder.build()
        const manifestYaml = manifest.resources
          .map((r) =>
            jsYaml.dump(r as Record<string, unknown>, {
              indent: 2,
              lineWidth: -1,
              noRefs: true,
            })
          )
          .join("---\n")

        try {
          if (!gitopsConfig) {
            throw new Error(
              "GitOps cluster integration not configured for stack"
            )
          }
          const gitops = new GitOpsRepositoryService({
            pat: gitopsConfig.pat,
            branch: gitopsConfig.branch,
          })
          await gitops.commitFiles(gitopsConfig.repo, `Deploy ${stack.slug}`, [
            {
              path: `services-yaml/${stack.slug}/deployment.yml`,
              content: manifestYaml,
            },
          ])

          await tx.applicationDeployment.update({
            where: { id: deployment.id },
            data: {
              manifestPushed: true,
              manifestPushedAt: new Date(),
            },
          })
          await recordDeployEventOnce(
            {
              deploymentId: deployment.id,
              type: "MANIFEST_PUSHED",
              message: `Manifests pushed for ${stack.name}`,
            },
            tx
          )
          await recordDeployLog(
            {
              deploymentId: deployment.id,
              scope: "deploy",
              status: "MANIFEST_PUSHED",
              message: "Helm manifests pushed to GitOps repo.",
            },
            tx
          )
        } catch (err) {
          console.error(
            `[deploy-builder] Manifest push failed for ${stack.slug}:`,
            err
          )
          // Non-fatal; manifest push may fail if GitOps repo isn't configured
          await recordDeployLog(
            {
              deploymentId: deployment.id,
              scope: "deploy",
              status: "MANIFEST_PUSH_FAILED",
              message: `Failed to push manifests: ${err instanceof Error ? err.message : "Unknown error"}`,
            },
            tx
          )
        }

        // Step 4: Mark as ARGOCD_SYNCED (ArgoCD auto-syncs from GitOps repo)
        await recordDeployEventOnce(
          {
            deploymentId: deployment.id,
            type: "ARGOCD_SYNC_STARTED",
            message: `ArgoCD sync started for ${stack.name}`,
          },
          tx
        )
        await recordDeployLog(
          {
            deploymentId: deployment.id,
            scope: "argocd",
            status: "ARGOCD_SYNC_STARTED",
            message: "Waiting for ArgoCD to sync manifests.",
          },
          tx
        )

        // Mark as synced (ArgoCD auto-syncs; polling would happen in a future iteration)
        await tx.applicationDeployment.update({
          where: { id: deployment.id },
          data: {
            argocdSynced: true,
            argocdSyncedAt: new Date(),
          },
        })
        await recordDeployEventOnce(
          {
            deploymentId: deployment.id,
            type: "ARGOCD_SYNCED",
            message: `ArgoCD synced for ${stack.name}`,
          },
          tx
        )

        // Step 5: Mark as RUNNING (only in eager fallback mode)
        await tx.applicationDeployment.update({
          where: { id: deployment.id },
          data: {
            status: "RUNNING",
            completedAt: new Date(),
          },
        })
        await tx.applicationStack.update({
          where: { id: stack.id },
          data: {
            status: "RUNNING",
            lastDeployStatus: "RUNNING",
            lastDeployedAt: new Date(),
          },
        })
        await recordDeployEventOnce(
          {
            deploymentId: deployment.id,
            type: "DEPLOY_COMPLETED",
            message: `Deployment completed for ${stack.name}`,
          },
          tx
        )
        await recordDeployLog(
          {
            deploymentId: deployment.id,
            scope: "deploy",
            status: "RUNNING",
            message: "Application is running.",
          },
          tx
        )
      } else {
        await recordDeployEventOnce(
          {
            deploymentId: deployment.id,
            type: "ARGOCD_SYNC_STARTED",
            message: `Waiting for Jenkins image-ready webhook for ${stack.name}`,
          },
          tx
        )
        await recordDeployLog(
          {
            deploymentId: deployment.id,
            scope: "deploy",
            status: "AWAITING_IMAGE",
            message:
              "Jenkins job triggered. Waiting for image-ready webhook to commit Helm values.",
          },
          tx
        )
      }
    })

    return { processed: true, status: eagerFallback ? "RUNNING" : "BUILDING" }
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
    await recordDeployEventOnce({
      deploymentId: deployment.id,
      type: "DEPLOY_FAILED",
      message: `Deployment failed: ${reason}`,
    })
    await recordDeployLog({
      deploymentId: deployment.id,
      scope: "build",
      status: "FAILED",
      message: reason,
    })

    return { processed: true, status: "FAILED", error: reason }
  }
}
