"use client"

import * as React from "react"
import { useState, useRef, useImperativeHandle } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type MarkdownEditorProps = {
  id?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  rows?: number
  defaultValue?: string
}

export const MarkdownEditor = React.forwardRef<HTMLTextAreaElement, MarkdownEditorProps>(
  ({ id, placeholder, disabled, className, rows = 5, defaultValue = "" }, forwardedRef) => {
    const localRef = useRef<HTMLTextAreaElement>(null)
    useImperativeHandle(forwardedRef, () => localRef.current!)

    const [activeTab, setActiveTab] = useState<"write" | "preview">("write")
    const [previewHtml, setPreviewHtml] = useState<string>("")
    const [isLoading, setIsLoading] = useState(false)

    const handleTabChange = async (tab: "write" | "preview") => {
      setActiveTab(tab)
      if (tab === "preview") {
        const markdown = localRef.current?.value || ""
        setIsLoading(true)
        try {
          const response = await fetch("/api/support-tickets/preview", {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({ markdown }),
          })
          const data = await response.json()
          if (data.ok) {
            setPreviewHtml(data.html)
          } else {
            setPreviewHtml("<p class='text-destructive'>Error loading preview</p>")
          }
        } catch {
          setPreviewHtml("<p class='text-destructive'>Error connecting to server</p>")
        } finally {
          setIsLoading(false)
        }
      }
    }

    const handleToolbarClick = (syntax: "bold" | "italic" | "code" | "link" | "list") => {
      const textarea = localRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = textarea.value
      const selectedText = text.substring(start, end)

      let replacement = ""
      let selectionOffsetStart = start
      let selectionOffsetEnd = end

      switch (syntax) {
        case "bold":
          replacement = `**${selectedText || "bold text"}**`
          selectionOffsetStart += 2
          selectionOffsetEnd = selectionOffsetStart + (selectedText || "bold text").length
          break
        case "italic":
          replacement = `*${selectedText || "italic text"}*`
          selectionOffsetStart += 1
          selectionOffsetEnd = selectionOffsetStart + (selectedText || "italic text").length
          break
        case "code":
          if (selectedText.includes("\n")) {
            replacement = `\n\`\`\`\n${selectedText || "code block"}\n\`\`\`\n`
            selectionOffsetStart += 5
            selectionOffsetEnd = selectionOffsetStart + (selectedText || "code block").length
          } else {
            replacement = `\`${selectedText || "code"}\``
            selectionOffsetStart += 1
            selectionOffsetEnd = selectionOffsetStart + (selectedText || "code").length
          }
          break
        case "link":
          replacement = `[${selectedText || "link text"}](https://)`
          selectionOffsetStart += 1
          selectionOffsetEnd = selectionOffsetStart + (selectedText || "link text").length
          break
        case "list":
          replacement = `\n- ${selectedText || "list item"}`
          selectionOffsetStart += 3
          selectionOffsetEnd = selectionOffsetStart + (selectedText || "list item").length
          break
      }

      textarea.value = text.substring(0, start) + replacement + text.substring(end)
      textarea.focus()
      textarea.setSelectionRange(selectionOffsetStart, selectionOffsetEnd)

      // Trigger change event to keep frameworks or DOM tracking up to date
      const event = new Event("input", { bubbles: true })
      textarea.dispatchEvent(event)
    }

    return (
      <div className="flex flex-col rounded-lg border border-white/[0.08] bg-neutral-900/20 overflow-hidden w-full">
        {/* Editor Tabs Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] bg-neutral-950/40 px-3 py-1.5">
          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleTabChange("write")}
              className={`h-7 px-3 text-xs rounded-md transition-all ${
                activeTab === "write"
                  ? "bg-white/[0.08] text-white"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              Write
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleTabChange("preview")}
              className={`h-7 px-3 text-xs rounded-md transition-all ${
                activeTab === "preview"
                  ? "bg-white/[0.08] text-white"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              Preview
            </Button>
          </div>

          {/* Formatting Toolbar - only in Write mode */}
          {activeTab === "write" && (
            <div className="flex items-center gap-1 border-l border-white/[0.08] pl-2 ml-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleToolbarClick("bold")}
                title="Bold"
                className="h-6 w-6 text-muted-foreground hover:text-white hover:bg-white/[0.04]"
                disabled={disabled}
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 256 256">
                  <path d="M156,128a52,52,0,0,0,24-44,48,48,0,0,0-48-48H72a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8h68a52,52,0,0,0,16-100ZM80,52h52a32,32,0,0,1,0,64H80Zm60,156H80V132h60a36,36,0,0,1,0,72Z" />
                </svg>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleToolbarClick("italic")}
                title="Italic"
                className="h-6 w-6 text-muted-foreground hover:text-white hover:bg-white/[0.04]"
                disabled={disabled}
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 256 256">
                  <path d="M200,56a8,8,0,0,1-8,8H162.77L117.11,192H144a8,8,0,0,1,0,16H64a8,8,0,0,1,0-16H93.23l45.66-128H112a8,8,0,0,1,0-16h80A8,8,0,0,1,200,56Z" />
                </svg>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleToolbarClick("code")}
                title="Code"
                className="h-6 w-6 text-muted-foreground hover:text-white hover:bg-white/[0.04]"
                disabled={disabled}
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 256 256">
                  <path d="M72.24,181.76a8,8,0,0,1-11.31,11.31l-48-48a8,8,0,0,1,0-11.31l48-48a8,8,0,0,1,11.31,11.31L32,144ZM243.07,138.34l-48-48a8,8,0,0,0-11.31,11.31L224,144l-40.24,40.24a8,8,0,1,0,11.31,11.31l48-48A8,8,0,0,0,243.07,138.34ZM162.17,40.48a8,8,0,0,0-10.31,4.7l-64,160a8,8,0,0,0,4.7,10.31,8.19,8.19,0,0,0,2.8.5,8,8,0,0,0,7.51-5.2l64-160A8,8,0,0,0,162.17,40.48Z" />
                </svg>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleToolbarClick("link")}
                title="Link"
                className="h-6 w-6 text-muted-foreground hover:text-white hover:bg-white/[0.04]"
                disabled={disabled}
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 256 256">
                  <path d="M129.74,126.26a8,8,0,0,1,0,11.31l-24,24a36,36,0,0,1-50.91-50.91l24-24a8,8,0,0,1,11.31,11.31l-24,24a20,20,0,0,0,28.29,28.29l24-24A8,8,0,0,1,129.74,126.26ZM201.17,54.83a36,36,0,0,0-50.91,0l-24,24a8,8,0,0,0,11.31,11.31l24-24a20,20,0,0,1,28.29,28.29l-24,24a8,8,0,0,0,11.31,11.31l24-24A36,36,0,0,0,201.17,54.83Z" />
                </svg>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleToolbarClick("list")}
                title="Bullet List"
                className="h-6 w-6 text-muted-foreground hover:text-white hover:bg-white/[0.04]"
                disabled={disabled}
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 256 256">
                  <path d="M80,64a8,8,0,0,1,8-8H216a8,8,0,0,1,0,16H88A8,8,0,0,1,80,64Zm136,56H88a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Zm0,64H88a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16ZM44,52A12,12,0,1,0,56,64,12,12,0,0,0,44,52Zm0,64A12,12,0,1,0,56,128,12,12,0,0,0,44,116Zm0,64A12,12,0,1,0,56,192,12,12,0,0,0,44,180Z" />
                </svg>
              </Button>
            </div>
          )}
        </div>

        {/* Content Pane */}
        <div className="flex-1 bg-transparent p-0.5">
          <div className={activeTab === "write" ? "block" : "hidden"}>
            <Textarea
              id={id}
              ref={localRef}
              rows={rows}
              placeholder={placeholder}
              disabled={disabled}
              defaultValue={defaultValue}
              className={`w-full min-h-[120px] bg-transparent border-0 ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-white rounded-none p-3 resize-y ${className}`}
            />
          </div>
          {activeTab === "preview" && (
            <div className="p-3.5 min-h-[120px] overflow-y-auto max-h-[400px] border-0 rounded-none bg-neutral-900/10">
              {isLoading ? (
                <div className="flex flex-col gap-2.5 animate-pulse">
                  <div className="h-4 bg-white/10 rounded w-1/3"></div>
                  <div className="h-3 bg-white/10 rounded w-full"></div>
                  <div className="h-3 bg-white/10 rounded w-5/6"></div>
                  <div className="h-3 bg-white/10 rounded w-2/3"></div>
                </div>
              ) : (
                <div
                  className="text-white/80 text-sm space-y-3 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-white/95 [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-white/95 [&_h2]:mt-3 [&_h2]:mb-2 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_code]:bg-white/15 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_pre]:bg-neutral-900/80 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_a]:text-primary [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: previewHtml || "<p class='text-muted-foreground italic text-xs'>Nothing to preview</p>" }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    )
  }
)

MarkdownEditor.displayName = "MarkdownEditor"
