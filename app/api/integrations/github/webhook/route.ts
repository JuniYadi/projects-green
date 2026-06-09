import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { GithubEventJob } from "@/modules/github/jobs/github-event.job"
import {
  createGithubService,
  GithubIntegrationDisabledError,
} from "@/modules/github/github.service"
import { createGithubWebhookHandler } from "@/modules/github/github.webhook"
import { normalizeGithubWebhookPayload } from "@/modules/github/github-event-normalizer"
import { classifyGithubWebhookEvent } from "@/modules/github/github-event-classifier"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const githubService = createGithubService()

const handler = createGithubWebhookHandler({
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
  normalizePayload: normalizeGithubWebhookPayload,
  classifyEvent(input) {
    return classifyGithubWebhookEvent({
      ...input,
      store: {
        findInstallationByGithubId(githubInstallationId) {
          return prisma.githubInstallation.findUnique({
            where: { githubInstallationId },
            select: { id: true },
          })
        },
        findRepositoryConnection({ installationId, githubRepositoryId }) {
          return prisma.githubRepositoryConnection.findUnique({
            where: {
              githubRepositoryId_installationId: {
                githubRepositoryId,
                installationId,
              },
            },
            select: { id: true, branchFilters: true },
          })
        },
        findApplicationStack(repositoryConnectionId) {
          return prisma.applicationStack.findFirst({
            where: { repositoryConnectionId },
            select: { id: true },
          })
        },
      },
    })
  },
  store: {
    async findByDeliveryId(deliveryId) {
      return prisma.githubWebhookEvent.findUnique({
        where: { deliveryId },
        select: { id: true },
      })
    },
    async create(input) {
      return prisma.githubWebhookEvent.create({
        data: {
          deliveryId: input.deliveryId,
          eventName: input.eventName,
          action: input.action,
          githubInstallationId: input.githubInstallationId,
          githubRepositoryId: input.githubRepositoryId,
          payloadJson: input.payloadJson as Prisma.InputJsonValue,
          payloadSha256: input.payloadSha256,
          signatureValid: true,
          enqueueStatus: "queued",
          repositoryFullName: input.repositoryFullName,
          repositoryOwner: input.repositoryOwner,
          repositoryName: input.repositoryName,
          ref: input.ref,
          branch: input.branch,
          commitSha: input.commitSha,
          commitMessage: input.commitMessage,
          commitAuthorName: input.commitAuthorName,
          commitAuthorEmail: input.commitAuthorEmail,
          commitUrl: input.commitUrl,
          senderLogin: input.senderLogin,
          senderAvatarUrl: input.senderAvatarUrl,
          repositoryConnectionId: input.repositoryConnectionId,
          applicationStackId: input.applicationStackId,
          eventDisposition: input.eventDisposition,
          ignoreReason: input.ignoreReason,
          responseStatus: input.responseStatus,
          handlerDurationMs: input.handlerDurationMs,
        },
        select: { id: true },
      })
    },
    async markEnqueueFailed(eventId, processError) {
      await prisma.githubWebhookEvent.update({
        where: { id: eventId },
        data: {
          enqueueStatus: "failed",
          eventDisposition: "error",
          processError,
        },
      })
    },
  },
  queue: {
    async enqueueEventId(eventId) {
      await GithubEventJob.dispatch(eventId)
    },
  },
})

export const POST = async (request: Request) => {
  try {
    githubService.assertEnabled()
  } catch (error) {
    if (error instanceof GithubIntegrationDisabledError) {
      return Response.json(
        {
          ok: false as const,
          error: "FEATURE_DISABLED" as const,
          message: "GitHub App integration is disabled.",
        },
        { status: 404 }
      )
    }

    throw error
  }

  return handler(request)
}
