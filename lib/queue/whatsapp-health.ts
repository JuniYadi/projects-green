/**
 * WhatsApp Device Health Job
 *
 * Repeatable BullMQ job that polls Meta Cloud API per ACTIVE device.
 * M consecutive failures → DISCONNECTED. Email alert via existing global email queue.
 *
 * Miss counter (Redis, not DB):
 *   Key: `whatsapp:health:miss:{deviceId}` — INCR on failure, DEL on success
 *   TTL: 15 min auto-cleanup
 *   ponytail: Redis over DB counter to avoid schema churn for transient state.
 *
 * Threshold: 3 misses (HARDCODED). Env var if someone complains.
 */

import type { Job } from "bullmq"
import type { ConnectionOptions } from "bullmq"
import Redis from "ioredis"
import { BaseJob } from "@/lib/queue/base-job"
import { getQueueRuntimeConfig } from "@/lib/queue/queue-config"
import { prisma } from "@/lib/prisma"
import { ENDPOINTS } from "@/lib/whatsapp/meta-cloud/endpoints"

export type WhatsAppHealthJobData = {
  deviceId: string
}

const MISS_THRESHOLD = 3
const MISS_TTL = 900 // 15 min

/** Lazy Redis client for miss counters — one connection shared across workers. */
let _redis: Redis | null = null
function getRedis(): Redis {
  if (!_redis) {
    const { connection } = getQueueRuntimeConfig()
    const cfg = connection as Record<string, unknown>
    _redis = new Redis({
      host: cfg.host as string | undefined,
      port: cfg.port as number | undefined,
      username: cfg.username as string | undefined,
      password: cfg.password as string | undefined,
      db: (cfg.db as number) ?? 0,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    })
  }
  return _redis
}

function missKey(deviceId: string): string {
  return `whatsapp:health:miss:${deviceId}`
}

export class WhatsAppHealthJob extends BaseJob {
  static readonly queue = "whatsapp-health"
  static readonly workerConcurrency = 5
  static readonly attempts = 2

  /** Dispatch a single device health check. */
  static async dispatch(deviceId: string): Promise<void> {
    await this.enqueue<WhatsAppHealthJobData>(
      { deviceId },
      { jobId: `whatsapp-health-${deviceId}` }
    )
  }

  static async handle(job: Job<WhatsAppHealthJobData | Record<string, never>>): Promise<void> {
    const { deviceId } = job.data as WhatsAppHealthJobData

    if (deviceId) {
      // Per-device health check
      await checkDeviceHealth(deviceId)
      return
    }

    // Cycle job: enumerate ACTIVE/UNKNOWN/DISCONNECTED devices and fan out
    const devices = await prisma.whatsappDevice.findMany({
      where: {
        status: { in: ["ACTIVE", "UNKNOWN"] },
        whatsappPhoneId: { not: null },
      },
      select: { id: true },
    })

    console.info(
      `[whatsapp-health] cycle: ${devices.length} device(s) to check`
    )

    // Fire-and-forget individual checks (they queue; worker concurrency limits the API calls)
    for (const device of devices) {
      await this.dispatch(device.id).catch(() => {})
    }
  }

  /** Register the 5-min repeatable heartbeat cycle. */
  static async registerHeartbeatCycle(): Promise<void> {
    await this.registerRepeatable(
      { every: 300_000 },
      {},
      { jobId: "whatsapp-health-cycle" }
    )
  }
}

// ── Health check logic ──────────────────────────────────────────────────────

/**
 * Check a single device's health by calling Meta Cloud API profile endpoint.
 * Success → update lastHeartbeatAt, clear miss counter.
 * Failure → increment miss counter; if >= threshold → mark DISCONNECTED.
 *
 * ponytail: Per-device check, no batching. Batch if >100 devices.
 */
export async function checkDeviceHealth(deviceId: string): Promise<void> {
  const device = await prisma.whatsappDevice.findUnique({
    where: { id: deviceId },
    select: {
      id: true,
      organizationId: true,
      status: true,
      whatsappPhoneId: true,
      whatsappVersion: true,
    },
  })

  // Skip NON_ACTIVE devices or devices missing required Meta fields
  if (!device || device.status === "NON_ACTIVE" || !device.whatsappPhoneId) {
    return
  }

  const accessToken = process.env.WHATSAPP_SYSTEM_TOKEN
  if (!accessToken) {
    console.warn(`[whatsapp-health] device=${deviceId}: WHATSAPP_SYSTEM_TOKEN not set, skipping`)
    return
  }

  const url = ENDPOINTS.PHONE_INFO(device.whatsappPhoneId)

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (res.ok) {
      // Success — update heartbeat, clear miss counter
      await prisma.whatsappDevice.update({
        where: { id: deviceId },
        data: { lastHeartbeatAt: new Date() },
      })

      // If device was DISCONNECTED or UNKNOWN, auto-recover to ACTIVE
      if (device.status !== "ACTIVE") {
        await prisma.whatsappDevice.update({
          where: { id: deviceId },
          data: { status: "ACTIVE", lastDisconnectedAt: null },
        })
      }

      await getRedis().del(missKey(deviceId))
      console.info(`[whatsapp-health] device=${deviceId} OK`)
      return
    }

    // Non-200 → treat as failure
    await recordMiss(deviceId)
    console.warn(`[whatsapp-health] device=${deviceId} fail status=${res.status}`)
  } catch (err) {
    // Network / timeout error
    await recordMiss(deviceId)
    console.error(`[whatsapp-health] device=${deviceId} error:`, err)
  }
}

async function recordMiss(deviceId: string): Promise<void> {
  const redis = getRedis()
  const key = missKey(deviceId)
  const pipe = redis.pipeline()
  pipe.incr(key)
  pipe.expire(key, MISS_TTL)
  const [[, count]] = await pipe.exec()
  const misses = count as number

  if (misses >= MISS_THRESHOLD) {
    console.info(`[whatsapp-health] device=${deviceId} ${misses} misses, marking DISCONNECTED`)
    await markDeviceDisconnected(deviceId)
  }
}

async function markDeviceDisconnected(deviceId: string): Promise<void> {
  const { markDisconnected } = await import(
    "@/modules/whatsapp/devices/devices.service"
  )
  await markDisconnected(deviceId)
}
