/**
 * WhatsApp Device Health — BullMQ repeatable job
 *
 * Heartbeat mechanism: polls Meta Cloud API every 5 min per ACTIVE device.
 * A successful heartbeat also refreshes device metadata through the same shared
 * operation used by the manual "Sync From Meta" control.
 * 3 consecutive misses → DISCONNECTED.
 *
 * Miss counter: Redis key `whatsapp:health:miss:{deviceId}` with 15 min TTL.
 * Device heartbeat: `lastHeartbeatAt` on `WhatsappDevice`.
 */

import { render } from "@react-email/components"
import { prisma } from "@/lib/prisma"
import { BaseJob } from "@/lib/queue/base-job"
import { sendEmail } from "@/lib/queue/email"
import { redis } from "@/lib/redis"
import { devicesService } from "@/modules/whatsapp/devices/devices.service"
import {
  recordMetaRefreshUnavailable,
  syncDeviceFromMeta,
} from "@/modules/whatsapp/devices/business-profile.service"
import { DeviceDisconnectedEmail } from "@/modules/whatsapp/emails/device-disconnected"
import {
  emitWhatsAppHealthCycleEnqueued,
  emitWhatsAppHealthDeviceCheckFailed,
  emitWhatsAppHealthDeviceDisconnected,
  emitWhatsAppHealthDeviceRecovered,
  emitWhatsAppHealthDeviceUnavailable,
  emitWhatsAppHealthDeviceMetadataRefreshFailed,
  emitWhatsAppHealthDisconnectEmailFailed,
  emitWhatsAppHealthDisconnectEmailNoRecipients,
} from "@/lib/worker-health-logging"

// ── Constants ────────────────────────────────────────────────────────────────

export const WHATSAPP_HEALTH_QUEUE = "whatsapp-health"
export const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000 // 5 min
export const MISS_THRESHOLD = 3 // 3 misses = 15 min total
export const MISS_TTL_SECONDS = 15 * 60 // 15 min TTL on Redis counter

// ── Job Data ─────────────────────────────────────────────────────────────────

export type WhatsAppHealthJobData = {
  deviceId: string
  cycle?: boolean // true = this is the recurring cycle job
}

// ── Miss Counter (Redis) ──────────────────────────────────────────────────────

function missKey(deviceId: string) {
  return `whatsapp:health:miss:${deviceId}`
}

async function incrementMissCount(deviceId: string): Promise<number> {
  const key = missKey(deviceId)
  const pipeline = redis.multi()
  pipeline.incr(key)
  pipeline.expire(key, MISS_TTL_SECONDS)
  const results = await pipeline.exec()
  return (results?.[0]?.[1] as number) ?? 1
}

async function clearMissCount(deviceId: string): Promise<void> {
  await redis.del(missKey(deviceId))
}

// ── Health Check ─────────────────────────────────────────────────────────────

type HealthCheckResult =
  | { ok: true; connected: boolean }
  | { ok: false; error: string }

