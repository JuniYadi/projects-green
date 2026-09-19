import { createHash } from "node:crypto"

export type CrawlMode = "SINGLE_PAGE" | "SUBPATH_RECURSIVE"

export type CrawlOptions = {
  crawlMode?: CrawlMode
  maxPages?: number
  maxDepth?: number
  timeoutMs?: number
  fetchFn?: typeof fetch
}

export type CrawledPage = {
  url: string
  title: string
  contentMarkdown: string
  contentHash: string
}

export type CrawlResult = {
  title: string
  contentMarkdown: string
  contentHash: string
  pageCount: number
  pages: CrawledPage[]
}

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; PFNAppGreenCrawler/1.0; +https://pfnapp.com/bot)"
const DEFAULT_TIMEOUT_MS = 10000
const MAX_PAGES_LIMIT = 50
const MAX_DEPTH_LIMIT = 2

/**
 * Checks whether hostname is a private, reserved, or loopback address.
 */
export function isPrivateOrReservedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim()

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0"
  ) {
    return true
  }

  // IPv4 check
  const ipv4Match = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (ipv4Match) {
    const octets = ipv4Match.slice(1, 5).map(Number)
    const [o1, o2] = octets

    if (octets.some((o) => o < 0 || o > 255)) return true
    if (o1 === 0) return true
    if (o1 === 10) return true
    if (o1 === 127) return true
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true
    if (o1 === 192 && o2 === 168) return true
    if (o1 === 169 && o2 === 254) return true
    if (o1 === 100 && o2 >= 64 && o2 <= 127) return true
    return false
  }

  // IPv6 check
  const cleanIpv6 = host.replace(/^\[|\]$/g, "")
  if (
    cleanIpv6 === "::1" ||
    cleanIpv6 === "::" ||
    cleanIpv6.startsWith("fe80:") ||
    cleanIpv6.startsWith("fc") ||
    cleanIpv6.startsWith("fd")
  ) {
    return true
  }

  return false
}

/**
 * Asserts URL is well-formed, HTTP(S), and not pointing to private/internal.
 */
export function assertAllowedUrl(targetUrl: string): URL {
  let parsed: URL
  try {
    parsed = new URL(targetUrl)
  } catch {
    throw new Error(`INVALID_URL: Failed to parse URL "${targetUrl}"`)
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `SSRF_BLOCKED: Protocol "${parsed.protocol}" is not allowed`
    )
  }

  if (isPrivateOrReservedHost(parsed.hostname)) {
    throw new Error(
      `SSRF_BLOCKED: Host "${parsed.hostname}" is private or reserved`
    )
  }

  return parsed
}

/**
 * Computes SHA-256 hash of content string.
 */
export function computeContentHash(content: string): string {
  return createHash("sha256").update(content.trim()).digest("hex")
}

/**
 * Determines whether document needs updating based on content hash.
 */
export function shouldUpdateDocument(
  existingHash: string | null | undefined,
  newHash: string
): boolean {
  if (!existingHash) return true
  return existingHash !== newHash
}

/**
 * Strips HTML boilerplate and extracts semantic content.
 */
export function stripHtmlBoilerplate(html: string): {
  title: string
  cleanedHtml: string
} {
  // Extract <title> if present
  let title = ""
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].replace(/<[^>]+>/g, "").trim()
  }

  // 1. Remove non-content tags completely
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "")
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, "")
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "")
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, "")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")

  // 2. Remove cookie banners & consent notices
  text = text.replace(
    new RegExp(
      '<div[^>]*class="[^"]*(cookie|consent|banner)[^"]*"[^>]*>' +
        "[\\s\\S]*?<\\/div>",
      "gi"
    ),
    ""
  )

  // 3. Target semantic containers (<main>, <article>, <body>)
  const mainMatch = text.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)
  const articleMatch = text.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)
  const bodyMatch = text.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)

  const containerContent =
    mainMatch?.[1] || articleMatch?.[1] || bodyMatch?.[1] || text

  // If title was not found in <title>, fallback to first <h1>
  if (!title) {
    const h1Match = containerContent.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)
    if (h1Match && h1Match[1]) {
      title = h1Match[1].replace(/<[^>]+>/g, "").trim()
    }
  }

  return {
    title: title || "Web Page",
    cleanedHtml: containerContent,
  }
}

/**
 * Decodes standard HTML entities.
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
}

/**
 * Converts sanitized HTML content into structured Markdown.
 */
