import { logger } from "@/lib/logger"
import { monitorActiveDeployments } from "@/modules/deploy/deploy-monitor.service"

const POLL_INTERVAL_MS = 60_000 // 1 minute

let shuttingDown = false

const runMonitor = async () => {
  try {
    const results = await monitorActiveDeployments()
    if (results.length > 0) {
      logger.info(
        {
          event: "deploy.monitor.checked",
          count: results.length,
        },
        `[deploy-monitor] checked ${results.length} active deployment(s)`
      )
    }
  } catch (error) {
    logger.error(
      {
        event: "deploy.monitor.cycle_failed",
        err: error,
      },
      "[deploy-monitor] monitor cycle failed"
    )
  }
}

const shutdown = async (signal: string) => {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  logger.info(
    {
      event: "deploy.monitor.shutdown",
      signal,
    },
    `[deploy-monitor] received ${signal}, shutting down`
  )
  process.exit(0)
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM")
})

process.on("SIGINT", () => {
  void shutdown("SIGINT")
})

logger.info(
  {
    event: "deploy.monitor.started",
    pollIntervalMs: POLL_INTERVAL_MS,
  },
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
