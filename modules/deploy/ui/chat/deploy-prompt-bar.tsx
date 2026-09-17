"use client"

import { useState, type FormEvent } from "react"
import { PaperPlaneRight } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import { cn } from "@/lib/utils"

export const DEFAULT_PROMPT_SUGGESTIONS = [
  "Ganti port ke 8080",
  "Kenapa Medium tier?",
  "Deploy https://github.com/...",
]

export type DeployPromptBarProps = {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
  suggestions?: string[]
  lang?: string
  className?: string
}

export function DeployPromptBar({
  onSend,
  disabled = false,
  placeholder,
  suggestions = DEFAULT_PROMPT_SUGGESTIONS,
  lang = "en",
  className,
}: DeployPromptBarProps) {
  const messages = getMessagesForMaybeLocale(lang)
  const agentMessages = messages.console.app.deployAgent
  const effectivePlaceholder =
    placeholder ??
    (lang === "id"
      ? 'Ketik prompt (misal: "Ganti port ke 8080", "Deploy https://github.com/...")'
      : 'Type a prompt (e.g. "Change port to 8080", "Deploy https://github.com/...")')
  const [input, setInput] = useState("")

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setInput("")
  }

  const handleChipClick = (chip: string) => {
    if (disabled) return
    onSend(chip)
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="deploy-prompt-bar"
      className={cn("flex flex-col gap-2", className)}
    >
      {/* Quick Suggestion Chips */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-0.5">
          {suggestions.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={disabled}
              onClick={() => handleChipClick(chip)}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/80 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>{chip}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input Field & Send Action */}
      <div className="relative flex items-center rounded-xl border border-border bg-card p-1.5 shadow-xs transition-all focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          placeholder={effectivePlaceholder}
          disabled={disabled}
          className="border-0 bg-transparent text-sm shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
        />
        <Button
          type="submit"
          size="sm"
          disabled={disabled || !input.trim()}
          aria-label={agentMessages.sendPromptAriaLabel}
          className="shrink-0 gap-1.5 rounded-lg bg-primary px-3 text-primary-foreground shadow-xs hover:bg-primary/90"
        >
          <PaperPlaneRight className="h-4 w-4" weight="fill" />
          <span className="hidden sm:inline">
            {agentMessages.sendPromptBtn}
          </span>
        </Button>
      </div>
    </form>
  )
}