export function htmlToMarkdown(html: string): string {
  let md = html

  // Tables
  md = md.replace(
    /<table\b[^>]*>([\s\S]*?)<\/table>/gi,
    (_tableMatch, tableContent: string) => {
      const rows: string[][] = []
      const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi
      let trMatch: RegExpExecArray | null

      while ((trMatch = trRegex.exec(tableContent)) !== null) {
        const rowCells: string[] = []
        const cellRegex = /<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi
        let cellMatch: RegExpExecArray | null
        while ((cellMatch = cellRegex.exec(trMatch[1])) !== null) {
          const text = cellMatch[1].replace(/<[^>]+>/g, "").trim()
          rowCells.push(text)
        }
        if (rowCells.length > 0) {
          rows.push(rowCells)
        }
      }

      if (rows.length === 0) return ""

      const colCount = Math.max(...rows.map((r) => r.length))
      const headerRow = rows[0]
      const headerLine =
        "| " +
        Array.from({ length: colCount }, (_, i) => headerRow[i] || "").join(
          " | "
        ) +
        " |"
      const separatorLine =
        "| " + Array.from({ length: colCount }, () => "---").join(" | ") + " |"

      const dataLines = rows.slice(1).map((row) => {
        return (
          "| " +
          Array.from({ length: colCount }, (_, i) => row[i] || "").join(
            " | "
          ) +
          " |"
        )
      })

      return [headerLine, separatorLine, ...dataLines].join("\n") + "\n\n"
    }
  )

  // Code blocks: <pre><code>...</code></pre>
  md = md.replace(
    /<pre\b[^>]*><code\b[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
    (_m, code: string) => {
      return "\n```\n" + decodeHtmlEntities(code).trim() + "\n```\n\n"
    }
  )
  md = md.replace(
    /<pre\b[^>]*>([\s\S]*?)<\/pre>/gi,
    (_m, code: string) => {
      return "\n```\n" + decodeHtmlEntities(code).trim() + "\n```\n\n"
    }
  )
  md = md.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_m, code: string) => {
    return "`" + decodeHtmlEntities(code).trim() + "`"
  })

  // Headings
  md = md.replace(
    /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi,
    (_m, c: string) => `\n# ${c.trim()}\n\n`
  )
  md = md.replace(
    /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi,
    (_m, c: string) => `\n## ${c.trim()}\n\n`
  )
  md = md.replace(
    /<h3\b[^>]*>([\s\S]*?)<\/h3>/gi,
    (_m, c: string) => `\n### ${c.trim()}\n\n`
  )
  md = md.replace(
    /<h4\b[^>]*>([\s\S]*?)<\/h4>/gi,
    (_m, c: string) => `\n#### ${c.trim()}\n\n`
  )
  md = md.replace(
    /<h5\b[^>]*>([\s\S]*?)<\/h5>/gi,
    (_m, c: string) => `\n##### ${c.trim()}\n\n`
  )
  md = md.replace(
    /<h6\b[^>]*>([\s\S]*?)<\/h6>/gi,
    (_m, c: string) => `\n###### ${c.trim()}\n\n`
  )

  // Blockquotes
  md = md.replace(
    /<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi,
    (_m, c: string) => {
      const text = c.replace(/<[^>]+>/g, "").trim()
      return `\n> ${text}\n\n`
    }
  )

  // Unordered lists
  md = md.replace(
    /<ul\b[^>]*>([\s\S]*?)<\/ul>/gi,
    (_m, listContent: string) => {
      const items: string[] = []
      const liRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi
      let liMatch: RegExpExecArray | null
      while ((liMatch = liRegex.exec(listContent)) !== null) {
        const itemText = liMatch[1].replace(/<[^>]+>/g, "").trim()
        if (itemText) items.push(`- ${itemText}`)
      }
      return "\n" + items.join("\n") + "\n\n"
    }
  )

  // Ordered lists
  md = md.replace(
    /<ol\b[^>]*>([\s\S]*?)<\/ol>/gi,
    (_m, listContent: string) => {
      const items: string[] = []
      const liRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi
      let liMatch: RegExpExecArray | null
      let idx = 1
      while ((liMatch = liRegex.exec(listContent)) !== null) {
        const itemText = liMatch[1].replace(/<[^>]+>/g, "").trim()
        if (itemText) items.push(`${idx++}. ${itemText}`)
      }
      return "\n" + items.join("\n") + "\n\n"
    }
  )

  // Links: <a href="...">...</a>
  md = md.replace(
    /<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href: string, text: string) => {
      const cleanText = text.replace(/<[^>]+>/g, "").trim()
      if (!cleanText) return ""
      return `[${cleanText}](${href})`
    }
  )

  // Formatting: bold & italic
  md = md.replace(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, "**$1**")
  md = md.replace(/<(?:em|i)\b[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, "*$1*")

  // Paragraphs & breaks
  md = md.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, "\n\n$1\n\n")
  md = md.replace(/<br\s*\/?>/gi, "\n")
  md = md.replace(/<hr\s*\/?>/gi, "\n\n---\n\n")

  // Remove all other tags
  md = md.replace(/<[^>]+>/g, "")

  // Decode entities
  md = decodeHtmlEntities(md)

  // Normalize newlines and whitespace
  return md
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim()
}

/**
 * Fetches HTML from target URL with timeout and custom User-Agent.
 */
export async function fetchHtml(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  customFetch: typeof fetch = fetch
): Promise<string> {
  assertAllowedUrl(url)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await customFetch(url, {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    })

    if (!res.ok) {
      throw new Error(
        `FETCH_ERROR: HTTP ${res.status} ${res.statusText} from ${url}`
      )
    }

    return await res.text()
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `TIMEOUT: Fetch timed out after ${timeoutMs}ms for ${url}`
      )
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Discovers internal links in HTML matching origin and subpath prefix.
 */
