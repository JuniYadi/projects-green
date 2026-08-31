import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test"

const findFirstMock = mock(async (_args?: unknown) => null as unknown)
const findUniqueMock = mock(async (_args?: unknown) => null as unknown)
const findManyMock = mock(async (_args?: unknown) => [] as unknown[])

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappDevice: {
      findFirst: findFirstMock,
      findUnique: findUniqueMock,
      findMany: findManyMock,
    },
    authPlatformUserRole: {
      findMany: mock(async () => []),
    },
  },
}))

const pipelineIncrMock = mock((_key: string) => undefined)
const pipelineExpireMock = mock((_key: string, _ttl: number) => undefined)
const pipelineExecMock = mock(async () => [[null, 1]] as unknown[])
const redisMultiMock = mock(() => ({
  incr: pipelineIncrMock,
  expire: pipelineExpireMock,
  exec: pipelineExecMock,
}))
const redisDelMock = mock(async (_key: string) => 1)
const redisGetMock = mock(async (_key: string) => null as string | null)
const redisSetMock = mock(async () => "OK")

mock.module("@/lib/redis", () => ({
  redis: {
    multi: redisMultiMock,
    del: redisDelMock,
    get: redisGetMock,
    set: redisSetMock,
  },
}))

const updateLastHeartbeatMock = mock(async (_deviceId: string) => undefined)
const markActiveMock = mock(async (_deviceId: string) => undefined)
const markDisconnectedMock = mock(async (_deviceId: string) => undefined)

mock.module("@/modules/whatsapp/devices/devices.service", () => ({
  devicesService: {
    updateLastHeartbeat: updateLastHeartbeatMock,
    markActive: markActiveMock,
    markDisconnected: markDisconnectedMock,
  },
}))

const syncDeviceFromMetaMock = mock(
  async (_deviceId: string, _organizationId: string) => ({})
)
const recordMetaRefreshUnavailableMock = mock(
  async (_deviceId: string, _organizationId: string) => undefined
)

mock.module("@/modules/whatsapp/devices/business-profile.service", () => ({
  syncDeviceFromMeta: syncDeviceFromMetaMock,
  recordMetaRefreshUnavailable: recordMetaRefreshUnavailableMock,
}))
const trackAndNotifyDeviceStateChangeMock = mock(async () => ({
  changed: false,
  diffs: [],
}))
const sendDailyDeviceDigestMock = mock(async () => undefined)

mock.module("@/modules/whatsapp/devices/device-state-tracker", () => ({
  trackAndNotifyDeviceStateChange: trackAndNotifyDeviceStateChangeMock,
  sendDailyDeviceDigest: sendDailyDeviceDigestMock,
  deviceStateKey: (id: string) => `whatsapp:device:state:${id}`,
}))
const sendEmailMock = mock(async (_args: unknown) => undefined)

mock.module("@/lib/queue/email", () => ({
  sendEmail: sendEmailMock,
}))

const decryptWhatsAppTokenMock = mock(async (_encrypted: string) => "token")

mock.module("@/lib/whatsapp/crypto", () => ({
  decryptWhatsAppToken: decryptWhatsAppTokenMock,
}))

const metaClientConstructorMock = mock((_options: unknown) => undefined)
const metaRequestMock = mock(async (..._args: unknown[]) => undefined)

class MetaCloudHttpClientMock {
  constructor(options: unknown) {
    metaClientConstructorMock(options)
  }

  async request(...args: unknown[]) {
    return metaRequestMock(...args)
  }
}

mock.module("@/lib/whatsapp/meta-cloud/client", () => ({
  MetaCloudHttpClient: MetaCloudHttpClientMock,
}))

mock.module("@/lib/whatsapp/meta-cloud/endpoints", () => ({
  ENDPOINTS: {
    PHONE_INFO: (phoneId: string) => `/PHONE_INFO/${phoneId}`,
  },
}))

