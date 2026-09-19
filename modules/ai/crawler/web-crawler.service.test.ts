import { describe, expect, it, mock } from "bun:test"
import {
  assertAllowedUrl,
  computeContentHash,
  discoverSubpathLinks,
  htmlToMarkdown,
  isPrivateOrReservedHost,
  shouldUpdateDocument,
  stripHtmlBoilerplate,
  webCrawlerService,
} from "./web-crawler.service"

describe("webCrawlerService", () => {
  describe("SSRF protection", () => {
    it("detects private, loopback, and reserved IPs", () => {
      expect(isPrivateOrReservedHost("localhost")).toBe(true)
      expect(isPrivateOrReservedHost("app.localhost")).toBe(true)
      expect(isPrivateOrReservedHost("127.0.0.1")).toBe(true)
      expect(isPrivateOrReservedHost("127.10.0.1")).toBe(true)
      expect(isPrivateOrReservedHost("0.0.0.0")).toBe(true)
      expect(isPrivateOrReservedHost("10.0.1.25")).toBe(true)
      expect(isPrivateOrReservedHost("172.16.0.1")).toBe(true)
      expect(isPrivateOrReservedHost("172.31.255.255")).toBe(true)
      expect(isPrivateOrReservedHost("192.168.1.1")).toBe(true)
      expect(isPrivateOrReservedHost("169.254.169.254")).toBe(true)
      expect(isPrivateOrReservedHost("::1")).toBe(true)
      expect(isPrivateOrReservedHost("[::1]")).toBe(true)
      expect(isPrivateOrReservedHost("fe80::1")).toBe(true)
    })

    it("allows valid public hostnames and public IPs", () => {
      expect(isPrivateOrReservedHost("example.com")).toBe(false)
      expect(isPrivateOrReservedHost("docs.green.org")).toBe(false)
      expect(isPrivateOrReservedHost("8.8.8.8")).toBe(false)
      expect(isPrivateOrReservedHost("1.1.1.1")).toBe(false)
    })

    it("rejects non-http protocols and blocked hosts", () => {
      expect(() => assertAllowedUrl("http://localhost:3000")).toThrow(
        "SSRF_BLOCKED"
      )
      expect(() => assertAllowedUrl("https://127.0.0.1/api")).toThrow(
        "SSRF_BLOCKED"
      )
      expect(() => assertAllowedUrl("http://10.200.0.5/meta")).toThrow(
        "SSRF_BLOCKED"
      )
      expect(() => assertAllowedUrl("ftp://example.com/file.txt")).toThrow(
        "SSRF_BLOCKED"
      )
      expect(() => assertAllowedUrl("file:///etc/passwd")).toThrow(
        "SSRF_BLOCKED"
      )
      expect(() => assertAllowedUrl("invalid-url")).toThrow("INVALID_URL")
    })

    it("accepts safe public HTTP/HTTPS URLs", () => {
      const url = assertAllowedUrl("https://example.com/docs/faq")
      expect(url.hostname).toBe("example.com")
      expect(url.pathname).toBe("/docs/faq")
    })
  })

  describe("Boilerplate stripping", () => {
    it("removes nav, header, footer, scripts, styles, cookie banner", () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Help Center - FAQ</title>
            <style>body { color: red; }</style>
            <script>console.log("track")</script>
          </head>
          <body>
            <header><div class="logo">Logo</div></header>
            <nav><a href="/">Home</a><a href="/pricing">Pricing</a></nav>
            <div class="cookie-banner">Accept cookies</div>
            <main>
              <h1>Frequently Asked Questions</h1>
              <p>Here are answers to your queries.</p>
            </main>
            <footer><p>© 2026 Example Corp</p></footer>
          </body>
        </html>
      `

      const { title, cleanedHtml } = stripHtmlBoilerplate(html)
      expect(title).toBe("Help Center - FAQ")
      expect(cleanedHtml).not.toContain("body { color: red; }")
      expect(cleanedHtml).not.toContain('console.log("track")')
      expect(cleanedHtml).not.toContain("Pricing")
      expect(cleanedHtml).not.toContain("Accept cookies")
      expect(cleanedHtml).not.toContain("© 2026 Example Corp")
      expect(cleanedHtml).toContain("Frequently Asked Questions")
    })

    it("falls back to h1 if title tag is absent", () => {
      const html = `
        <main>
          <h1>Return & Refund Policy</h1>
          <p>Returns accepted within 14 days.</p>
        </main>
      `
      const { title } = stripHtmlBoilerplate(html)
      expect(title).toBe("Return & Refund Policy")
    })
  })

  describe("HTML to Markdown conversion", () => {
    it("converts headings, paragraphs, bold, italic, and blockquotes", () => {
      const html = `
        <h2>Overview</h2>
        <p>This is a <strong>bold statement</strong> and
           <em>italic text</em>.</p>
        <blockquote>Note: Always confirm invoice details.</blockquote>
      `
      const md = htmlToMarkdown(html)
      expect(md).toContain("## Overview")
      expect(md).toContain("**bold statement**")
      expect(md).toContain("*italic text*")
      expect(md).toContain("> Note: Always confirm invoice details.")
    })

    it("converts tables into markdown tables", () => {
      const html = `
        <table>
          <thead>
            <tr><th>Product</th><th>Price</th></tr>
          </thead>
          <tbody>
            <tr><td>Standard Plan</td><td>$10/mo</td></tr>
            <tr><td>Enterprise Plan</td><td>$50/mo</td></tr>
          </tbody>
        </table>
      `
      const md = htmlToMarkdown(html)
      expect(md).toContain("| Product | Price |")
      expect(md).toContain("| --- | --- |")
      expect(md).toContain("| Standard Plan | $10/mo |")
      expect(md).toContain("| Enterprise Plan | $50/mo |")
    })

    it("converts lists, links, and code blocks", () => {
      const html = `
        <ul>
          <li>Feature A</li>
          <li>Feature B</li>
        </ul>
        <ol>
          <li>Step One</li>
          <li>Step Two</li>
        </ol>
        <p>Visit <a href="https://example.com">Documentation</a>.</p>
        <pre><code>const a = 1;</code></pre>
      `
      const md = htmlToMarkdown(html)
      expect(md).toContain("- Feature A")
      expect(md).toContain("- Feature B")
      expect(md).toContain("1. Step One")
      expect(md).toContain("2. Step Two")
      expect(md).toContain("[Documentation](https://example.com)")
      expect(md).toContain("```\nconst a = 1;\n```")
    })
  })

  describe("Hash computation and diff check", () => {
    it("computes sha256 hash and verifies change detection", () => {
      const md1 = "# Hello World\nWelcome to our store."
      const md2 = "# Hello World\nWelcome to our store."
      const md3 = "# Hello World\nWelcome to our updated store."

      const hash1 = computeContentHash(md1)
      const hash2 = computeContentHash(md2)
      const hash3 = computeContentHash(md3)

      expect(hash1).toBe(hash2)
      expect(hash1).not.toBe(hash3)
      expect(shouldUpdateDocument(hash1, hash2)).toBe(false)
      expect(shouldUpdateDocument(hash1, hash3)).toBe(true)
      expect(shouldUpdateDocument(null, hash1)).toBe(true)
    })
  })

  describe("Subpath link discovery and recursive crawling", () => {
    it("discovers links on same origin and matching subpath prefix", () => {
      const html = `
        <a href="/docs/faq/billing">Billing FAQ</a>
        <a href="/docs/faq/shipping">Shipping FAQ</a>
        <a href="/blog/news">Unrelated Blog</a>
        <a href="https://external.com/faq">External Site</a>
        <a href="http://127.0.0.1/admin">Internal SSRF</a>
      `
      const links = discoverSubpathLinks(
        html,
        "https://example.com/docs/faq",
        "/docs/faq"
      )

      expect(links).toEqual([
        "https://example.com/docs/faq/billing",
        "https://example.com/docs/faq/shipping",
      ])
    })

    it("crawls SINGLE_PAGE correctly with mocked fetch", async () => {
      const mockFetch = mock(async () => {
        return new Response(
          "<html><title>Page 1</title><main><p>Content</p></main></html>",
          { status: 200, headers: { "Content-Type": "text/html" } }
        )
      })

      const res = await webCrawlerService.crawlUrl(
        "https://example.com/single",
        {
          crawlMode: "SINGLE_PAGE",
          fetchFn: mockFetch as unknown as typeof fetch,
        }
      )

      expect(res.title).toBe("Page 1")
      expect(res.pageCount).toBe(1)
      expect(res.contentMarkdown).toBe("Content")
      expect(res.pages.length).toBe(1)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it("crawls SUBPATH_RECURSIVE up to maxPages and depth", async () => {
      const pagesMap: Record<string, string> = {
        "https://example.com/docs/faq": `
          <html><title>FAQ Index</title>
          <main>
            <h1>FAQ Home</h1>
            <a href="/docs/faq/page1">Page 1</a>
            <a href="/docs/faq/page2">Page 2</a>
          </main></html>
        `,
        "https://example.com/docs/faq/page1": `
          <html><title>Page 1 Title</title>
          <main><p>Answer 1</p></main></html>
        `,
        "https://example.com/docs/faq/page2": `
          <html><title>Page 2 Title</title>
          <main><p>Answer 2</p></main></html>
        `,
      }

      const mockFetch = mock(async (url: string | URL | Request) => {
        const u = typeof url === "string" ? url : url.toString()
        const html = pagesMap[u] || "<html><main>Not found</main></html>"
        return new Response(html, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        })
      })

      const res = await webCrawlerService.crawlUrl(
        "https://example.com/docs/faq",
        {
          crawlMode: "SUBPATH_RECURSIVE",
          maxPages: 3,
          maxDepth: 1,
          fetchFn: mockFetch as unknown as typeof fetch,
        }
      )

      expect(res.pageCount).toBe(3)
      expect(res.pages.length).toBe(3)
      expect(res.contentMarkdown).toContain("FAQ Index")
      expect(res.contentMarkdown).toContain("Page 1 Title")
      expect(res.contentMarkdown).toContain("Page 2 Title")
    })
  })
})
