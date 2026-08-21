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
