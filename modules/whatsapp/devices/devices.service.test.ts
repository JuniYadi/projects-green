import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import { decryptWhatsAppToken } from "@/lib/whatsapp/crypto"
import { createDeviceService } from "./devices.service"

const TEST_APP_KEY = Buffer.alloc(32, 7).toString("base64")

function device(overrides: Record<string, unknown> = {}) {
  return {
    id: "dev_1",
    organizationId: "org_1",
    phoneNumber: "+6281234567890",
    status: "ACTIVE",
    balance: 0,
    quotaBase: 1000,
    quotaBaseOut: 0,
    dailyLimitMessage: 0,
    whatsappBusinessAccountId: "waba-1",
    whatsappPhoneId: "phone-1",
    callbackUrl: null,
    expiredAt: null,
    whatsappProfile: null,
    features: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  }
}

describe("devices service token storage", () => {
  const originalAppKey = process.env.APP_KEY
  const create = mock(async (args: { data: Record<string, unknown> }) =>
    device(args.data)
  )
  const findUnique = mock(async () => device())
  const update = mock(async (args: { data: Record<string, unknown> }) =>
    device(args.data)
  )
  const transaction = mock(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      whatsappDevice: {
        findUnique,
        update,
      },
    })
  )

  beforeEach(() => {
    process.env.APP_KEY = TEST_APP_KEY
    create.mockClear()
    findUnique.mockClear()
    update.mockClear()
    transaction.mockClear()
  })

  afterEach(() => {
    if (originalAppKey === undefined) {
      delete process.env.APP_KEY
    } else {
      process.env.APP_KEY = originalAppKey
    }
  })

  it("encrypts token on create and clears raw token storage", async () => {
    const service = createDeviceService({
      prisma: {
        whatsappDevice: { create },
        $transaction: transaction,
      } as never,
    })

    await service.create({
      organizationId: "org_1",
      name: "Primary",
      phoneNumber: "+6281234567890",
      environment: "LIVE",
      token: "meta-token",
      whatsappBusinessAccountId: "waba-1",
      whatsappPhoneId: "phone-1",
    })

    const data = create.mock.calls[0][0].data
    expect(data.token).toBeNull()
    expect(data.tokenIv).toBeNull()
    expect(typeof data.tokenEncrypted).toBe("string")
    expect(data.tokenEncrypted).not.toBe("meta-token")
    await expect(
      decryptWhatsAppToken(data.tokenEncrypted as string)
    ).resolves.toBe("meta-token")
  })

  it("encrypts token on update and clears raw token storage", async () => {
    const service = createDeviceService({
      prisma: {
        whatsappDevice: { create, findUnique, update },
        $transaction: transaction,
      } as never,
    })

    await service.update("dev_1", { token: "updated-token" }, null)

    const data = update.mock.calls[0][0].data
    expect(data.token).toBeNull()
    expect(data.tokenIv).toBeNull()
    expect(typeof data.tokenEncrypted).toBe("string")
    await expect(
      decryptWhatsAppToken(data.tokenEncrypted as string)
    ).resolves.toBe("updated-token")
  })

  it("updates full admin-managed device configuration", async () => {
    const service = createDeviceService({
      prisma: {
        whatsappDevice: { create, findUnique, update },
        $transaction: transaction,
      } as never,
    })

    await service.update(
      "dev_1",
      {
        phoneNumber: "+6282222222222",
        status: "NON_ACTIVE",
        whatsappBusinessAccountId: "waba-2",
        whatsappPhoneId: "phone-2",
        whatsappApplicationId: "app-2",
        whatsappVersion: "v24.0",
        quotaBase: 2500,
        quotaBaseOut: 200,
        dailyLimitMessage: 300,
        balance: 400,
        expiredAt: "2026-12-31T00:00:00.000Z",
        rates: "standard",
        s3: "whatsapp/devices/dev_1",
        callbackUrl: "https://example.com/webhook",
        displayName: "Primary WA",
        whatsappProfile: { about: "Support" },
        features: { templateSync: true },
      },
      null
    )

    const data = update.mock.calls[0][0].data
    expect(data).toMatchObject({
      phoneNumber: "+6282222222222",
      status: "NON_ACTIVE",
      whatsappBusinessAccountId: "waba-2",
      whatsappPhoneId: "phone-2",
      whatsappApplicationId: "app-2",
      whatsappVersion: "v24.0",
      quotaBase: 2500,
      quotaBaseOut: 200,
      dailyLimitMessage: 300,
      balance: 400,
      rates: "standard",
      s3Path: "whatsapp/devices/dev_1",
      callbackUrl: "https://example.com/webhook",
      features: { templateSync: true },
      whatsappProfile: { about: "Support", name: "Primary WA" },
    })
    expect(data.expiredAt).toEqual(new Date("2026-12-31T00:00:00.000Z"))
  })
})
