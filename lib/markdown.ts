/**
 * Portable lightweight Markdown -> HTML parser for Next.js SSR / Standalone runtime.
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

export function renderMarkdownToHtml(markdown: string): string {
  let htmlResult: string

  // If running in Bun runtime natively, use high-speed Bun.markdown.html
  if (
    typeof Bun !== "undefined" &&
    typeof (Bun as unknown as { markdown?: { html?: (s: string) => string } })
      .markdown?.html === "function"
  ) {
    htmlResult = (
      Bun as unknown as { markdown: { html: (s: string) => string } }
    ).markdown.html(markdown)
  } else {
    htmlResult = renderMarkdownFallback(markdown)
  }

  // Transform mermaid code blocks to pre.mermaid containers
  htmlResult = htmlResult.replace(
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/gi,
    (_match, code) =>
      `<div class="mermaid-container my-6 flex justify-center overflow-x-auto rounded-lg border border-border/50 bg-muted/20 p-4"><pre class="mermaid">${code}</pre></div>`
  )

  // Transform standard code blocks into modern Mac Terminal Cards with precision per-line rows & copy button
  htmlResult = htmlResult.replace(
    /<pre><code(?: class="language-([a-zA-Z0-9_-]+)")?>([\s\S]*?)<\/code><\/pre>/gi,
    (_match, lang, code) => {
      const displayLang = (lang || "code").toUpperCase()
      // Split code lines safely (code is already HTML-escaped by markdown parser)
      const lines = code.split(/\r?\n/)
      const displayLines =
        lines.length > 0 && lines[lines.length - 1] === ""
          ? lines.slice(0, -1)
          : lines
      const hasLineNumbers = displayLines.length >= 4

      let bodyContent: string
      if (hasLineNumbers) {
        const rows = displayLines
          .map((lineContent, i) => {
            const lineNum = i + 1
            const safeContent = lineContent === "" ? " " : lineContent
            return `<div class="code-line group/line flex items-baseline leading-[1.625rem] hover:bg-zinc-800/40"><span class="line-number select-none w-8 shrink-0 pr-3 text-right font-mono text-[11px] text-zinc-600 border-r border-zinc-800/80 group-hover/line:text-zinc-400">${lineNum}</span><span class="line-content pl-3 font-mono text-xs text-zinc-100 whitespace-pre">${safeContent}</span></div>`
          })
          .join("")
        bodyContent = `<div class="p-3 overflow-x-auto font-mono text-xs">${rows}</div>`
      } else {
        bodyContent = `<div class="p-4 overflow-x-auto font-mono text-xs leading-relaxed text-zinc-100"><pre class="m-0! p-0! bg-transparent! border-0! text-zinc-100 font-mono text-xs leading-relaxed overflow-visible!"><code>${code}</code></pre></div>`
      }

      return `<div class="code-window-wrapper group my-6 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl shadow-black/30"><div class="flex h-10 items-center justify-between border-b border-zinc-800/80 bg-zinc-900/90 px-3.5 select-none"><div class="flex items-center gap-3"><div class="flex items-center gap-1.5 pl-1 pr-1"><span class="size-2.5 rounded-full bg-red-500/80"></span><span class="size-2.5 rounded-full bg-amber-500/80"></span><span class="size-2.5 rounded-full bg-emerald-500/80"></span></div><span class="rounded-md border border-zinc-700/50 bg-zinc-800/80 px-2 py-0.5 font-mono text-[11px] font-medium text-zinc-300">${displayLang}</span></div><button type="button" class="code-copy-btn flex size-7 items-center justify-center rounded-lg border border-zinc-700/60 bg-zinc-800/80 text-zinc-300 transition-all hover:border-zinc-500 hover:bg-zinc-700 hover:text-white active:scale-90" aria-label="Salin kode" title="Salin kode"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 256 256"><path d="M216,40H88A16,16,0,0,0,72,56V72H56A16,16,0,0,0,40,88V216a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V200h16a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM184,216H56V88H184V216Zm32-32H200V88a16,16,0,0,0-16-16H88V56H216V184Z"></path></svg></button></div>${bodyContent}</div>`
    }
  )
  return htmlResult
}

/**
 * Pure-TypeScript fallback renderer used in Next.js Node/Turbopack runtime
 * where Bun.markdown is unavailable. Exported for unit-testing.
 */