const emitCycleEnqueuedMock = mock((_count: number) => undefined)
const emitUnavailableMock = mock((_reason: string) => undefined)
const emitCheckFailedMock = mock((_count: number, _error: unknown) => undefined)
const emitMetadataRefreshFailedMock = mock((_error: unknown) => undefined)
const emitDisconnectedMock = mock(() => undefined)
const emitRecoveredMock = mock(() => undefined)
const emitEmailFailedMock = mock((_error: unknown) => undefined)
const emitNoRecipientsMock = mock(() => undefined)

mock.module("@/lib/worker-health-logging", () => ({
  emitWhatsAppHealthCycleEnqueued: emitCycleEnqueuedMock,
  emitWhatsAppHealthDeviceCheckFailed: emitCheckFailedMock,
  emitWhatsAppHealthDeviceMetadataRefreshFailed: emitMetadataRefreshFailedMock,
  emitWhatsAppHealthDeviceDisconnected: emitDisconnectedMock,
  emitWhatsAppHealthDeviceRecovered: emitRecoveredMock,
  emitWhatsAppHealthDeviceUnavailable: emitUnavailableMock,
  emitWhatsAppHealthDisconnectEmailFailed: emitEmailFailedMock,
  emitWhatsAppHealthDisconnectEmailNoRecipients: emitNoRecipientsMock,
}))

const getOrganizationMock = mock(async (_organizationId: string) => ({
  name: "Acme",
}))
const listMembershipsMock = mock(async (_args: unknown) => ({
  data: [{ userId: "user-1" }, { userId: "user-2" }],
}))
const getUserMock = mock(async (userId: string) => ({
  id: userId,
  email: `${userId}@example.com`,
}))
const createWorkOSMock = mock(() => ({
  organizations: { getOrganization: getOrganizationMock },
  userManagement: {
    listOrganizationMemberships: listMembershipsMock,
    getUser: getUserMock,
  },
}))

mock.module("@workos-inc/node", () => ({
  createWorkOS: createWorkOSMock,
}))

mock.module("@react-email/components", () => ({
  render: mock(async () => "<html />"),
}))

mock.module("@/modules/whatsapp/emails/device-disconnected", () => ({
  DeviceDisconnectedEmail: () => null,
}))

const {
  HEARTBEAT_INTERVAL_MS,
  MISS_THRESHOLD,
  WhatsAppHealthJob,
  checkDeviceHealth,
} = await import("./whatsapp-health")

type Device = {
  id: string
  organizationId: string
  status: string
  whatsappPhoneId: string | null
  whatsappBusinessAccountId: string | null
}

type HealthDevice = {
  whatsappPhoneId: string | null
  whatsappBusinessAccountId: string | null
  tokenEncrypted: string | null
  tokenIv: string | null
  whatsappVersion: string | null
}

const activeDevice = (overrides: Partial<Device> = {}): Device => ({
  id: "d1",
  organizationId: "org-1",
  status: "ACTIVE",
  whatsappPhoneId: "phone-1",
  whatsappBusinessAccountId: "business-1",
  ...overrides,
})

const healthDevice = (overrides: Partial<HealthDevice> = {}): HealthDevice => ({
  whatsappPhoneId: "phone-1",
  whatsappBusinessAccountId: "business-1",
  tokenEncrypted: "encrypted-token",
  tokenIv: "iv",
  whatsappVersion: "v21.0",
  ...overrides,
})

