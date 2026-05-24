import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { enqueueGithubWebhookEvent } from "@/lib/queue/github-events"
import {
  createGithubService,
  GithubIntegrationDisabledError,
} from "@/modules/github/github.service"
import { createGithubWebhookHandler } from "@/modules/github/github.webhook"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const githubService = createGithubService()

const handler = createGithubWebhookHandler({
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
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
        },
        select: { id: true },
      })
    },
    async markEnqueueFailed(eventId, processError) {
      await prisma.githubWebhookEvent.update({
        where: { id: eventId },
        data: {
          enqueueStatus: "failed",
          processError,
        },
      })
    },
  },
  queue: {
    async enqueueEventId(eventId) {
      await enqueueGithubWebhookEvent(eventId)
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