export function renderMarkdownFallback(markdown: string): string {
  const lines = markdown.split(/\r?\n/)
  const html: string[] = []
  let inCodeBlock = false
  let codeBlockLang = ""
  let codeContent: string[] = []
  let inList = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Code block ```
    if (line.startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeBlockLang = line.slice(3).trim()
        codeContent = []
      } else {
        inCodeBlock = false
        const rawCode = codeContent.join("\n")
        if (codeBlockLang === "mermaid") {
          html.push(
            `<div class="mermaid-container my-6 flex justify-center overflow-x-auto rounded-lg border border-border/50 bg-muted/20 p-4"><pre class="mermaid">${escapeHtml(rawCode)}</pre></div>`
          )
        } else {
          const escaped = escapeHtml(rawCode)
          html.push(
            `<pre><code class="language-${codeBlockLang}">${escaped}</code></pre>`
          )
        }
      }
      continue
    }

    if (inCodeBlock) {
      codeContent.push(line)
      continue
    }

    // Close list if line is not a list item
    if (
      inList &&
      !line.trim().startsWith("- ") &&
      !line.trim().startsWith("* ") &&
      line.trim() !== ""
    ) {
      html.push("</ul>")
      inList = false
    }

    // Blank line
    if (line.trim() === "") {
      continue
    }

    // Horizontal rule ---
    if (/^---|^\*\*\*|^___$/.test(line.trim())) {
      html.push("<hr />")
      continue
    }

    // Headings
    const h1 = line.match(/^#\s+(.+)$/)
    if (h1) {
      html.push(`<h1>${formatInline(h1[1])}</h1>`)
      continue
    }
    const h2 = line.match(/^##\s+(.+)$/)
    if (h2) {
      html.push(`<h2>${formatInline(h2[1])}</h2>`)
      continue
    }
    const h3 = line.match(/^###\s+(.+)$/)
    if (h3) {
      html.push(`<h3>${formatInline(h3[1])}</h3>`)
      continue
    }
    const h4 = line.match(/^####\s+(.+)$/)
    if (h4) {
      html.push(`<h4>${formatInline(h4[1])}</h4>`)
      continue
    }

    // Blockquote
    if (line.startsWith("> ")) {
      html.push(
        `<blockquote><p>${formatInline(line.slice(2))}</p></blockquote>`
      )
      continue
    }

    // List item
    const listItem = line.match(/^[\s]*[-*]\s+(.+)$/)
    if (listItem) {
      if (!inList) {
        html.push("<ul>")
        inList = true
      }
      html.push(`<li>${formatInline(listItem[1])}</li>`)
      continue
    }

    // Regular paragraph
    html.push(`<p>${formatInline(line)}</p>`)
  }

  if (inList) {
    html.push("</ul>")
  }

  return html.join("\n")
}

function formatInline(text: string): string {
  return (
    text
      // Image ![alt](url)
      .replace(
        /!\[([^\]]*)\]\(([^)]+)\)/g,
        '<img src="$2" alt="$1" class="rounded-xl border shadow-md" />'
      )
      // Link [text](url)
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" class="text-emerald-500 hover:underline">$1</a>'
      )
      // Bold **text** or __text__
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_]+)__/g, "<strong>$1</strong>")
      // Italic *text* or _text_
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/_([^_]+)_/g, "<em>$1</em>")
      // Inline code `code`
      .replace(/`([^`]+)`/g, "<code>$1</code>")
  )
}
