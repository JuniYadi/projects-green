import { EventEmitter } from "node:events"

import { describe, expect, test } from "bun:test"
import type { Worker } from "bullmq"

import {
  emitVpnHealthCycleCompleted,
  emitVpnHealthCycleFailed,
  emitVpnHealthServerFailed,
  emitWhatsAppHealthCycleEnqueued,
  emitWhatsAppHealthDeviceCheckFailed,
  emitWhatsAppHealthDeviceDisconnected,
  emitWhatsAppHealthDeviceRecovered,
  emitWhatsAppHealthDeviceUnavailable,
  emitWhatsAppHealthDisconnectEmailFailed,
  emitWhatsAppHealthDisconnectEmailNoRecipients,
  registerWhatsAppHealthWorkerLogging,
} from "@/lib/worker-health-logging"
import { type JsonLogRecord, writeJsonLogLine } from "@/lib/server-logging"

type CapturedStreams = {
  stdout: string
  stderr: string
}

const captureStreams = (operation: () => void): CapturedStreams => {
  const stdout: string[] = []
  const stderr: string[] = []
  const originalStdoutWrite = process.stdout.write
  const originalStderrWrite = process.stderr.write
  const capture = (target: string[]) =>
    ((chunk: string | Uint8Array) => {
      target.push(
        typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk)
      )
      return true
    }) as typeof process.stdout.write

  process.stdout.write = capture(stdout)
  process.stderr.write = capture(stderr)

  try {
    operation()
  } finally {
    process.stdout.write = originalStdoutWrite
    process.stderr.write = originalStderrWrite
  }

  return { stdout: stdout.join(""), stderr: stderr.join("") }
}

const parseLines = (output: string): JsonLogRecord[] =>
  output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as JsonLogRecord)

const createHealthWorker = (): EventEmitter & { name: string } => {
  const worker = new EventEmitter() as EventEmitter & { name: string }
  worker.name = "whatsapp-health"
  return worker
}

describe.serial("worker health JSON logging", () => {
  test("emits one JSON record per health job lifecycle event", () => {
    const worker = createHealthWorker()
    const job = {
      id: "job-42",
      name: "WhatsAppHealthJob",
      attemptsMade: 2,
      data: {
        deviceId: "device-secret",
        token: "token-secret",
      },
    }
    const failure = new Error("error-message-secret")
    const originalInfo = console.info
    const originalError = console.error
    let consoleCalls = 0

    console.info = () => {
      consoleCalls++
    }
    console.error = () => {
      consoleCalls++
    }

    try {
      const captured = captureStreams(() => {
        registerWhatsAppHealthWorkerLogging(worker as unknown as Worker)
        registerWhatsAppHealthWorkerLogging(worker as unknown as Worker)
        worker.emit("active", job)
        worker.emit("completed", job)
        worker.emit("failed", job, failure)
      })

      const logs = parseLines(captured.stderr)

      expect(captured.stdout).toBe("")
      expect(logs).toHaveLength(3)
      expect(logs.map((log) => log.event)).toEqual([
        "worker.job.active",
        "worker.job.completed",
        "worker.job.failed",
      ])
      expect(logs[0]).toMatchObject({
        level: "info",
        service: "workers",
        queue: "whatsapp-health",
        jobName: "WhatsAppHealthJob",
        jobId: "job-42",
      })
      expect(logs[2]).toMatchObject({
        errorType: "Error",
        attempts: 2,
        level: "error",
      })
      expect(JSON.stringify(logs)).not.toContain("device-secret")
      expect(JSON.stringify(logs)).not.toContain("token-secret")
      expect(JSON.stringify(logs)).not.toContain("error-message-secret")
      expect(consoleCalls).toBe(0)
    } finally {
      console.info = originalInfo
      console.error = originalError
    }
  })

  test("writes allowlisted health records to stderr without double serialization", () => {
    const secret = "synthetic-health-secret"
    const circular: Record<string, unknown> = { secret }
    circular.self = circular
    const error = new Error(secret)
    error.cause = circular

    const captured = captureStreams(() => {
      writeJsonLogLine({
        event: "test.record",
        level: "info",
        service: "workers",
      })
      emitWhatsAppHealthCycleEnqueued(3)
      emitWhatsAppHealthDeviceUnavailable("not_found")
      emitWhatsAppHealthDeviceUnavailable("phone_id_missing")
      emitWhatsAppHealthDeviceRecovered()
      emitWhatsAppHealthDeviceCheckFailed(4, error)
      emitWhatsAppHealthDeviceDisconnected()
      emitWhatsAppHealthDisconnectEmailNoRecipients()
      emitWhatsAppHealthDisconnectEmailFailed(circular)
      emitVpnHealthServerFailed(error)
      emitVpnHealthCycleCompleted({ checked: 8, updated: 7, errors: 1 })
      emitVpnHealthCycleFailed(circular)
    })

    const logs = parseLines(captured.stderr)
    const serialized = JSON.stringify(logs)

    expect(captured.stdout).toBe("")
    expect(logs).toHaveLength(12)
    expect(logs.every((log) => typeof log === "object")).toBe(true)
    expect(logs.map((log) => log.event)).toContain(
      "whatsapp.health.cycle.enqueued"
    )
    expect(logs.map((log) => log.event)).toContain("vpn.health.cycle.completed")
    expect(
      logs.find((log) => log.event === "whatsapp.health.cycle.enqueued")
    ).toMatchObject({
      enqueuedCount: 3,
      level: "info",
      service: "workers",
    })
    expect(
      logs.find((log) => log.event === "vpn.health.cycle.completed")
    ).toMatchObject({
      checked: 8,
      errors: 1,
      updated: 7,
    })
    expect(serialized).not.toContain(secret)
    expect(serialized).not.toContain("self")
  })

  test("keeps malformed low-level records parseable", () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular

    const captured = captureStreams(() => {
      writeJsonLogLine(circular as unknown as JsonLogRecord)
    })

    const logs = parseLines(captured.stderr)

    expect(captured.stdout).toBe("")
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
      event: "server.logging.serialization_failed",
      level: "error",
    })
  })
})