const resetMocks = () => {
  for (const fn of [
    findFirstMock,
    findUniqueMock,
    findManyMock,
    pipelineIncrMock,
    pipelineExpireMock,
    pipelineExecMock,
    redisMultiMock,
    redisDelMock,
    updateLastHeartbeatMock,
    markActiveMock,
    markDisconnectedMock,
    syncDeviceFromMetaMock,
    recordMetaRefreshUnavailableMock,
    sendEmailMock,
    decryptWhatsAppTokenMock,
    trackAndNotifyDeviceStateChangeMock,
    sendDailyDeviceDigestMock,
    metaRequestMock,
    emitCycleEnqueuedMock,
    emitUnavailableMock,
    emitCheckFailedMock,
    emitMetadataRefreshFailedMock,
    emitDisconnectedMock,
    emitRecoveredMock,
    emitEmailFailedMock,
    emitNoRecipientsMock,
    getOrganizationMock,
    listMembershipsMock,
    getUserMock,
    createWorkOSMock,
  ]) {
    fn.mockClear()
  }

  findFirstMock.mockResolvedValue(healthDevice())
  findUniqueMock.mockResolvedValue(null)
  findManyMock.mockResolvedValue([])
  pipelineExecMock.mockResolvedValue([[null, 1]] as unknown[])
  metaRequestMock.mockResolvedValue(undefined)
  syncDeviceFromMetaMock.mockResolvedValue({})
  recordMetaRefreshUnavailableMock.mockResolvedValue(undefined)
  sendEmailMock.mockResolvedValue(undefined)
  listMembershipsMock.mockResolvedValue({
    data: [{ userId: "user-1" }, { userId: "user-2" }],
  })
  getUserMock.mockImplementation(async (userId: string) => ({
    id: userId,
    email: `${userId}@example.com`,
  }))
}

beforeEach(() => {
  resetMocks()
})

describe("WhatsAppHealthJob configuration", () => {
  it("uses the WhatsApp health queue and worker settings", () => {
    expect(WhatsAppHealthJob.queue).toBe("whatsapp-health")
    expect(WhatsAppHealthJob.workerConcurrency).toBe(5)
    expect(WhatsAppHealthJob.attempts).toBe(2)
  })

  it("registers the five-minute repeatable cycle", async () => {
    const registerRepeatableMock = spyOn(
      WhatsAppHealthJob,
      "registerRepeatable"
    ).mockResolvedValue(undefined)

    await WhatsAppHealthJob.registerSchedule()

    expect(registerRepeatableMock).toHaveBeenCalledWith(
      { every: HEARTBEAT_INTERVAL_MS },
      { cycle: true }
    )
    registerRepeatableMock.mockRestore()
  })
})

describe("WhatsAppHealthJob.handle", () => {
  it("fans out a cycle to active devices and logs its count", async () => {
    findManyMock.mockResolvedValue([{ id: "d1" }, { id: "d2" }])
    const enqueueMock = spyOn(WhatsAppHealthJob, "enqueue").mockResolvedValue(
      undefined
    )

    await WhatsAppHealthJob.handle({ data: { deviceId: "cycle", cycle: true } })

    expect(findManyMock).toHaveBeenCalledWith({
      where: { status: "ACTIVE" },
      select: { id: true },
    })
    expect(enqueueMock).toHaveBeenNthCalledWith(1, { deviceId: "d1" })
    expect(enqueueMock).toHaveBeenNthCalledWith(2, { deviceId: "d2" })
    expect(emitCycleEnqueuedMock).toHaveBeenCalledWith(2)
    enqueueMock.mockRestore()
  })

  it("executes daily digest when dailyDigest flag is set", async () => {
    await WhatsAppHealthJob.handle({ data: { dailyDigest: true } })
    expect(sendDailyDeviceDigestMock).toHaveBeenCalled()
  })

  it("checks one device when the job is not a cycle", async () => {
    await WhatsAppHealthJob.handle({
      data: { deviceId: "d1", cycle: false },
    })
    expect(findUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "d1" } })
    )
    expect(emitUnavailableMock).toHaveBeenCalledWith("not_found")
  })
})