export async function checkDeviceHealth(params: {
  organizationId: string
  phoneId: string
}): Promise<HealthCheckResult> {
  const { organizationId, phoneId } = params

  const device = await prisma.whatsappDevice.findFirst({
    where: { whatsappPhoneId: phoneId, organizationId },
    select: {
      whatsappPhoneId: true,
      whatsappBusinessAccountId: true,
      tokenEncrypted: true,
      tokenIv: true,
      whatsappVersion: true,
    },
  })

  if (!device?.whatsappPhoneId) {
    return { ok: false, error: "Device not found or missing phoneId" }
  }

  try {
    const { decryptWhatsAppToken } = await import("@/lib/whatsapp/crypto")
    const { MetaCloudHttpClient } =
      await import("@/lib/whatsapp/meta-cloud/client")
    const { ENDPOINTS } = await import("@/lib/whatsapp/meta-cloud/endpoints")

    if (!device.tokenEncrypted) {
      return { ok: false, error: "No access token configured" }
    }

    const accessToken = await decryptWhatsAppToken(device.tokenEncrypted)

    const httpClient = new MetaCloudHttpClient({
      accessToken,
      phoneNumberId: device.whatsappPhoneId,
      organizationId,
    })

    await httpClient.request(
      "PHONE_INFO",
      ENDPOINTS.PHONE_INFO(device.whatsappPhoneId),
      "GET"
    )

    return { ok: true, connected: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return { ok: false, error: message }
  }
}

async function sendDisconnectEmail(
  deviceId: string,
  orgId: string
): Promise<void> {
  try {
    const device = await prisma.whatsappDevice.findUnique({
      where: { id: deviceId },
      select: {
        phoneNumber: true,
        lastHeartbeatAt: true,
      },
    })
    if (!device) return

    const { createWorkOS } = await import("@workos-inc/node")
    const workos = createWorkOS({ apiKey: process.env.WORKOS_API_KEY ?? "" })

    const org = await workos.organizations.getOrganization(orgId)
    const memberships = await workos.userManagement.listOrganizationMemberships(
      {
        organizationId: orgId,
      }
    )

    const users = await Promise.all(
      memberships.data.map((m) => workos.userManagement.getUser(m.userId))
    )
    const recipients = users.filter((u) => u.email)

    if (!recipients.length) {
      emitWhatsAppHealthDisconnectEmailNoRecipients()
      return
    }

    const html = await render(
      <DeviceDisconnectedEmail
        deviceName={device.phoneNumber}
        phoneNumber={device.phoneNumber}
        orgName={org.name}
        lastHeartbeatAt={device.lastHeartbeatAt?.toISOString() ?? "Unknown"}
        disconnectedAt={new Date().toISOString()}
      />
    )

    const subject = `[${org.name}] WhatsApp Device Disconnected: ${device.phoneNumber}`
    for (const { email } of recipients) {
      sendEmail({ to: email, subject, html }).catch((err) =>
        emitWhatsAppHealthDisconnectEmailFailed(err)
      )
    }
  } catch (err) {
    emitWhatsAppHealthDisconnectEmailFailed(err)
  }
}

async function checkSingleDevice(deviceId: string): Promise<void> {
  const device = await prisma.whatsappDevice.findUnique({
    where: { id: deviceId },
    select: {
      id: true,
      organizationId: true,
      status: true,
      whatsappPhoneId: true,
      whatsappBusinessAccountId: true,
    },
  })

  if (!device) {
    emitWhatsAppHealthDeviceUnavailable("not_found")
    return
  }

  if (device.status !== "ACTIVE") {
    return // skip non-active devices
  }

  if (!device.whatsappPhoneId) {
    emitWhatsAppHealthDeviceUnavailable("phone_id_missing")
    return
  }

  // Call Meta API to check device health
  const result = await checkDeviceHealth({
    organizationId: device.organizationId,
    phoneId: device.whatsappPhoneId,
  })

  if (result.ok) {
    // Device is healthy — update heartbeat and clear miss counter
    await devicesService.updateLastHeartbeat(deviceId)
    await clearMissCount(deviceId)

    // Auto-recover DISCONNECTED → ACTIVE if check succeeds
    if ((device.status as string) === "DISCONNECTED") {
      await devicesService.markActive(deviceId)
      emitWhatsAppHealthDeviceRecovered()
    }

    if (!device.whatsappBusinessAccountId) return

    // Metadata must never turn a healthy connection into a failed health check.
    try {
      await syncDeviceFromMeta(deviceId, device.organizationId)
    } catch (error) {
      try {
        await recordMetaRefreshUnavailable(deviceId, device.organizationId)
      } catch (recordError) {
        emitWhatsAppHealthDeviceMetadataRefreshFailed(recordError)
      }
      emitWhatsAppHealthDeviceMetadataRefreshFailed(error)
    }
  } else {
    // Miss — increment counter
    const missCount = await incrementMissCount(deviceId)
    emitWhatsAppHealthDeviceCheckFailed(missCount, result.error)

    if (missCount >= MISS_THRESHOLD) {
      await devicesService.markDisconnected(deviceId)
      await clearMissCount(deviceId)
      emitWhatsAppHealthDeviceDisconnected()
      await sendDisconnectEmail(deviceId, device.organizationId)
    }
  }
}

// ── Cycle Job (fan-out) ───────────────────────────────────────────────────────

async function runHeartbeatCycle(): Promise<void> {
  const devices = await prisma.whatsappDevice.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  })

  for (const device of devices) {
    await WhatsAppHealthJob.enqueue({ deviceId: device.id })
  }

  emitWhatsAppHealthCycleEnqueued(devices.length)
}

// ── BullMQ Job Class ──────────────────────────────────────────────────────────

export class WhatsAppHealthJob extends BaseJob {
  static readonly queue = WHATSAPP_HEALTH_QUEUE
  static readonly workerConcurrency = 5
  static readonly attempts = 2

  static async handle(job: { data: WhatsAppHealthJobData }): Promise<void> {
    const { deviceId, cycle } = job.data

    if (cycle) {
      await runHeartbeatCycle()
    } else {
      await checkSingleDevice(deviceId)
    }
  }

  static async registerSchedule(): Promise<void> {
    await this.registerRepeatable(
      { every: HEARTBEAT_INTERVAL_MS },
      { cycle: true }
    )
  }
}
