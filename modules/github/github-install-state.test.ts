import { describe, expect, it } from "bun:test"

import {
  GithubInstallStateError,
  issueGithubInstallState,
  validateGithubInstallState,
} from "@/modules/github/github-install-state"

type NonceRecord = {
  nonceHash: string
  workosUserId: string
  organizationId: string | null
  expiresAt: Date
  consumedAt: Date | null
}

const createNonceStore = () => {
  const records = new Map<string, NonceRecord>()

  return {
    create: async ({ data }: { data: Omit<NonceRecord, "consumedAt"> }) => {
      records.set(data.nonceHash, {
        ...data,
        consumedAt: null,
      })
    },
    findUnique: async ({ where }: { where: { nonceHash: string } }) => {
      return records.get(where.nonceHash) ?? null
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: {
        nonceHash: string
        consumedAt: null
      }
      data: {
        consumedAt: Date
      }
    }) => {
      const record = records.get(where.nonceHash)

      if (!record || record.consumedAt !== null) {
        return { count: 0 }
      }

      record.consumedAt = data.consumedAt
      records.set(where.nonceHash, record)

      return { count: 1 }
    },
  }
}

describe("github install state", () => {
  it("issues and validates one-time state", async () => {
    const nonceStore = createNonceStore()

    const issued = await issueGithubInstallState({
      workosUserId: "user_123",
      organizationId: "org_123",
      returnTo: "/console/app/deploy",
      secret: "state-secret",
      nonceStore,
      now: new Date("2026-05-16T00:00:00.000Z"),
    })

    const payload = await validateGithubInstallState({
      state: issued.state,
      secret: "state-secret",
      nonceStore,
      now: new Date("2026-05-16T00:05:00.000Z"),
    })

    expect(payload.workosUserId).toBe("user_123")
    expect(payload.organizationId).toBe("org_123")
    expect(payload.returnTo).toBe("/console/app/deploy")
    expect(typeof payload.nonce).toBe("string")
    expect(payload.nonce.length).toBeGreaterThan(8)
  })

  it("rejects reused state nonce", async () => {
    const nonceStore = createNonceStore()

    const issued = await issueGithubInstallState({
      workosUserId: "user_123",
      organizationId: null,
      returnTo: "/console",
      secret: "state-secret",
      nonceStore,
      now: new Date("2026-05-16T00:00:00.000Z"),
    })

    await validateGithubInstallState({
      state: issued.state,
      secret: "state-secret",
      nonceStore,
      now: new Date("2026-05-16T00:01:00.000Z"),
    })

    await expect(
      validateGithubInstallState({
        state: issued.state,
        secret: "state-secret",
        nonceStore,
        now: new Date("2026-05-16T00:02:00.000Z"),
      })
    ).rejects.toMatchObject({
      code: "NONCE_ALREADY_USED",
      name: "GithubInstallStateError",
    } satisfies Partial<GithubInstallStateError>)
  })

  it("rejects expired state", async () => {
    const nonceStore = createNonceStore()

    const issued = await issueGithubInstallState({
      workosUserId: "user_123",
      organizationId: null,
      returnTo: "/console",
      secret: "state-secret",
      nonceStore,
      now: new Date("2026-05-16T00:00:00.000Z"),
    })

    await expect(
      validateGithubInstallState({
        state: issued.state,
        secret: "state-secret",
        nonceStore,
        now: new Date("2026-05-16T00:11:00.000Z"),
      })
    ).rejects.toMatchObject({
      code: "EXPIRED_STATE",
      name: "GithubInstallStateError",
    } satisfies Partial<GithubInstallStateError>)
  })

  it("rejects tampered signature", async () => {
    const nonceStore = createNonceStore()
    const issued = await issueGithubInstallState({
      workosUserId: "user_123",
      organizationId: null,
      returnTo: "/console",
      secret: "state-secret",
      nonceStore,
      now: new Date("2026-05-16T00:00:00.000Z"),
    })

    const [payloadSegment, signatureSegment] = issued.state.split(".")
    const tamperedState = `${payloadSegment}.${signatureSegment}x`

    await expect(
      validateGithubInstallState({
        state: tamperedState,
        secret: "state-secret",
        nonceStore,
        now: new Date("2026-05-16T00:01:00.000Z"),
      })
    ).rejects.toMatchObject({
      code: "INVALID_SIGNATURE",
      name: "GithubInstallStateError",
    } satisfies Partial<GithubInstallStateError>)
  })

  it("rejects nonce context mismatch", async () => {
    let storedNonceHash = ""
    const nonceStore = {
      async create({
        data,
      }: {
        data: {
          nonceHash: string
          workosUserId: string
          organizationId: string | null
          expiresAt: Date
        }
      }) {
        storedNonceHash = data.nonceHash
      },
      async findUnique({
        where,
      }: {
        where: { nonceHash: string }
        select: {
          nonceHash: true
          workosUserId: true
          organizationId: true
          expiresAt: true
          consumedAt: true
        }
      }) {
        if (where.nonceHash !== storedNonceHash) {
          return null
        }

        return {
          nonceHash: where.nonceHash,
          workosUserId: "user_other",
          organizationId: "org_other",
          expiresAt: new Date("2026-05-16T00:10:00.000Z"),
          consumedAt: null,
        }
      },
      async updateMany({
        where,
      }: {
        where: {
          nonceHash: string
          consumedAt: null
        }
        data: {
          consumedAt: Date
        }
      }) {
        if (where.nonceHash !== storedNonceHash) {
          return { count: 0 }
        }

        return { count: 1 }
      },
    }

    const issued = await issueGithubInstallState({
      workosUserId: "user_123",
      organizationId: "org_123",
      returnTo: "/console",
      secret: "state-secret",
      nonceStore,
      now: new Date("2026-05-16T00:00:00.000Z"),
    })

    await expect(
      validateGithubInstallState({
        state: issued.state,
        secret: "state-secret",
        nonceStore,
        now: new Date("2026-05-16T00:01:00.000Z"),
      })
    ).rejects.toMatchObject({
      code: "INVALID_NONCE",
      name: "GithubInstallStateError",
    } satisfies Partial<GithubInstallStateError>)
  })
})