describe("checkSingleDevice through WhatsAppHealthJob.handle", () => {
  it("logs not_found when the device is unavailable", async () => {
    findUniqueMock.mockResolvedValue(null)

    await WhatsAppHealthJob.handle({ data: { deviceId: "missing" } })

    expect(emitUnavailableMock).toHaveBeenCalledWith("not_found")
    expect(findFirstMock).not.toHaveBeenCalled()
  })

  it("skips devices whose status is not ACTIVE", async () => {
    findUniqueMock.mockResolvedValue(activeDevice({ status: "DISCONNECTED" }))

    await WhatsAppHealthJob.handle({ data: { deviceId: "d1" } })

    expect(findFirstMock).not.toHaveBeenCalled()
    expect(updateLastHeartbeatMock).not.toHaveBeenCalled()
    expect(emitUnavailableMock).not.toHaveBeenCalled()
  })

  it("logs phone_id_missing when an active device lacks a phone ID", async () => {
    findUniqueMock.mockResolvedValue(activeDevice({ whatsappPhoneId: null }))

    await WhatsAppHealthJob.handle({ data: { deviceId: "d1" } })

    expect(emitUnavailableMock).toHaveBeenCalledWith("phone_id_missing")
    expect(findFirstMock).not.toHaveBeenCalled()
  })

  it("updates heartbeat and clears misses for a healthy device", async () => {
    findUniqueMock.mockResolvedValue(activeDevice())

    await WhatsAppHealthJob.handle({ data: { deviceId: "d1" } })

    expect(decryptWhatsAppTokenMock).toHaveBeenCalledWith("encrypted-token")
    expect(metaClientConstructorMock).toHaveBeenCalledWith({
      accessToken: "token",
      phoneNumberId: "phone-1",
      organizationId: "org-1",
    })
    expect(metaRequestMock).toHaveBeenCalledWith(
      "PHONE_INFO",
      "/PHONE_INFO/phone-1",
      "GET"
    )
    expect(updateLastHeartbeatMock).toHaveBeenCalledWith("d1")
    expect(redisDelMock).toHaveBeenCalledWith("whatsapp:health:miss:d1")
    expect(markDisconnectedMock).not.toHaveBeenCalled()
    expect(syncDeviceFromMetaMock).toHaveBeenCalledWith("d1", "org-1")
  })

  it("increments misses and logs an API failure", async () => {
    findUniqueMock.mockResolvedValue(activeDevice())
    metaRequestMock.mockRejectedValue(new Error("Meta unavailable"))
    pipelineExecMock.mockResolvedValue([[null, 2]] as unknown[])

    await WhatsAppHealthJob.handle({ data: { deviceId: "d1" } })

    expect(pipelineIncrMock).toHaveBeenCalledWith("whatsapp:health:miss:d1")
    expect(pipelineExpireMock).toHaveBeenCalledWith(
      "whatsapp:health:miss:d1",
      900
    )
    expect(emitCheckFailedMock).toHaveBeenCalledWith(2, "Meta unavailable")
    expect(markDisconnectedMock).not.toHaveBeenCalled()
    expect(syncDeviceFromMetaMock).not.toHaveBeenCalled()
  })

  it("records a Meta metadata failure without failing a healthy device", async () => {
    findUniqueMock.mockResolvedValue(activeDevice())
    syncDeviceFromMetaMock.mockRejectedValue(new Error("Meta unavailable"))

    await WhatsAppHealthJob.handle({ data: { deviceId: "d1" } })

    expect(updateLastHeartbeatMock).toHaveBeenCalledWith("d1")
    expect(redisDelMock).toHaveBeenCalledWith("whatsapp:health:miss:d1")
    expect(recordMetaRefreshUnavailableMock).toHaveBeenCalledWith("d1", "org-1")
    expect(emitMetadataRefreshFailedMock).toHaveBeenCalledWith(
      expect.any(Error)
    )
    expect(emitCheckFailedMock).not.toHaveBeenCalled()
    expect(markDisconnectedMock).not.toHaveBeenCalled()
  })

  it("logs the refresh-recording error once when recording fails", async () => {
    const recordError = new Error("Metadata state could not be recorded")
    findUniqueMock.mockResolvedValue(activeDevice())
    syncDeviceFromMetaMock.mockRejectedValue(new Error("Meta unavailable"))
    recordMetaRefreshUnavailableMock.mockRejectedValue(recordError)

    await WhatsAppHealthJob.handle({ data: { deviceId: "d1" } })

    expect(updateLastHeartbeatMock).toHaveBeenCalledWith("d1")
    expect(recordMetaRefreshUnavailableMock).toHaveBeenCalledWith("d1", "org-1")
    expect(emitMetadataRefreshFailedMock).toHaveBeenCalledTimes(1)
    expect(emitMetadataRefreshFailedMock).toHaveBeenCalledWith(recordError)
    expect(emitCheckFailedMock).not.toHaveBeenCalled()
  })

  it("disconnects after the miss threshold and emails organization users", async () => {
    findUniqueMock.mockResolvedValueOnce(activeDevice()).mockResolvedValueOnce({
      phoneNumber: "+15551234567",
      lastHeartbeatAt: new Date("2025-01-01T00:00:00.000Z"),
    })
    metaRequestMock.mockRejectedValue(new Error("connection lost"))
    pipelineExecMock.mockResolvedValue([[null, MISS_THRESHOLD]] as unknown[])

    await WhatsAppHealthJob.handle({ data: { deviceId: "d1" } })

    expect(markDisconnectedMock).toHaveBeenCalledWith("d1")
    expect(redisDelMock).toHaveBeenCalledWith("whatsapp:health:miss:d1")
    expect(emitDisconnectedMock).toHaveBeenCalledTimes(1)
    expect(getOrganizationMock).toHaveBeenCalledWith("org-1")
    expect(listMembershipsMock).toHaveBeenCalledWith({
      organizationId: "org-1",
    })
    expect(getUserMock).toHaveBeenCalledTimes(2)
    expect(sendEmailMock).toHaveBeenCalledTimes(2)
    expect(sendEmailMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        to: "user-1@example.com",
        subject: expect.stringContaining("WhatsApp Device Disconnected"),
      })
    )
  })

  it("logs when a disconnected device has no email recipients", async () => {
    findUniqueMock.mockResolvedValueOnce(activeDevice()).mockResolvedValueOnce({
      phoneNumber: "+15551234567",
      lastHeartbeatAt: null,
    })
    metaRequestMock.mockRejectedValue(new Error("connection lost"))
    pipelineExecMock.mockResolvedValue([[null, MISS_THRESHOLD]] as unknown[])
    getUserMock.mockImplementation(async (userId: string) => ({
      id: userId,
      email: "",
    }))

    await WhatsAppHealthJob.handle({ data: { deviceId: "d1" } })

    expect(emitNoRecipientsMock).toHaveBeenCalledTimes(1)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })
})

