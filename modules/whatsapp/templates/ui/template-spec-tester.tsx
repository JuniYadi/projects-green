/**
 * Template Spec & Tester Component
 *
 * Provides a structured, interactive breakdown of the WhatsApp template:
 * - Language selector
 * - Header specification
 * - Body text with live interactive variable inputs
 * - Footer specification
 * - Button & CTA action breakdown
 */

"use client"
import { WhatsAppText } from "@/modules/whatsapp/ui/whatsapp-text"

import * as React from "react"
import { Sparkle } from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { WhatsAppTemplateLanguage } from "@/lib/api/whatsapp-client"
import type { TemplatePreviewValues } from "./template-preview"
import {
  getTemplatePlaceholderIndexes,
  getLanguageDisplay,
  WhatsAppFormattedText,
} from "./template-preview"

type TemplateSpecTesterProps = {
  languages: WhatsAppTemplateLanguage[]
  selectedLang: string
  onSelectLang: (lang: string) => void
  variableValues: TemplatePreviewValues
  onVariableChange: (index: number, value: string) => void
}

export function TemplateSpecTester({
  languages,
  selectedLang,
  onSelectLang,
  variableValues,
  onVariableChange,
}: TemplateSpecTesterProps) {
  const currentLanguage =
    languages.find((l) => l.lang === selectedLang) || languages[0]

  const placeholderIndexes = React.useMemo(
    () => getTemplatePlaceholderIndexes(currentLanguage?.body),
    [currentLanguage?.body]
  )

  if (!currentLanguage) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        <WhatsAppText id="s282" />
      </div>
    )
  }

  const buttons = Array.isArray(currentLanguage.buttons)
    ? currentLanguage.buttons
    : []

  return (
    <div className="space-y-5">
      {/* Language Switcher */}
      {languages.length > 1 && (
        <div className="flex items-center justify-between rounded-lg border bg-card p-3 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Active Language:
            </span>
            <Badge variant="outline" className="font-mono text-xs">
              {currentLanguage.lang}
            </Badge>
          </div>
          <Select value={selectedLang} onValueChange={onSelectLang}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map((l) => {
                const info = getLanguageDisplay(l.lang)
                return (
                  <SelectItem key={l.id} value={l.lang} className="text-xs">
                    <span className="mr-1.5">{info.flag || "🌐"}</span>
                    {info.label} ({l.lang})
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 1. Header Spec */}
      <div className="rounded-lg border bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <div className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
              1
            </span>
            <span className="text-xs font-semibold tracking-wider text-foreground uppercase">
              <WhatsAppText id="s283" />
            </span>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            {currentLanguage.headerType ?? "NONE"}
          </Badge>
        </div>

        <div className="pt-3 text-xs">
          {!currentLanguage.headerType ||
          currentLanguage.headerType === "NONE" ? (
            <p className="text-muted-foreground">
              <WhatsAppText id="s284" />
            </p>
          ) : (
            <div className="space-y-1.5">
              {currentLanguage.headerText && (
                <div className="rounded bg-muted/50 p-2 font-mono text-xs text-foreground">
                  {currentLanguage.headerText}
                </div>
              )}
              {currentLanguage.headerUrl && (
                <p className="truncate text-muted-foreground">
                  Media URL: {currentLanguage.headerUrl}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Body Spec & Dynamic Variable Tester */}
      <div className="rounded-lg border bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <div className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
              2
            </span>
            <span className="text-xs font-semibold tracking-wider text-foreground uppercase">
              <WhatsAppText id="s285" />
            </span>
          </div>
          <Badge
            variant={placeholderIndexes.length > 0 ? "default" : "outline"}
            className="text-[10px]"
          >
            {placeholderIndexes.length > 0
              ? `${placeholderIndexes.length} Required Variable(s)`
              : "Static Text"}
          </Badge>
        </div>

        <div className="space-y-3 pt-3">
          {/* Template Raw Text */}
          <div>
            <Label className="text-[11px] text-muted-foreground">
              <WhatsAppText id="s286" />
            </Label>
            <div className="mt-1 rounded-md bg-muted/40 p-2.5 font-mono text-xs leading-relaxed text-foreground">
              <WhatsAppFormattedText text={currentLanguage.body ?? ""} />
            </div>
          </div>

          {/* Interactive Variable Inputs */}
          {placeholderIndexes.length > 0 ? (
            <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center gap-1.5">
                <Sparkle weight="fill" className="size-3.5 text-primary" />
                <span className="text-xs font-medium text-foreground">
                  <WhatsAppText id="s287" />
                </span>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {placeholderIndexes.map((idx) => (
                  <div key={idx} className="space-y-1">
                    <Label className="font-mono text-[11px] text-primary">
                      Variable {"{{" + idx + "}}"}
                    </Label>
                    <Input
                      value={variableValues[idx] || ""}
                      onChange={(e) => onVariableChange(idx, e.target.value)}
                      placeholder={`e.g. Value for {{${idx}}}`}
                      className="h-8 bg-background font-mono text-xs"
                    />
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                <WhatsAppText id="s288" />
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              <WhatsAppText id="s289" />
            </p>
          )}
        </div>
      </div>

      {/* 3. Footer Spec */}
      <div className="rounded-lg border bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <div className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
              3
            </span>
            <span className="text-xs font-semibold tracking-wider text-foreground uppercase">
              Footer Component
            </span>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {currentLanguage.footer ? "Static Footer" : "None"}
          </Badge>
        </div>

        <div className="pt-3 text-xs">
          {currentLanguage.footer ? (
            <div className="rounded bg-muted/40 p-2 font-mono text-muted-foreground">
              {currentLanguage.footer}
            </div>
          ) : (
            <p className="text-muted-foreground">
              <WhatsAppText id="s290" />
            </p>
          )}
        </div>
      </div>

      {/* 4. Buttons Spec */}
      <div className="rounded-lg border bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <div className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
              4
            </span>
            <span className="text-xs font-semibold tracking-wider text-foreground uppercase">
              <WhatsAppText id="s291" />
            </span>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {buttons.length} Button(s)
          </Badge>
        </div>

        <div className="space-y-2 pt-3 text-xs">
          {buttons.length === 0 ? (
            <p className="text-muted-foreground">
              <WhatsAppText id="s292" />
            </p>
          ) : (
            buttons.map((btn, i) => {
              const b = btn as Record<string, unknown>
              const type = String(b.type ?? "ACTION")
              const text =
                typeof b.text === "string"
                  ? b.text
                  : typeof (b.cta_url as Record<string, unknown>)
                        ?.display_text === "string"
                    ? String(
                        (b.cta_url as Record<string, unknown>).display_text
                      )
                    : type

              return (
                <div
                  key={i}
                  className="flex items-center justify-between rounded border bg-muted/30 p-2.5"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-foreground">
                      {text}
                    </span>
                    {typeof b.url === "string" && (
                      <p className="max-w-xs truncate font-mono text-[11px] text-muted-foreground">
                        URL: {b.url}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {type}
                  </Badge>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
