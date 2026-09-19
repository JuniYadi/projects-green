"use client"

import {
  WhatsappLogo,
  Info,
  ArrowSquareOut,
  ChatText,
  Package,
} from "@phosphor-icons/react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"

export interface InteractiveRepliesToggleProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  lang?: string
}

export default function InteractiveRepliesToggle({
  checked,
  onCheckedChange,
  disabled = false,
  lang = "id",
}: InteractiveRepliesToggleProps) {
  const t =
    getMessagesForMaybeLocale(lang).console.aiAgents.interactiveReplies

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="allow-interactive-replies"
              className="cursor-pointer text-sm font-medium leading-none"
            >
              {t.title}
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={t.title}
                  >
                    <Info size={14} />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  {t.description}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-xs text-muted-foreground">{t.description}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <Badge
            variant={checked ? "secondary" : "outline"}
            className={
              checked
                ? "border-emerald-500/20 bg-emerald-500/10 text-[10px] " +
                  "text-emerald-600 dark:text-emerald-400"
                : "text-[10px] text-muted-foreground"
            }
          >
            {checked ? t.badgeEnabled : t.badgeDisabled}
          </Badge>
          <Switch
            id="allow-interactive-replies"
            checked={checked}
            onCheckedChange={onCheckedChange}
            disabled={disabled}
          />
        </div>
      </div>

      {/* WhatsApp Interactive Live Preview */}
      <div
        data-testid="interactive-replies-preview"
        className={`rounded-lg border border-border bg-zinc-950 p-3 ` +
          `text-white transition-opacity ${
            checked ? "opacity-100" : "opacity-50 grayscale"
          }`}
      >
        <div
          className={
            "mb-2.5 flex items-center justify-between border-b " +
            "border-zinc-800 pb-2"
          }
        >
          <div className="flex items-center gap-1.5">
            <WhatsappLogo
              size={16}
              className="text-emerald-500"
              weight="fill"
            />
            <span className="text-xs font-medium">{t.previewTitle}</span>
          </div>
          <span className="text-[10px] text-zinc-400">
            {t.previewSubtitle}
          </span>
        </div>

        <div
          className={
            "max-w-xs space-y-2 rounded-lg border border-zinc-800 " +
            "bg-zinc-900 p-2.5"
          }
        >
          <p className="text-xs leading-relaxed text-zinc-200">
            {t.mockMessage}
          </p>

          <div className="space-y-1.5 pt-1">
            <div
              className={
                "flex items-center justify-center gap-1.5 rounded-md " +
                "border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 " +
                "text-xs font-medium text-emerald-400"
              }
            >
              <ChatText size={13} />
              <span>{t.buttonAskProduct}</span>
            </div>

            <div
              className={
                "flex items-center justify-center gap-1.5 rounded-md " +
                "border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 " +
                "text-xs font-medium text-emerald-400"
              }
            >
              <Package size={13} />
              <span>{t.buttonCheckOrder}</span>
            </div>

            <div
              className={
                "flex items-center justify-center gap-1.5 rounded-md " +
                "border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 " +
                "text-xs font-medium text-blue-400"
              }
            >
              <ArrowSquareOut size={13} />
              <span>{t.buttonVisitWebsite}</span>
            </div>
          </div>
        </div>

        {!checked && (
          <p className="mt-2 text-[11px] italic text-zinc-400">
            {t.disabledHint}
          </p>
        )}
      </div>
    </div>
  )
}
