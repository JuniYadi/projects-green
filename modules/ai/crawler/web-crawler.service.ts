import { createHash } from "node:crypto"
import dns from "node:dns/promises"
import { parseDocument } from "htmlparser2"
import type { Element, Node, DataNode, ChildNode } from "domhandler"

export type CrawlMode = "SINGLE_PAGE" | "SUBPATH_RECURSIVE"

export type CrawlOptions = {
  crawlMode?: CrawlMode
  maxPages?: number
  maxDepth?: number
  timeoutMs?: number
  delayMs?: number
  fetchFn?: typeof fetch
  dnsLookupFn?: (host: string) => Promise<{ address: string }>
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
const DEFAULT_POLITE_DELAY_MS = 20
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
 * Asserts URL with DNS lookup to prevent DNS-rebinding SSRF attacks.
 */
export async function assertAllowedUrlAsync(
  targetUrl: string,
  dnsLookupFn?: (host: string) => Promise<{ address: string }>
): Promise<URL> {
  const parsed = assertAllowedUrl(targetUrl)
  const lookup = dnsLookupFn || dns.lookup

  try {
    const resolved = await lookup(parsed.hostname)
    if (isPrivateOrReservedHost(resolved.address)) {
      throw new Error(
        `SSRF_BLOCKED: Host "${parsed.hostname}" resolved to ` +
          `private IP "${resolved.address}"`
      )
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("SSRF_BLOCKED")) {
      throw err
    }
    throw new Error(
      `SSRF_BLOCKED: DNS resolution failed for "${parsed.hostname}"`
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

function isElement(node: Node): node is Element {
  return node.type === "tag" || node.type === "script" || node.type === "style"
}

function isText(node: Node): node is DataNode {
  return node.type === "text"
}

function getNodeText(node: Node): string {
  if (isText(node)) return node.data
  if ("children" in node && Array.isArray(node.children)) {
    return node.children.map(getNodeText).join("")
  }
  return ""
}

function findElement(
  node: Node,
  predicate: (el: Element) => boolean
): Element | null {
  if (isElement(node) && predicate(node)) return node
  if ("children" in node && Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findElement(child, predicate)
      if (found) return found
    }
  }
  return null
}

function filterBoilerplateNodes(nodes: ChildNode[]): ChildNode[] {
  const droppedTags = new Set([
    "script",
    "style",
    "nav",
    "header",
    "footer",
    "aside",
    "noscript",
    "iframe",
  ])

  return nodes.filter((node) => {
    if (!isElement(node)) return true
    const tagName = node.name.toLowerCase()
    if (droppedTags.has(tagName)) return false

    const className = (node.attribs["class"] || "").toLowerCase()
    const id = (node.attribs["id"] || "").toLowerCase()
    if (
      className.includes("cookie") ||
      className.includes("consent") ||
      className.includes("banner") ||
      id.includes("cookie") ||
      id.includes("consent")
    ) {
      return false
    }

    if (node.children && Array.isArray(node.children)) {
      node.children = filterBoilerplateNodes(node.children)
    }
    return true
  })
}

function renderNodeToMarkdown(node: Node): string {
  if (isText(node)) {
    return node.data
  }
  if (node.type === "root") {
    if ("children" in node && Array.isArray(node.children)) {
      return node.children.map(renderNodeToMarkdown).join("")
    }
    return ""
  }
  if (!isElement(node)) {
    return ""
  }

  const tagName = node.name.toLowerCase()
  const renderChildren = () =>
    (node.children || []).map(renderNodeToMarkdown).join("")

  switch (tagName) {
    case "h1":
      return `\n# ${renderChildren().trim()}\n\n`
    case "h2":
      return `\n## ${renderChildren().trim()}\n\n`
    case "h3":
      return `\n### ${renderChildren().trim()}\n\n`
    case "h4":
      return `\n#### ${renderChildren().trim()}\n\n`
    case "h5":
      return `\n##### ${renderChildren().trim()}\n\n`
    case "h6":
      return `\n###### ${renderChildren().trim()}\n\n`
    case "p":
      return `\n\n${renderChildren().trim()}\n\n`
    case "br":
      return "\n"
    case "hr":
      return "\n\n---\n\n"
    case "strong":
    case "b":
      return `**${renderChildren()}**`
    case "em":
    case "i":
      return `*${renderChildren()}*`
    case "blockquote":
      return `\n> ${renderChildren().trim()}\n\n`
    case "code":
      return `\`${renderChildren()}\``
    case "pre":
      return `\n\`\`\`\n${getNodeText(node).trim()}\n\`\`\`\n\n`
    case "a": {
      const href = node.attribs["href"] || ""
      const text = renderChildren().trim()
      if (!text) return ""
      return href ? `[${text}](${href})` : text
    }
    case "ul": {
      const items: string[] = []
      for (const child of node.children || []) {
        if (isElement(child) && child.name.toLowerCase() === "li") {
          const t = (child.children || [])
            .map(renderNodeToMarkdown)
            .join("")
            .trim()
          if (t) items.push(`- ${t}`)
        }
      }
      return `\n${items.join("\n")}\n\n`
    }
    case "ol": {
      const items: string[] = []
      let idx = 1
      for (const child of node.children || []) {
        if (isElement(child) && child.name.toLowerCase() === "li") {
          const t = (child.children || [])
            .map(renderNodeToMarkdown)
            .join("")
            .trim()
          if (t) items.push(`${idx++}. ${t}`)
        }
      }
      return `\n${items.join("\n")}\n\n`
    }
    case "table": {
      const rows: string[][] = []
      const collectRows = (n: Node) => {
        if (isElement(n)) {
          if (n.name.toLowerCase() === "tr") {
            const cells: string[] = []
            for (const cell of n.children || []) {
              if (
                isElement(cell) &&
                (cell.name.toLowerCase() === "th" ||
                  cell.name.toLowerCase() === "td")
              ) {
                cells.push(getNodeText(cell).trim())
              }
            }
            if (cells.length > 0) rows.push(cells)
          } else {
            for (const child of n.children || []) collectRows(child)
          }
        }
      }
      collectRows(node)
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
      const dataLines = rows
        .slice(1)
        .map(
          (row) =>
            "| " +
            Array.from({ length: colCount }, (_, i) => row[i] || "").join(
              " | "
            ) +
            " |"
        )
      return [headerLine, separatorLine, ...dataLines].join("\n") + "\n\n"
    }
    default:
      return renderChildren()
  }
}

function cleanWhitespace(md: string): string {
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
 * Strips HTML boilerplate and extracts semantic content.
 */
export function stripHtmlBoilerplate(html: string): {
  title: string
  cleanedHtml: string
} {
  const doc = parseDocument(html)

  // Extract <title> if present
  let title = ""
  const titleEl = findElement(doc, (el) => el.name.toLowerCase() === "title")
  if (titleEl) {
    title = getNodeText(titleEl).trim()
  }

  // Filter boilerplate tags
  doc.children = filterBoilerplateNodes(doc.children)

  // Target semantic containers (<main>, <article>, <body>)
  const mainEl = findElement(doc, (el) => el.name.toLowerCase() === "main")
  const articleEl = findElement(
    doc,
    (el) => el.name.toLowerCase() === "article"
  )
  const bodyEl = findElement(doc, (el) => el.name.toLowerCase() === "body")

  const targetNode = mainEl || articleEl || bodyEl || doc

  if (!title) {
    const h1El = findElement(targetNode, (el) => el.name.toLowerCase() === "h1")
    if (h1El) {
      title = getNodeText(h1El).trim()
    }
  }

  const rendered = cleanWhitespace(renderNodeToMarkdown(targetNode))

  return {
    title: title || "Web Page",
    cleanedHtml: rendered,
  }
}

/**
 * Converts HTML content into structured Markdown.
 */
export function htmlToMarkdown(html: string): string {
  const doc = parseDocument(html)
  doc.children = filterBoilerplateNodes(doc.children)
  return cleanWhitespace(renderNodeToMarkdown(doc))
}

/**
 * Fetches HTML from target URL with timeout, DNS SSRF check, and custom UA.
 */
export async function fetchHtml(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  customFetch: typeof fetch = fetch,
  dnsLookupFn?: (host: string) => Promise<{ address: string }>
): Promise<string> {
  await assertAllowedUrlAsync(url, dnsLookupFn)

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

    const contentType = res.headers.get("content-type") || ""
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      throw new Error(
        `INVALID_CONTENT_TYPE: Expected HTML from ${url} (got ${contentType})`
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

  const doc = parseDocument(html)
  const links: Set<string> = new Set()

  const collectLinks = (node: Node) => {
    if (isElement(node) && node.name.toLowerCase() === "a") {
      const rawHref = (node.attribs["href"] || "").trim()
      if (rawHref && !rawHref.startsWith("#")) {
        try {
          const resolved = new URL(rawHref, baseUrl)
          if (
            resolved.origin === base.origin &&
            (resolved.protocol === "http:" ||
              resolved.protocol === "https:") &&
            !isPrivateOrReservedHost(resolved.hostname) &&
            (resolved.pathname.startsWith(cleanPrefix) ||
              resolved.pathname === cleanPrefix.replace(/\/$/, ""))
          ) {
            resolved.hash = ""
            resolved.search = ""
            links.add(resolved.toString())
          }
        } catch {
          // Ignore malformed hrefs
        }
      }
    }
    if ("children" in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        collectLinks(child)
      }
    }
  }

  collectLinks(doc)
  return Array.from(links)
}

/**
 * Main Web Crawler Service entry point.
 */
export async function crawlUrl(
  targetUrl: string,
  options?: CrawlOptions
): Promise<CrawlResult> {
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
  const delayMs = options?.delayMs ?? DEFAULT_POLITE_DELAY_MS
  const fetchFn = options?.fetchFn || fetch
  const dnsLookupFn = options?.dnsLookupFn

  const parsed = await assertAllowedUrlAsync(targetUrl, dnsLookupFn)

  if (mode === "SINGLE_PAGE") {
    const rawHtml = await fetchHtml(
      targetUrl,
      timeoutMs,
      fetchFn,
      dnsLookupFn
    )
    const { title, cleanedHtml } = stripHtmlBoilerplate(rawHtml)
    const contentMarkdown = cleanedHtml
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

  // SUBPATH_RECURSIVE mode (respectful crawling with polite delay)
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
      const rawHtml = await fetchHtml(
        current.url,
        timeoutMs,
        fetchFn,
        dnsLookupFn
      )
      const { title, cleanedHtml } = stripHtmlBoilerplate(rawHtml)
      const contentMarkdown = cleanedHtml
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
    } catch (err) {
      console.warn(
        `[web-crawler] Failed to crawl ${current.url}:`,
        err instanceof Error ? err.message : err
      )
    }

    if (delayMs > 0 && queue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
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
  assertAllowedUrlAsync,
  isPrivateOrReservedHost,
  computeContentHash,
  shouldUpdateDocument,
  stripHtmlBoilerplate,
  htmlToMarkdown,
  fetchHtml,
  discoverSubpathLinks,
  crawlUrl,
}
