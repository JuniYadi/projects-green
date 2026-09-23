"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowRight, GitBranch } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { useParams } from "next/navigation"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
type SourceComposerProps = {
  onSubmit: (url: string) => void
  disabled?: boolean
  placeholder?: string
}

function SourceComposer({
  onSubmit,
  disabled = false,
  placeholder = "Paste a GitHub repository URL to deploy…",
}: SourceComposerProps) {
  const params = useParams<{ lang?: string }>()
  const t = getMessages(
    resolveLocaleOrDefault(params?.lang)
  ).pDeployAiFeedSourceComposer
  const [value, setValue] = useState("")

  const submit = () => {
    const trimmed = value.trim()
    if (trimmed && !disabled) onSubmit(trimmed)
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border border-border",
        "bg-background px-4 py-3 shadow-sm focus-within:ring-2",
        "focus-within:ring-ring"
      )}
    >
      <GitBranch className="h-5 w-5 shrink-0 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") submit()
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="h-auto flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={submit}
        disabled={disabled}
        aria-label={t.submitAriaLabel}
      >
        <ArrowRight />
      </Button>
    </div>
  )
}

export { SourceComposer }
export type { SourceComposerProps }
