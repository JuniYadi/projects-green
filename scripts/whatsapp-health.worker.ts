#!/usr/bin/env bun
/**
 * WhatsApp Health Worker — standalone process
 *
 * Runs the WhatsAppDeviceHealthJob worker and registers the
 * 5-min repeatable heartbeat cycle.
 *
 * Usage: bun run worker:whatsapp-health
 */

import { WhatsAppHealthJob } from "@/lib/queue/whatsapp-health"

const worker = WhatsAppHealthJob.createWorker()

// Register the 5-min repeatable heartbeat cycle (idempotent)
await WhatsAppHealthJob.registerHeartbeatCycle()

// Register the immediate heartbeat cycle job
// This fires once on startup to check all devices immediately
await WhatsAppHealthJob.enqueue(
  {},
  { jobId: "whatsapp-health-cycle-immediate" }
)

console.info("[whatsapp-health] worker ready — polling every 5 min")
console.info("[whatsapp-health] waiting for jobs...")

// ── Graceful Shutdown ──────────────────────────────────────────────────────

const shutdown = async (signal: string) => {
  console.info(`[whatsapp-health] received ${signal}, shutting down...`)
  await worker.close()
  process.exit(0)
}

process.on("SIGTERM", () => void shutdown("SIGTERM"))
process.on("SIGINT", () => void shutdown("SIGINT"))
