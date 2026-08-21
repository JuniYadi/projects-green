"use client"

import React, { useMemo } from "react"
import Link from "next/link"
import { ArrowSquareOut } from "@phosphor-icons/react"

interface ChatMarkdownProps {
  content: string
  activeLocale: "id" | "en"
}

/**
 * Tokenizer & Renderer for Chat Markdown:
 * Supports bold (**text**), inline code (`code`), links ([text](url)),
 * images (![alt](src)), lists (- / 1.), code blocks (```), and blockquotes.
 */
export function ChatMarkdown({ content, activeLocale }: ChatMarkdownProps) {
  const renderedElements = useMemo(() => {
    if (!content) return null

    // Split content into blocks by code blocks first
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g
    const parts: Array<{ type: "code" | "text"; lang?: string; text: string }> =
      []
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          text: content.slice(lastIndex, match.index),
        })
      }
      parts.push({
        type: "code",
        lang: match[1] || "",
        text: match[2] || "",
      })
      lastIndex = match.index + match[0].length
    }

    if (lastIndex < content.length) {
      parts.push({
        type: "text",
        text: content.slice(lastIndex),
      })
    }

    return parts.map((part, partIdx) => {
      if (part.type === "code") {
        return (
          <div
            key={partIdx}
            className="my-2.5 overflow-hidden rounded-xl border border-white/10 bg-neutral-950 font-mono text-[11px]"
          >
            {part.lang ? (
              <div className="border-b border-white/[0.06] bg-neutral-900/60 px-3 py-1 text-[10px] text-zinc-400 uppercase">
                {part.lang}
              </div>
            ) : null}
            <pre className="overflow-x-auto p-3 text-zinc-200">
              <code>{part.text}</code>
            </pre>
          </div>
        )
      }

      // Process regular text line by line
      const lines = part.text.split("\n")
      const elements: React.ReactNode[] = []
      let listBuffer: Array<{ num?: string; text: string }> = []
      let listType: "ul" | "ol" | null = null

      const flushList = () => {
        if (!listType || listBuffer.length === 0) return

        const currentBuffer = [...listBuffer]
        const currentType = listType
        const listKey = `list_${elements.length}`

        if (currentType === "ol") {
          elements.push(
            <ol
              key={listKey}
              className="my-2 list-decimal space-y-1.5 pl-5 text-zinc-200"
            >
              {currentBuffer.map((item, idx) => (
                <li key={idx} className="leading-relaxed">
                  {renderInlineMarkdown(item.text, activeLocale)}
                </li>
              ))}
            </ol>
          )
        } else {
          elements.push(
            <ul
              key={listKey}
              className="my-2 list-disc space-y-1.5 pl-5 text-zinc-200"
            >
              {currentBuffer.map((item, idx) => (
                <li key={idx} className="leading-relaxed">
                  {renderInlineMarkdown(item.text, activeLocale)}
                </li>
              ))}
            </ul>
          )
        }

        listBuffer = []
        listType = null
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        const trimmed = line.trim()

        if (!trimmed) {
          flushList()
          elements.push(<div key={`blank_${i}`} className="h-1.5" />)
          continue
        }

        // Ordered list (e.g. "1. Step")
        const olMatch = line.match(/^(\d+)\.\s+(.*)$/)
        if (olMatch && olMatch[2]) {
          if (listType !== "ol") flushList()
          listType = "ol"
          listBuffer.push({ num: olMatch[1], text: olMatch[2] })
          continue
        }

        // Unordered list (e.g. "- Item" or "* Item")
        const ulMatch = line.match(/^[-*]\s+(.*)$/)
        if (ulMatch && ulMatch[1]) {
          if (listType !== "ul") flushList()
          listType = "ul"
          listBuffer.push({ text: ulMatch[1] })
          continue
        }

        // Headings
        if (line.startsWith("### ")) {
          flushList()
          elements.push(
            <h4
              key={`h3_${i}`}
              className="mt-3 mb-1.5 text-xs font-bold tracking-tight text-white"
            >
              {renderInlineMarkdown(line.slice(4), activeLocale)}
            </h4>
          )
          continue
        }
        if (line.startsWith("## ")) {
          flushList()
          elements.push(
            <h3
              key={`h2_${i}`}
              className="mt-3.5 mb-1.5 text-sm font-bold tracking-tight text-white"
            >
              {renderInlineMarkdown(line.slice(3), activeLocale)}
            </h3>
          )
          continue
        }

        // Regular paragraph line
        flushList()
        elements.push(
          <p key={`p_${i}`} className="leading-relaxed">
            {renderInlineMarkdown(line, activeLocale)}
          </p>
        )
      }

      flushList()
      return (
        <div key={partIdx} className="space-y-1">
          {elements}
        </div>
      )
    })
  }, [content, activeLocale])

  return (
    <div className="text-xs leading-relaxed text-zinc-200">
      {renderedElements}
    </div>
  )
}

