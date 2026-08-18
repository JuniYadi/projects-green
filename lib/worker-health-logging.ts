import type { Job, Worker } from "bullmq"

import {
  type JsonLogRecord,
  type JsonLogWriter,
  writeJsonLogLine,
} from "@/lib/server-logging"

const SERVICE = "workers"
const MAX_IDENTIFIER_LENGTH = 128
const SENSITIVE_IDENTIFIER_MARKER =
  /(?:api[-_]?key|authorization|bearer|credential|device|password|phone|secret|ssh|token|url)/i
const KNOWN_ERROR_TYPES = new Set([
  "AbortError",
  "AggregateError",
  "EvalError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "TimeoutError",
  "TypeError",
  "URIError",
])

const registeredWorkers = new WeakSet<Worker>()

export type WorkerHealthJob = Pick<Job, "id" | "name" | "attemptsMade">

type VpnHealthCounts = {
  checked: number
  updated: number
  errors: number
}

const safeIdentifier = (value: unknown, fallback = "unknown"): string => {
  if (typeof value !== "string") return fallback

  if (SENSITIVE_IDENTIFIER_MARKER.test(value)) return "redacted"

  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9._:-]/g, "_")
    .slice(0, MAX_IDENTIFIER_LENGTH)

  return normalized || fallback
}

const safeCount = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.floor(value)
}

const safeErrorType = (error: unknown): string => {
  try {
    if (error instanceof Error) {
      const name = error.name
      return typeof name === "string" && KNOWN_ERROR_TYPES.has(name)
        ? name
        : "Error"
    }

    if (error === null) return "Null"

    return typeof error === "object" ? "Object" : typeof error
  } catch {
    return "Unknown"
  }
}

const baseRecord = (
  level: "error" | "info" | "warn",
  event: string
): JsonLogRecord => ({
  timestamp: new Date().toISOString(),
  level,
  event,
  service: SERVICE,
})

const writeRecord = (record: JsonLogRecord, writer: JsonLogWriter) => {
  writer(record)
}

export const emitWorkerJobActive = (
  queue: string,
  job: WorkerHealthJob | null | undefined,
  writer: JsonLogWriter = writeJsonLogLine
): void => {
  writeRecord(
    {
      ...baseRecord("info", "worker.job.active"),
      queue: safeIdentifier(queue),
      jobName: safeIdentifier(job?.name),
      jobId: safeIdentifier(job?.id),
    },
    writer
  )
}

export const emitWorkerJobCompleted = (
  queue: string,
  job: WorkerHealthJob | null | undefined,
  writer: JsonLogWriter = writeJsonLogLine
): void => {
  writeRecord(
    {
      ...baseRecord("info", "worker.job.completed"),
      queue: safeIdentifier(queue),
      jobName: safeIdentifier(job?.name),
      jobId: safeIdentifier(job?.id),
    },
    writer
  )
}

export const emitWorkerJobFailed = (
  queue: string,
  job: WorkerHealthJob | null | undefined,
  error: unknown,
  writer: JsonLogWriter = writeJsonLogLine
): void => {
  writeRecord(
    {
      ...baseRecord("error", "worker.job.failed"),
      queue: safeIdentifier(queue),
      jobName: safeIdentifier(job?.name),
      jobId: safeIdentifier(job?.id),
      attempts: safeCount(job?.attemptsMade ?? 0),
      errorType: safeErrorType(error),
    },
    writer
  )
}

export const registerWhatsAppHealthWorkerLogging = (worker: Worker): void => {
  if (registeredWorkers.has(worker)) return
  registeredWorkers.add(worker)

  worker.on("active", (job) => {
    emitWorkerJobActive(worker.name, job)
  })

  worker.on("completed", (job) => {
    emitWorkerJobCompleted(worker.name, job)
  })

  worker.on("failed", (job, error) => {
    emitWorkerJobFailed(worker.name, job, error)
  })
}

export const emitWhatsAppHealthCycleEnqueued = (
  enqueuedCount: number,
  writer: JsonLogWriter = writeJsonLogLine
): void => {
  writeRecord(
    {
      ...baseRecord("info", "whatsapp.health.cycle.enqueued"),
      enqueuedCount: safeCount(enqueuedCount),
    },
    writer
  )
}

export const emitWhatsAppHealthDeviceUnavailable = (
  reason: "not_found" | "phone_id_missing",
  writer: JsonLogWriter = writeJsonLogLine
): void => {
  writeRecord(
    {
      ...baseRecord("warn", "whatsapp.health.device.unavailable"),
      reason,
    },
    writer
  )
}

export const emitWhatsAppHealthDeviceRecovered = (
  writer: JsonLogWriter = writeJsonLogLine
): void => {
  writeRecord(baseRecord("info", "whatsapp.health.device.recovered"), writer)
}

export const emitWhatsAppHealthDeviceCheckFailed = (
  missCount: number,
  error: unknown,
  writer: JsonLogWriter = writeJsonLogLine
): void => {
  writeRecord(
    {
      ...baseRecord("warn", "whatsapp.health.device.check.failed"),
      missCount: safeCount(missCount),
      errorType: safeErrorType(error),
    },
    writer
  )
}

export const emitWhatsAppHealthDeviceDisconnected = (
  writer: JsonLogWriter = writeJsonLogLine
): void => {
  writeRecord(baseRecord("info", "whatsapp.health.device.disconnected"), writer)
}

export const emitWhatsAppHealthDisconnectEmailNoRecipients = (
  writer: JsonLogWriter = writeJsonLogLine
): void => {
  writeRecord(
    {
      ...baseRecord("warn", "whatsapp.health.disconnect_email.no_recipients"),
      recipientCount: 0,
    },
    writer
  )
}

export const emitWhatsAppHealthDisconnectEmailFailed = (
  error: unknown,
  writer: JsonLogWriter = writeJsonLogLine
): void => {
  writeRecord(
    {
      ...baseRecord("error", "whatsapp.health.disconnect_email.failed"),
      errorType: safeErrorType(error),
    },
    writer
  )
}

export const emitVpnHealthServerFailed = (
  error: unknown,
  writer: JsonLogWriter = writeJsonLogLine
): void => {
  writeRecord(
    {
      ...baseRecord("error", "vpn.health.server.failed"),
      errorType: safeErrorType(error),
    },
    writer
  )
}

export const emitVpnHealthCycleCompleted = (
  result: VpnHealthCounts,
  writer: JsonLogWriter = writeJsonLogLine
): void => {
  writeRecord(
    {
      ...baseRecord("info", "vpn.health.cycle.completed"),
      checked: safeCount(result.checked),
      updated: safeCount(result.updated),
      errors: safeCount(result.errors),
    },
    writer
  )
}

export const emitVpnHealthCycleFailed = (
  error: unknown,
  writer: JsonLogWriter = writeJsonLogLine
): void => {
  writeRecord(
    {
      ...baseRecord("error", "vpn.health.cycle.failed"),
      errorType: safeErrorType(error),
    },
    writer
  )
}