export function discoverSubpathLinks(
  html: string,
  baseUrl: string,
  subpathPrefix: string
): string[] {
  const base = new URL(baseUrl)
  const cleanPrefix = subpathPrefix.startsWith("/")
    ? subpathPrefix
    : `/${subpathPrefix}`

  const links: Set<string> = new Set()
  const aRegex = /<a\b[^>]*href="([^"#\s]+)"/gi
  let match: RegExpExecArray | null

  while ((match = aRegex.exec(html)) !== null) {
    const rawHref = match[1]
    try {
      const resolved = new URL(rawHref, baseUrl)
      // Must match origin
      if (resolved.origin !== base.origin) continue
      // Must be http(s)
      if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
        continue
      }
      // Must not be private
      if (isPrivateOrReservedHost(resolved.hostname)) continue
      // Must start with subpathPrefix
      if (
        !resolved.pathname.startsWith(cleanPrefix) &&
        resolved.pathname !== cleanPrefix.replace(/\/$/, "")
      ) {
        continue
      }

      // Remove search & hash
      resolved.hash = ""
      resolved.search = ""
      links.add(resolved.toString())
    } catch {
      // Ignore unparseable hrefs
    }
  }

  return Array.from(links)
}

/**
 * Main Web Crawler Service entry point.
 */
export async function crawlUrl(
  targetUrl: string,
  options?: CrawlOptions
): Promise<CrawlResult> {
  const parsed = assertAllowedUrl(targetUrl)
  const mode = options?.crawlMode || "SINGLE_PAGE"
  const maxPages = Math.min(
    options?.maxPages || MAX_PAGES_LIMIT,
    MAX_PAGES_LIMIT
  )
  const maxDepth = Math.min(
    options?.maxDepth || MAX_DEPTH_LIMIT,
    MAX_DEPTH_LIMIT
  )
  const timeoutMs = options?.timeoutMs || DEFAULT_TIMEOUT_MS
  const fetchFn = options?.fetchFn || fetch

  if (mode === "SINGLE_PAGE") {
    const rawHtml = await fetchHtml(targetUrl, timeoutMs, fetchFn)
    const { title, cleanedHtml } = stripHtmlBoilerplate(rawHtml)
    const contentMarkdown = htmlToMarkdown(cleanedHtml)
    const contentHash = computeContentHash(contentMarkdown)

    return {
      title,
      contentMarkdown,
      contentHash,
      pageCount: 1,
      pages: [
        {
          url: targetUrl,
          title,
          contentMarkdown,
          contentHash,
        },
      ],
    }
  }

  // SUBPATH_RECURSIVE mode
  const visited = new Set<string>()
  const queue: Array<{ url: string; depth: number }> = [
    { url: parsed.toString(), depth: 0 },
  ]
  visited.add(parsed.toString())

  const crawledPages: CrawledPage[] = []
  const subpathPrefix = parsed.pathname

  while (queue.length > 0 && crawledPages.length < maxPages) {
    const current = queue.shift()
    if (!current) break

    try {
      const rawHtml = await fetchHtml(current.url, timeoutMs, fetchFn)
      const { title, cleanedHtml } = stripHtmlBoilerplate(rawHtml)
      const contentMarkdown = htmlToMarkdown(cleanedHtml)
      const contentHash = computeContentHash(contentMarkdown)

      crawledPages.push({
        url: current.url,
        title,
        contentMarkdown,
        contentHash,
      })

      if (current.depth < maxDepth) {
        const nextLinks = discoverSubpathLinks(
          rawHtml,
          current.url,
          subpathPrefix
        )
        for (const link of nextLinks) {
          if (
            !visited.has(link) &&
            crawledPages.length + queue.length < maxPages
          ) {
            visited.add(link)
            queue.push({ url: link, depth: current.depth + 1 })
          }
        }
      }
    } catch {
      // Continue crawling other pages if one page fails
    }
  }

  if (crawledPages.length === 0) {
    throw new Error(
      `CRAWL_FAILED: No pages successfully crawled for ${targetUrl}`
    )
  }

  let combinedMarkdown = ""
  if (crawledPages.length === 1) {
    combinedMarkdown = crawledPages[0].contentMarkdown
  } else {
    combinedMarkdown = crawledPages
      .map((p) => `# ${p.title}\nSource: ${p.url}\n\n${p.contentMarkdown}`)
      .join("\n\n---\n\n")
  }

  const overallHash = computeContentHash(combinedMarkdown)
  const mainTitle = crawledPages[0]?.title || "Crawled Web Knowledge"

  return {
    title: mainTitle,
    contentMarkdown: combinedMarkdown,
    contentHash: overallHash,
    pageCount: crawledPages.length,
    pages: crawledPages,
  }
}

export const webCrawlerService = {
  assertAllowedUrl,
  isPrivateOrReservedHost,
  computeContentHash,
  shouldUpdateDocument,
  stripHtmlBoilerplate,
  htmlToMarkdown,
  fetchHtml,
  discoverSubpathLinks,
  crawlUrl,
}
