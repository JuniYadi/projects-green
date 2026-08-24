import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/queue/email"
import type { CronTriggerType } from "@prisma/client"

export interface TelemetryContext {
  log: (message: string) => void
  warn: (message: string) => void
  error: (message: string, error?: unknown) => void
}

export interface TelemetryOptions {
  triggerType?: CronTriggerType
  triggeredBy?: string
  triggerReason?: string
  timeoutMs?: number
}

const MAX_LOG_LINES = 500

const escapeHtml = (str: string): string => {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

/**
 * Wraps any cronjob or scheduled task with database telemetry,
 * in-memory ring-buffer logging, and automated failure email alerts.
 */
export async function withCronTelemetry<T>(
  jobCode: string,
  runnerFn: (ctx: TelemetryContext) => Promise<T>,
  options: TelemetryOptions = {}
): Promise<T> {
  const logs: string[] = []

  const appendLog = (level: "INFO" | "WARN" | "ERROR", msg: string) => {
    const timestamp = new Date().toISOString()
    const line = `[${timestamp}] [${level}] ${msg}`
    logs.push(line)
    if (logs.length > MAX_LOG_LINES) {
      logs.shift()
    }
  }

  const ctx: TelemetryContext = {
    log: (msg) => appendLog("INFO", msg),
    warn: (msg) => appendLog("WARN", msg),
    error: (msg, err) => {
      const errStr =
        err instanceof Error ? (err.stack ?? err.message) : String(err ?? "")
      appendLog("ERROR", errStr ? `${msg} -> ${errStr}` : msg)
    },
  }

  // Ensure definition exists
  const definition = await prisma.cronJobDefinition.findUnique({
    where: { code: jobCode },
  })

  if (!definition) {
    throw new Error(
      `CronJob definition with code "${jobCode}" not found in registry.`
    )
  }

  const podName =
    process.env.HOSTNAME ||
    process.env.POD_NAME ||
    process.env.NODE_ENV ||
    "local-runner"

  const execution = await prisma.cronJobExecution.create({
    data: {
      cronJobId: definition.id,
      status: "RUNNING",
      triggerType: options.triggerType ?? "SCHEDULED_K8S",
      triggeredBy: options.triggeredBy,
      triggerReason: options.triggerReason,
      podName,
    },
  })

  await prisma.cronJobDefinition.update({
    where: { id: definition.id },
    data: {
      lastStatus: "RUNNING",
      lastRunAt: new Date(),
    },
  })

  const startedAt = Date.now()
  ctx.log(
    `Started cronjob [${jobCode}] execution id=${execution.id} on pod=${podName}`
  )
  try {
    const timeoutMs = options.timeoutMs ?? definition.timeoutSeconds * 1000
    const runnerPromise = runnerFn(ctx)
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`CronJob [${jobCode}] timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      if (typeof timer === "object" && "unref" in timer) {
        timer.unref()
      }
    })

    const result = await Promise.race([runnerPromise, timeoutPromise])
    const durationMs = Date.now() - startedAt

    ctx.log(`Completed cronjob [${jobCode}] successfully in ${durationMs}ms`)

    await prisma.cronJobExecution.update({
      where: { id: execution.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        durationMs,
        summary: (result && typeof result === "object"
          ? result
          : { success: true }) as object,
        logTail: logs.join("\n"),
      },
    })

    await prisma.cronJobDefinition.update({
      where: { id: definition.id },
      data: {
        lastStatus: "HEALTHY",
      },
    })

    return result
  } catch (err: unknown) {
    const durationMs = Date.now() - startedAt
    const errorMsg =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : "Unknown execution error"
    const errorStack = err instanceof Error ? err.stack : undefined

    ctx.error(`Cronjob [${jobCode}] failed after ${durationMs}ms: ${errorMsg}`)

    await prisma.cronJobExecution.update({
      where: { id: execution.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        durationMs,
        errorMessage: errorMsg,
        errorStack,
        logTail: logs.join("\n"),
      },
    })

    await prisma.cronJobDefinition.update({
      where: { id: definition.id },
      data: {
        lastStatus: "FAILED",
      },
    })

    // Send Alert Email (Non-blocking)
    try {
      const adminEmail =
        process.env.ADMIN_ALERT_EMAIL || "admin@projects-green.local"
      await sendEmail({
        to: adminEmail,
        subject: `🚨 [CRON FAILED] ${escapeHtml(definition.name)} (${escapeHtml(jobCode)})`,
        html: `<p><strong>CRONJOB EXECUTION FAILURE ALERT</strong></p><p>Job: ${escapeHtml(definition.name)} (${escapeHtml(jobCode)})<br/>Execution ID: ${escapeHtml(execution.id)}<br/>Pod: ${escapeHtml(podName)}<br/>Duration: ${durationMs}ms</p><p><strong>Error:</strong> ${escapeHtml(errorMsg)}</p><pre>${escapeHtml(errorStack || "N/A")}</pre><pre>${escapeHtml(logs.slice(-20).join("\n"))}</pre>`,
      })
    } catch (emailErr) {
      console.error(
        `[cron-telemetry] Failed to send alert email for ${jobCode}:`,
        emailErr
      )
    }

    throw err
  }
}
