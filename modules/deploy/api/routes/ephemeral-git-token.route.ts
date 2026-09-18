import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { encryptEnvelope } from "@/lib/vault/vault-envelope"
import { resolveClusterIntegration } from "../../cluster-integration.service"
import { verifyJenkinsHmacSignature } from "../../jenkins-webhook-auth"
import {
  EphemeralGitTokenError,
  resolveEphemeralGitCredential,
} from "../../git-provider/ephemeral-git-token.service"

/**
 * POST /api/deploy/stacks/:id/ephemeral-git-token
 *
 * Exclusively provides ephemeral Git credentials to Jenkins build runners.
 * Authenticated via HMAC-SHA256 machine signature against the cluster webhook token.
 * Payload is sealed via zero-knowledge ephemeral ECDH P-256 envelope encryption.
 */
export const ephemeralGitTokenRoutes = new Elysia({
  prefix: "/deploy",
}).post(
  "/stacks/:id/ephemeral-git-token",
  async ({ params, body, headers, request, set }) => {
    const envToken = process.env.JENKINS_WEBHOOK_TOKEN

    const stack = await prisma.applicationStack.findUnique({
      where: { id: params.id },
    })

    let expectedToken: string | null = envToken ?? null
    if (stack) {
      try {
        const jenkinsConfig = await resolveClusterIntegration(
          stack.id,
          "JENKINS"
        )
        expectedToken = jenkinsConfig.webhookToken
      } catch {
        expectedToken = envToken ?? null
      }
    }

    if (!expectedToken) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED" }
    }

    let rawBody = ""
    try {
      rawBody = await request.clone().text()
    } catch {
      rawBody = ""
    }
    if (!rawBody) {
      rawBody = JSON.stringify(body)
    }

    const isValid = verifyJenkinsHmacSignature(
      rawBody,
      request.headers,
      expectedToken
    )

    if (!isValid) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED" }
    }

    if (!stack) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Stack not found" }
    }

    const deploymentId =
      request.headers.get("x-jenkins-deployment-id") ??
      (headers
        ? (headers as Record<string, string | undefined>)[
            "x-jenkins-deployment-id"
          ]
        : undefined)

    if (!deploymentId) {
      set.status = 400
      return {
        ok: false,
        error: "MISSING_DEPLOYMENT_ID",
        message: "X-Jenkins-Deployment-Id header is required",
      }
    }

    try {
      const credentialPayload = await resolveEphemeralGitCredential(
        stack.id,
        deploymentId
      )

      let envelope
      try {
        envelope = await encryptEnvelope(
          JSON.stringify(credentialPayload),
          body.clientPublicKey as JsonWebKey
        )
      } catch (error) {
        set.status = 400
        return {
          ok: false,
          error: "INVALID_CLIENT_PUBLIC_KEY",
          message:
            error instanceof Error
              ? error.message
              : "Failed to encrypt with client public key",
        }
      }

      return {
        ok: true as const,
        encrypted: true as const,
        serverPublicKey: envelope.serverPublicKey,
        iv: envelope.iv,
        ciphertext: envelope.ciphertext,
        expiresAt: credentialPayload.expiresAt,
      }
    } catch (error) {
      if (error instanceof EphemeralGitTokenError) {
        if (error.code === "DEPLOYMENT_NOT_FOUND") {
          set.status = 404
          return { ok: false, error: "NOT_FOUND", message: error.message }
        }
        if (error.code === "INVALID_STATE") {
          set.status = 403
          return { ok: false, error: "FORBIDDEN", message: error.message }
        }
        set.status = 400
        return { ok: false, error: error.code, message: error.message }
      }
      throw error
    }
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    body: t.Object({
      clientPublicKey: t.Object(
        {
          kty: t.String(),
          crv: t.String(),
          x: t.String(),
          y: t.String(),
        },
        { additionalProperties: true }
      ),
    }),
  }
)
