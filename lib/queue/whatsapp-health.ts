/**
 * WhatsApp Device Health — BullMQ repeatable job
 *
 * Heartbeat mechanism: polls Meta Cloud API every 5 min per ACTIVE device.
 * 3 consecutive misses → DISCONNECTED.
 *
 * Miss counter: Redis key `whatsapp:health:miss:{deviceId}` with 15 min TTL.
 * Device heartbeat: `lastHeartbeatAt` on `WhatsappDevice`.
 */

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { BaseJob } from "@/lib/queue/base-job"
import { redis } from "@/lib/redis"
import { checkDeviceHealth } from "@/modules/whatsapp/whatsapp-client"
import { devicesService } from "@/modules/whatsapp/devices/devices.service"

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

async function getMissCount(deviceId: string): Promise<number> {
  const raw = await redis.get(missKey(deviceId))
  return raw ? parseInt(raw, 10) : 0
}

async function incrementMissCount(deviceId: string): Promise<number> {
  const key = missKey(deviceId)
  const pipeline = redis.multi()
  pipeline.incr(key)
  pipeline.expire(key, MISS_TTL_SECONDS)
  const results = await pipeline.exec()
  return results?.[0]?.[1] as number ?? 1
}

async function clearMissCount(deviceId: string): Promise<void> {
  await redis.del(missKey(deviceId))
}

// ── Health Check ─────────────────────────────────────────────────────────────

async function checkSingleDevice(deviceId: string): Promise<void> {
  const device = await prisma.whatsappDevice.findUnique({
    where: { id: deviceId },
    select: {
      id: true,
      organizationId: true,
      status: true,
      whatsappPhoneId: true,
    },
  })

  if (!device) {
    console.warn(`[whatsapp-health] device not found: ${deviceId}`)
    return
  }

  if (device.status !== "ACTIVE") {
    return // skip non-active devices
  }

  if (!device.whatsappPhoneId) {
    console.warn(`[whatsapp-health] device has no phoneId: ${deviceId}`)
    return
  }

  // Call Meta API to check device health
  const result = await checkDeviceHealth({
    organizationId: device.organizationId,
    phoneId: device.id,
  })

  if (result.ok) {
    // Device is healthy — update heartbeat and clear miss counter
    await devicesService.updateLastHeartbeat(deviceId)
    await clearMissCount(deviceId)

    // Auto-recover DISCONNECTED → ACTIVE if check succeeds
    if ((device.status as string) === "DISCONNECTED") {
      await devicesService.markActive(deviceId)
      console.info(`[whatsapp-health] device recovered: ${deviceId}`)
    }
  } else {
    // Miss — increment counter
    const missCount = await incrementMissCount(deviceId)
    console.warn(
      `[whatsapp-health] health check failed device=${deviceId} miss=${missCount} error=${result.error}`
    )

    if (missCount >= MISS_THRESHOLD) {
      await devicesService.markDisconnected(deviceId)
      await clearMissCount(deviceId)
      console.info(`[whatsapp-health] device marked DISCONNECTED: ${deviceId}`)
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

  console.info(`[whatsapp-health] cycle: enqueued ${devices.length} device checks`)
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