/**
 * Render inline markdown tokens: Images, Links, Bold, Inline code, and Plain text
 */
function renderInlineMarkdown(
  text: string,
  activeLocale: "id" | "en"
): React.ReactNode[] {
  // Regex matches:
  // 1. Image: !\[(.*?)\]\((.*?)\)
  // 2. Link: \[([^[\]]+)\]\(([^)]+)\)
  // 3. Bold: \*\*(.*?)\*\*
  // 4. Code: `([^`]+)`
  // 5. Bare URL: (https?:\/\/[^\s]+)
  const tokenRegex =
    /(!\[([^\]]*)\]\(([^)]+)\))|(\[([^[\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)|(`([^`]+)`)|(https?:\/\/[^\s]+)/g

  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    const [
      fullMatch,
      isImg,
      imgAlt,
      imgSrc,
      isLink,
      linkText,
      linkHref,
      isBold,
      boldText,
      isCode,
      codeText,
      bareUrl,
    ] = match

    if (isImg && imgSrc) {
      nodes.push(
        <span key={match.index} className="my-2 block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt={imgAlt || "Screenshot tutorial"}
            className="max-h-64 rounded-xl border border-white/10 bg-neutral-900 object-contain shadow-lg"
            loading="lazy"
          />
        </span>
      )
    } else if (isLink && linkHref && linkText) {
      const normalizedHref = normalizeHref(linkHref, activeLocale)
      const isExternal =
        linkHref.startsWith("http://") || linkHref.startsWith("https://")

      nodes.push(
        <Link
          key={match.index}
          href={normalizedHref}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          className="inline-flex items-center gap-0.5 font-semibold text-amber-400 underline decoration-amber-400/50 underline-offset-2 transition-colors hover:text-amber-300 hover:decoration-amber-300"
        >
          <span>{linkText}</span>
          <ArrowSquareOut size={11} className="inline opacity-80" />
        </Link>
      )
    } else if (isBold && boldText) {
      nodes.push(
        <strong key={match.index} className="font-bold text-white">
          {boldText}
        </strong>
      )
    } else if (isCode && codeText) {
      nodes.push(
        <code
          key={match.index}
          className="rounded bg-neutral-800/80 px-1.5 py-0.5 font-mono text-[11px] text-amber-300"
        >
          {codeText}
        </code>
      )
    } else if (bareUrl) {
      nodes.push(
        <a
          key={match.index}
          href={bareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 font-semibold text-amber-400 underline decoration-amber-400/50 underline-offset-2 transition-colors hover:text-amber-300"
        >
          <span>{bareUrl}</span>
          <ArrowSquareOut size={11} className="inline opacity-80" />
        </a>
      )
    } else {
      nodes.push(fullMatch)
    }

    lastIndex = match.index + fullMatch.length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

function normalizeHref(href: string, activeLocale: "id" | "en"): string {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href
  }

  const clean = href.startsWith("/") ? href : `/${href}`

  // If href doesn't have locale prefix (e.g. /console/billing/topup or /docs/billing), prefix with activeLocale
  if (!clean.startsWith("/id/") && !clean.startsWith("/en/")) {
    return `/${activeLocale}${clean}`
  }

  return clean
}
