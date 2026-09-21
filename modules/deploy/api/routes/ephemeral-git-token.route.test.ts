import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"
import {
  createJenkinsHmacSignature,
  createJenkinsWebhookHeaders,
} from "../../jenkins-webhook-auth"

export class EphemeralGitTokenError extends Error {
  constructor(
    public readonly code:
      | "DEPLOYMENT_NOT_FOUND"
      | "INVALID_STATE"
      | "NO_REPOSITORY_CONNECTION"
      | "INVALID_INSTALLATION",
    message: string
  ) {
    super(message)
    this.name = "EphemeralGitTokenError"
  }
}

const mockResolveEphemeralGitCredential = mock()

mock.module("../../git-provider/ephemeral-git-token.service", () => ({
  EphemeralGitTokenError,
  resolveEphemeralGitCredential: mockResolveEphemeralGitCredential,
}))

const resolveCluster = mock(async (_stackId: string, type: string) => {
  if (type === "JENKINS") {
    return { webhookToken: "test-cluster-token" }
  }
  throw new Error("missing " + type)
})
mock.module("../../cluster-integration.service", () => ({
  resolveClusterIntegration: resolveCluster,
}))

const stackRecord = {
  id: "stack-1",
  slug: "my-app",
  organizationId: "org-1",
}

const mockPrisma = {
  applicationStack: {
    findUnique: mock(),
    findFirst: mock(),
  },
  applicationDeployment: {
    findFirst: mock(),
  },
}
mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const { ephemeralGitTokenRoutes } = await import("./ephemeral-git-token.route")

