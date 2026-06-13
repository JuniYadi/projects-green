"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type {
  ScanCheckResult,
  ScanCheckStatus,
  ScanResult,
} from "./vpn-admin-client"

const STATUS_ICON: Record<ScanCheckStatus, string> = {
  pass: "✅",
  fail: "❌",
  error: "⚠",
  skip: "⏭",
}

const STATUS_CLASS: Record<ScanCheckStatus, string> = {
  pass: "text-green-600 dark:text-green-400",
  fail: "text-red-600 dark:text-red-400",
  error: "text-amber-600 dark:text-amber-400",
  skip: "text-muted-foreground",
}

function formatLatency(check: ScanCheckResult): string {
  if (check.latencyMs === null) return "—"
  if (check.latencyMs >= 1000) return `${(check.latencyMs / 1000).toFixed(1)}s`
  return `${check.latencyMs}ms`
}

function formatPort(check: ScanCheckResult): string {
  if (check.port === null) return "—"
  return `${check.port}/${check.transport ?? "tcp"}`
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.toISOString().slice(0, 19).replace("T", " ")} UTC`
}

function CheckRow({
  check,
  onEnableProtocol,
}: {
  check: ScanCheckResult
  onEnableProtocol?: (protocol: ScanCheckResult["protocol"]) => void
}) {
  const isMisconfig = check.suggestedAction === "ENABLE_PROTOCOL"
  const isProblem = check.status === "fail" || check.status === "error"
  const processLabel = check.processName
    ? `${check.processName}${check.processPid ? ` (PID ${check.processPid})` : ""}`
    : null
  return (
    <div className="group">
      <div
        className={`flex items-center gap-2 py-1 text-sm ${STATUS_CLASS[check.status]}`}
      >
        <span className="w-5 shrink-0">{STATUS_ICON[check.status]}</span>
        <span className="w-40 shrink-0 truncate font-medium" title={check.label}>
          {check.label}
        </span>
        <span className="w-24 shrink-0 font-mono text-xs">
          {formatPort(check)}
        </span>
        <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums">
          {formatLatency(check)}
        </span>
        <span className="truncate text-xs opacity-80" title={check.message}>
          {check.status === "pass" && processLabel
            ? processLabel
            : check.message}
        </span>
      </div>
      {isMisconfig && (
        <p className="pb-1 pl-7 text-xs text-muted-foreground/70">
          💡{" "}
          {check.detail ??
            `${check.protocol} protocol is disabled but the port is active.`}{" "}
          <button
            type="button"
            className="cursor-pointer underline hover:text-foreground"
            onClick={() => onEnableProtocol?.(check.protocol)}
          >
            Enable now?
          </button>
        </p>
      )}
      {isProblem && check.detail && !isMisconfig && (
        <p className="pb-1 pl-7 text-xs text-muted-foreground/70">
          💡 {check.detail}
        </p>
      )}
    </div>
  )
}

function buildPlainTextReport(serverName: string, result: ScanResult): string {
  const { summary } = result
  const lines: string[] = []
  lines.push(`=== Connection Test Results — ${serverName} ===`)
  lines.push(`Date: ${formatTimestamp(result.completedAt)}`)
  lines.push(
    `Result: ${summary.passed} passed, ${summary.failed} failed, ${summary.errors} error, ${summary.skipped} skipped`
  )
  lines.push("")
  for (const c of result.results) {
    const tag = c.status.toUpperCase()
    lines.push(
      `[${tag}] ${c.label.padEnd(22)} ${formatPort(c).padEnd(11)} ${formatLatency(c)}`
    )
    lines.push(`       ${c.message}`)
  }
  return lines.join("\n")
}

export function ConnectionTestModal({
  open,
  onOpenChange,
  serverName,
  result,
  running,
  onRerun,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  serverName: string
  result: ScanResult | null
  running: boolean
  onRerun: () => void
}) {
  const [copied, setCopied] = useState(false)

  const copyReport = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(
        buildPlainTextReport(serverName, result)
      )
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const summary = result?.summary
  const durationMs = result
    ? new Date(result.completedAt).getTime() -
      new Date(result.startedAt).getTime()
    : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Connection Test Results — {serverName}</DialogTitle>
        </DialogHeader>

        {summary && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm">
            <span>
              ✅ {summary.passed} passed&nbsp;&nbsp;❌ {summary.failed}{" "}
              failed&nbsp;&nbsp;⚠ {summary.errors} error&nbsp;&nbsp;⏭{" "}
              {summary.skipped} skipped
            </span>
            <span className="text-muted-foreground">
              {(durationMs / 1000).toFixed(1)}s
            </span>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {running && !result && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Running checks…
            </p>
          )}
          {result?.results.map((check) => (
            <CheckRow key={check.check} check={check} />
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={copyReport}
            disabled={!result || running}
          >
            {copied ? "Copied!" : "Copy Report"}
          </Button>
          <Button variant="secondary" onClick={onRerun} disabled={running}>
            {running ? "Running…" : "Re-run"}
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