describe("checkDeviceHealth", () => {
  it("returns a not-found error when the database has no device", async () => {
    findFirstMock.mockResolvedValue(null)

    await expect(
      checkDeviceHealth({ organizationId: "org-1", phoneId: "phone-1" })
    ).resolves.toEqual({
      ok: false,
      error: "Device not found or missing phoneId",
    })
  })

  it("returns a missing-token error when no encrypted token is configured", async () => {
    findFirstMock.mockResolvedValue(healthDevice({ tokenEncrypted: null }))

    await expect(
      checkDeviceHealth({ organizationId: "org-1", phoneId: "phone-1" })
    ).resolves.toEqual({ ok: false, error: "No access token configured" })
    expect(decryptWhatsAppTokenMock).not.toHaveBeenCalled()
  })

  it("returns connected when the Meta API succeeds", async () => {
    await expect(
      checkDeviceHealth({ organizationId: "org-1", phoneId: "phone-1" })
    ).resolves.toEqual({ ok: true, connected: true })
  })

  it("returns the Meta API error message when the request fails", async () => {
    metaRequestMock.mockRejectedValue(new Error("API request failed"))

    await expect(
      checkDeviceHealth({ organizationId: "org-1", phoneId: "phone-1" })
    ).resolves.toEqual({ ok: false, error: "API request failed" })
  })
})