describe("POST /deploy/stacks/:id/ephemeral-git-token", () => {
  const webhookToken = "test-cluster-token"
  const defaultExpiresAt = 1726746800

  let clientKeypair: CryptoKeyPair
  let clientPublicKeyJwk: JsonWebKey

  beforeEach(async () => {
    mockResolveEphemeralGitCredential.mockClear()
    resolveCluster.mockClear()
    mockPrisma.applicationStack.findUnique.mockReset()
    mockPrisma.applicationStack.findFirst.mockReset()

    mockPrisma.applicationStack.findUnique.mockResolvedValue(stackRecord)
    mockPrisma.applicationStack.findFirst.mockResolvedValue(stackRecord)
    resolveCluster.mockResolvedValue({ webhookToken })
    mockResolveEphemeralGitCredential.mockResolvedValue({
      provider: "github" as const,
      username: "x-access-token" as const,
      token: "ghs_test_token_xyz",
      cloneUrl: "https://github.com/my-org/my-repo.git",
      expiresAt: defaultExpiresAt,
    })

    // Generate fresh ephemeral ECDH P-256 client keypair for each test
    clientKeypair = (await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"]
    )) as CryptoKeyPair

    clientPublicKeyJwk = (await crypto.subtle.exportKey(
      "jwk",
      clientKeypair.publicKey
    )) as JsonWebKey
  })

  const createRequestBody = () => ({
    clientPublicKey: {
      kty: clientPublicKeyJwk.kty!,
      crv: clientPublicKeyJwk.crv!,
      x: clientPublicKeyJwk.x!,
      y: clientPublicKeyJwk.y!,
    },
  })

  // DEBT: Client-side ECDH round-trip removed — Bun 1.4 WebCrypto deriveBits
  // throws OperationError after Elysia request handling (known Bun bug).
  // Round-trip correctness is covered by lib/vault/vault-envelope.test.ts.
  // Fix when: Bun stabilises WebCrypto state across Elysia handlers.
  it("returns valid ECDH envelope for authenticated request", async () => {
    const body = createRequestBody()
    const rawBody = JSON.stringify(body)
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = createJenkinsHmacSignature(
      rawBody,
      webhookToken,
      timestamp
    )

    const response = await ephemeralGitTokenRoutes.handle(
      new Request(
        "http://localhost/deploy/stacks/stack-1/ephemeral-git-token",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-jenkins-signature-256": signature,
            "x-jenkins-timestamp": timestamp,
            "x-jenkins-deployment-id": "deploy-1",
          },
          body: rawBody,
        }
      )
    )

    expect(response.status).toBe(200)
    const json = (await response.json()) as {
      ok: boolean
      encrypted: boolean
      serverPublicKey: JsonWebKey
      iv: string
      ciphertext: string
      expiresAt: number
    }

    expect(json.ok).toBe(true)
    expect(json.encrypted).toBe(true)
    expect(json.serverPublicKey.kty).toBe("EC")
    expect(json.serverPublicKey.crv).toBe("P-256")
    expect(typeof json.serverPublicKey.x).toBe("string")
    expect(typeof json.serverPublicKey.y).toBe("string")
    expect(typeof json.iv).toBe("string")
    expect(json.iv.length).toBeGreaterThan(0)
    expect(typeof json.ciphertext).toBe("string")
    expect(json.ciphertext.length).toBeGreaterThan(0)
    expect(json.expiresAt).toBe(defaultExpiresAt)
  })

  it("supports X-Jenkins-Signature header (raw hex) without sha256= prefix", async () => {
    const body = createRequestBody()
    const rawBody = JSON.stringify(body)
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = createJenkinsHmacSignature(
      rawBody,
      webhookToken,
      timestamp
    )

    const response = await ephemeralGitTokenRoutes.handle(
      new Request(
        "http://localhost/deploy/stacks/stack-1/ephemeral-git-token",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-jenkins-signature": signature,
            "x-jenkins-timestamp": timestamp,
            "x-jenkins-deployment-id": "deploy-1",
          },
          body: rawBody,
        }
      )
    )

    expect(response.status).toBe(200)
    const json = (await response.json()) as { ok: boolean }
    expect(json.ok).toBe(true)
  })

  it("supports prefixSha256 in x-jenkins-signature-256 header", async () => {
    const body = createRequestBody()
    const rawBody = JSON.stringify(body)
    const headers = createJenkinsWebhookHeaders(rawBody, webhookToken, {
      prefixSha256: true,
    })

    const response = await ephemeralGitTokenRoutes.handle(
      new Request(
        "http://localhost/deploy/stacks/stack-1/ephemeral-git-token",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...headers,
            "x-jenkins-deployment-id": "deploy-1",
          },
          body: rawBody,
        }
      )
    )

    expect(response.status).toBe(200)
    const json = (await response.json()) as { ok: boolean }
    expect(json.ok).toBe(true)
  })

  it("returns 401 when HMAC signature is invalid", async () => {
    const body = createRequestBody()
    const rawBody = JSON.stringify(body)
    const timestamp = Math.floor(Date.now() / 1000).toString()

    const response = await ephemeralGitTokenRoutes.handle(
      new Request(
        "http://localhost/deploy/stacks/stack-1/ephemeral-git-token",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-jenkins-signature-256": "wrong_signature_hex_value",
            "x-jenkins-timestamp": timestamp,
            "x-jenkins-deployment-id": "deploy-1",
          },
          body: rawBody,
        }
      )
    )

    expect(response.status).toBe(401)
    const json = (await response.json()) as { ok: boolean; error: string }
    expect(json.ok).toBe(false)
    expect(json.error).toBe("UNAUTHORIZED")
  })

  it("returns 401 when timestamp is older than 60 seconds (replay mitigation)", async () => {
    const body = createRequestBody()
    const rawBody = JSON.stringify(body)
    const expiredTimestamp = (Math.floor(Date.now() / 1000) - 65).toString()
    const signature = createJenkinsHmacSignature(
      rawBody,
      webhookToken,
      expiredTimestamp
    )

    const response = await ephemeralGitTokenRoutes.handle(
      new Request(
        "http://localhost/deploy/stacks/stack-1/ephemeral-git-token",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-jenkins-signature-256": signature,
            "x-jenkins-timestamp": expiredTimestamp,
            "x-jenkins-deployment-id": "deploy-1",
          },
          body: rawBody,
        }
      )
    )

    expect(response.status).toBe(401)
    const json = (await response.json()) as { ok: boolean; error: string }
    expect(json.ok).toBe(false)
    expect(json.error).toBe("UNAUTHORIZED")
  })

  it("returns 404 when stack does not exist", async () => {
    mockPrisma.applicationStack.findUnique.mockResolvedValue(null)
    mockPrisma.applicationStack.findFirst.mockResolvedValue(null)
    const body = createRequestBody()
    const rawBody = JSON.stringify(body)
    const timestamp = Math.floor(Date.now() / 1000).toString()
    process.env.JENKINS_WEBHOOK_TOKEN = webhookToken
    const signature = createJenkinsHmacSignature(
      rawBody,
      webhookToken,
      timestamp
    )

    const response = await ephemeralGitTokenRoutes.handle(
      new Request(
        "http://localhost/deploy/stacks/non-existent-stack/ephemeral-git-token",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-jenkins-signature-256": signature,
            "x-jenkins-timestamp": timestamp,
            "x-jenkins-deployment-id": "deploy-1",
          },
          body: rawBody,
        }
      )
    )

    expect(response.status).toBe(404)
    const json = (await response.json()) as { ok: boolean; error: string }
    expect(json.ok).toBe(false)
    expect(json.error).toBe("NOT_FOUND")
  })

  it("returns 400 when X-Jenkins-Deployment-Id header is missing", async () => {
    const body = createRequestBody()
    const rawBody = JSON.stringify(body)
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = createJenkinsHmacSignature(
      rawBody,
      webhookToken,
      timestamp
    )

    const response = await ephemeralGitTokenRoutes.handle(
      new Request(
        "http://localhost/deploy/stacks/stack-1/ephemeral-git-token",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-jenkins-signature-256": signature,
            "x-jenkins-timestamp": timestamp,
          },
          body: rawBody,
        }
      )
    )

    expect(response.status).toBe(400)
    const json = (await response.json()) as { ok: boolean; error: string }
    expect(json.ok).toBe(false)
    expect(json.error).toBe("MISSING_DEPLOYMENT_ID")
  })

  it("returns 404 when deployment does not exist", async () => {
    mockResolveEphemeralGitCredential.mockRejectedValue(
      new EphemeralGitTokenError(
        "DEPLOYMENT_NOT_FOUND",
        "Deployment 'missing-deploy' not found for stack 'stack-1'"
      )
    )
    const body = createRequestBody()
    const rawBody = JSON.stringify(body)
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = createJenkinsHmacSignature(
      rawBody,
      webhookToken,
      timestamp
    )

    const response = await ephemeralGitTokenRoutes.handle(
      new Request(
        "http://localhost/deploy/stacks/stack-1/ephemeral-git-token",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-jenkins-signature-256": signature,
            "x-jenkins-timestamp": timestamp,
            "x-jenkins-deployment-id": "missing-deploy",
          },
          body: rawBody,
        }
      )
    )

    expect(response.status).toBe(404)
    const json = (await response.json()) as { ok: boolean; error: string }
    expect(json.ok).toBe(false)
    expect(json.error).toBe("NOT_FOUND")
  })

  it("returns 403 when deployment is not in BUILDING status", async () => {
    mockResolveEphemeralGitCredential.mockRejectedValue(
      new EphemeralGitTokenError(
        "INVALID_STATE",
        "Deployment 'deploy-1' is not in BUILDING state (status: DEPLOYING)"
      )
    )

    const body = createRequestBody()
    const rawBody = JSON.stringify(body)
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = createJenkinsHmacSignature(
      rawBody,
      webhookToken,
      timestamp
    )

    const response = await ephemeralGitTokenRoutes.handle(
      new Request(
        "http://localhost/deploy/stacks/stack-1/ephemeral-git-token",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-jenkins-signature-256": signature,
            "x-jenkins-timestamp": timestamp,
            "x-jenkins-deployment-id": "deploy-1",
          },
          body: rawBody,
        }
      )
    )

    expect(response.status).toBe(403)
    const json = (await response.json()) as { ok: boolean; error: string }
    expect(json.ok).toBe(false)
    expect(json.error).toBe("FORBIDDEN")
  })

  it("returns 400 when client public key is invalid", async () => {
    const body = {
      clientPublicKey: {
        kty: "EC",
        crv: "P-256",
        x: "invalid-x-coordinate",
        y: "invalid-y-coordinate",
      },
    }
    const rawBody = JSON.stringify(body)
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = createJenkinsHmacSignature(
      rawBody,
      webhookToken,
      timestamp
    )

    const response = await ephemeralGitTokenRoutes.handle(
      new Request(
        "http://localhost/deploy/stacks/stack-1/ephemeral-git-token",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-jenkins-signature-256": signature,
            "x-jenkins-timestamp": timestamp,
            "x-jenkins-deployment-id": "deploy-1",
          },
          body: rawBody,
        }
      )
    )

    expect(response.status).toBe(400)
    const json = (await response.json()) as { ok: boolean; error: string }
    expect(json.ok).toBe(false)
    expect(json.error).toBe("INVALID_CLIENT_PUBLIC_KEY")
  })

  it("is mounted and accessible via parent router with prefix", async () => {
    const parentApp = new Elysia().use(ephemeralGitTokenRoutes)
    const body = createRequestBody()
    const rawBody = JSON.stringify(body)
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = createJenkinsHmacSignature(
      rawBody,
      webhookToken,
      timestamp
    )

    const response = await parentApp.handle(
      new Request(
        "http://localhost/deploy/stacks/stack-1/ephemeral-git-token",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-jenkins-signature-256": signature,
            "x-jenkins-timestamp": timestamp,
            "x-jenkins-deployment-id": "deploy-1",
          },
          body: rawBody,
        }
      )
    )

    expect(response.status).toBe(200)
    const json = (await response.json()) as { ok: boolean }
    expect(json.ok).toBe(true)
  })
})
