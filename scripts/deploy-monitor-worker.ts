import { monitorActiveDeployments } from "@/modules/deploy/deploy-monitor.service"

const POLL_INTERVAL_MS = 60_000 // 1 minute

let shuttingDown = false

const runMonitor = async () => {
  try {
    const results = await monitorActiveDeployments()
    if (results.length > 0) {
      console.info(
        `[deploy-monitor] checked ${results.length} active deployment(s)`
      )
    }
  } catch (error) {
    console.error("[deploy-monitor] monitor cycle failed:", error)
  }
}

const shutdown = async (signal: string) => {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  console.info(`[deploy-monitor] received ${signal}, shutting down`)
  process.exit(0)
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM")
})

process.on("SIGINT", () => {
  void shutdown("SIGINT")
})

console.info(
  `[deploy-monitor] starting interval poll every ${POLL_INTERVAL_MS}ms`
)

// Run immediately, then on interval
await runMonitor()

const interval = setInterval(() => {
  if (shuttingDown) {
    clearInterval(interval)
    return
  }
  void runMonitor()
}, POLL_INTERVAL_MS)
