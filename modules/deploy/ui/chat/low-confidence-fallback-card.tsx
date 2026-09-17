"use client"

import { useState } from "react"
import { Check, Question, X } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import { cn } from "@/lib/utils"

export type LowConfidenceOverrides = {
  runtime: string
  startCommand: string
  port: number
}

export type LowConfidenceFallbackCardProps = {
  confidence?: number
  detectedFile?: string
  initialRuntime?: string
  initialStartCommand?: string
  initialPort?: number
  onApplyOverrides: (overrides: LowConfidenceOverrides) => void
  onCancel?: () => void
  lang?: string
  className?: string
}

const RUNTIME_OPTIONS = [
  { value: "Node.js 20", label: "Node.js 20" },
  { value: "Node.js 22", label: "Node.js 22" },
  { value: "Python 3.11", label: "Python 3.11" },
  { value: "Python 3.12", label: "Python 3.12" },
  { value: "Go 1.22", label: "Go 1.22" },
  { value: "PHP 8.2", label: "PHP 8.2" },
  { value: "Ruby 3.2", label: "Ruby 3.2" },
  { value: "Rust 1.78", label: "Rust 1.78" },
  { value: "Dockerfile", label: "Dockerfile Custom" },
]

export function LowConfidenceFallbackCard({
  confidence = 42,
  detectedFile = "JavaScript (server.js)",
  initialRuntime = "Node.js 20",
  initialStartCommand = "node server.js",
  initialPort = 3000,
  onApplyOverrides,
  onCancel,
  lang = "id",
  className,
}: LowConfidenceFallbackCardProps) {
  const isId = lang === "id"
  const messages = getMessagesForMaybeLocale(lang)
  const agentMessages = messages.console.app.deployAgent
  const [runtime, setRuntime] = useState(initialRuntime)
  const [startCommand, setStartCommand] = useState(initialStartCommand)
  const [port, setPort] = useState<string>(String(initialPort))

  const handleSubmit = () => {
    const parsedPort = parseInt(port, 10)
    onApplyOverrides({
      runtime,
      startCommand: startCommand.trim() || "node server.js",
      port: isNaN(parsedPort) ? 3000 : parsedPort,
    })
  }

  return (
    <div
      data-testid="low-confidence-fallback-card"
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-amber-500/30 bg-card p-5 shadow-xs transition-all",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-3">
        <Question className="h-5 w-5 shrink-0 text-amber-500" weight="bold" />
        <h2 className="text-xs font-bold tracking-wider text-foreground uppercase sm:text-sm">
          {agentMessages.lowConfidenceHeader.replace(
            "{confidence}",
            String(confidence)
          )}
        </h2>
      </div>

      {/* Explanatory Copy */}
      <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:text-sm">
        <p>
          {agentMessages.lowConfidenceDetected.replace("{file}", detectedFile)}
        </p>
        <p>{agentMessages.lowConfidenceInstructions}</p>
      </div>

      {/* Pilihan Cepat Form */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 p-4 text-xs sm:text-sm">
        <span className="font-semibold text-foreground">
          {agentMessages.quickPicksForm}
        </span>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Runtime */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="fallback-runtime-select"
              className="font-medium text-muted-foreground"
            >
              {agentMessages.runtimeLabelField}
            </label>
            <Select value={runtime} onValueChange={setRuntime}>
              <SelectTrigger
                id="fallback-runtime-select"
                data-testid="fallback-runtime-select"
                className="h-9 text-xs"
              >
                <SelectValue
                  placeholder={isId ? "Pilih Runtime" : "Select Runtime"}
                />
              </SelectTrigger>
              <SelectContent>
                {RUNTIME_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="text-xs"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start Command */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="fallback-start-command-input"
              className="font-medium text-muted-foreground"
            >
              {agentMessages.startCommandField}
            </label>
            <Input
              id="fallback-start-command-input"
              data-testid="fallback-start-command-input"
              type="text"
              placeholder={agentMessages.startCommandPlaceholder}
              value={startCommand}
              onChange={(e) => setStartCommand(e.target.value)}
              className="h-9 font-mono text-xs"
            />
          </div>

          {/* Listen Port */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="fallback-port-input"
              className="font-medium text-muted-foreground"
            >
              {agentMessages.listenPortField}
            </label>
            <Input
              id="fallback-port-input"
              data-testid="fallback-port-input"
              type="number"
              placeholder="3000"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="h-9 font-mono text-xs"
            />
          </div>
        </div>
      </div>

      {/* Action Row */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        <Button
          type="button"
          data-testid="fallback-save-btn"
          onClick={handleSubmit}
          className="h-9 gap-1.5 bg-primary text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
        >
          <Check className="h-4 w-4" weight="bold" />
          <span>{agentMessages.saveGenerateBlueprint}</span>
        </Button>

        {onCancel && (
          <Button
            type="button"
            variant="outline"
            data-testid="fallback-cancel-btn"
            onClick={onCancel}
            className="h-9 gap-1.5 border-border bg-background text-xs font-medium text-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
            <span>{agentMessages.cancelChangeRepo}</span>
          </Button>
        )}
      </div>
    </div>
  )
}
