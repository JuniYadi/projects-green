import { describe, expect, it } from "bun:test"
import { renderMarkdownFallback } from "./markdown"

// All tests exercise renderMarkdownFallback directly — the pure-TS renderer
// used in Next.js Node/Turbopack runtime. This guarantees the fallback path
// is covered regardless of which runtime runs the tests.

describe("renderMarkdownFallback", () => {
  describe("headings", () => {
    it("renders h1", () => {
      expect(renderMarkdownFallback("# Hello")).toContain("<h1>Hello</h1>")
    })

    it("renders h2", () => {
      expect(renderMarkdownFallback("## World")).toContain("<h2>World</h2>")
    })

    it("renders h3", () => {
      expect(renderMarkdownFallback("### Section")).toContain(
        "<h3>Section</h3>"
      )
    })

    it("renders h4", () => {
      expect(renderMarkdownFallback("#### Sub")).toContain("<h4>Sub</h4>")
    })
  })

  describe("code blocks", () => {
    it("renders fenced code block with language", () => {
      const md = "```bash\necho hello\n```"
      const html = renderMarkdownFallback(md)
      expect(html).toContain('<pre><code class="language-bash">')
      expect(html).toContain("echo hello")
      expect(html).toContain("</code></pre>")
    })

    it("renders fenced code block with no language tag", () => {
      const md = "```\nconst x = 1\n```"
      const html = renderMarkdownFallback(md)
      expect(html).toContain('<pre><code class="language-">')
      expect(html).toContain("const x = 1")
    })

    it("escapes HTML inside code blocks", () => {
      const md = "```\n<script>alert('xss')</script>\n```"
      const html = renderMarkdownFallback(md)
      expect(html).toContain("&lt;script&gt;")
      expect(html).not.toContain("<script>")
    })

    it("collects multi-line code content", () => {
      const md = "```js\nline1\nline2\nline3\n```"
      const html = renderMarkdownFallback(md)
      expect(html).toContain("line1\nline2\nline3")
    })
  })

  describe("lists", () => {
    it("renders unordered list with dash items", () => {
      const md = "- item one\n- item two"
      const html = renderMarkdownFallback(md)
      expect(html).toContain("<ul>")
      expect(html).toContain("<li>item one</li>")
      expect(html).toContain("<li>item two</li>")
      expect(html).toContain("</ul>")
    })

    it("renders unordered list with star items", () => {
      const md = "* alpha\n* beta"
      const html = renderMarkdownFallback(md)
      expect(html).toContain("<li>alpha</li>")
      expect(html).toContain("<li>beta</li>")
    })

    it("closes list when a non-list non-blank line follows", () => {
      // Blank line between list and paragraph triggers list close
      const md = "- item\n\nRegular paragraph"
      const html = renderMarkdownFallback(md)
      expect(html).toContain("</ul>")
      expect(html).toContain("<p>Regular paragraph</p>")
    })

    it("closes list when a heading follows directly", () => {
      const md = "- item\n## Heading"
      const html = renderMarkdownFallback(md)
      expect(html).toContain("</ul>")
      expect(html).toContain("<h2>Heading</h2>")
    })

    it("closes open list at end of document", () => {
      const html = renderMarkdownFallback("- only item")
      expect(html).toContain("</ul>")
    })
  })

  describe("blockquote", () => {
    it("renders blockquote", () => {
      const html = renderMarkdownFallback("> some quote")
      expect(html).toContain("<blockquote>")
      expect(html).toContain("<p>some quote</p>")
      expect(html).toContain("</blockquote>")
    })
  })

  describe("horizontal rule", () => {
    it("renders hr for ---", () => {
      expect(renderMarkdownFallback("---")).toContain("<hr />")
    })

    it("renders hr for ***", () => {
      expect(renderMarkdownFallback("***")).toContain("<hr />")
    })

    it("renders hr for ___", () => {
      expect(renderMarkdownFallback("___")).toContain("<hr />")
    })
  })

  describe("blank lines", () => {
    it("skips blank lines between blocks", () => {
      const html = renderMarkdownFallback("# Title\n\nparagraph")
      expect(html).toContain("<h1>Title</h1>")
      expect(html).toContain("<p>paragraph</p>")
    })
  })

  describe("paragraph", () => {
    it("wraps plain text in <p>", () => {
      expect(renderMarkdownFallback("hello world")).toContain(
        "<p>hello world</p>"
      )
    })
  })

  describe("inline formatting", () => {
    it("renders bold with **", () => {
      const html = renderMarkdownFallback("text **bold** text")
      expect(html).toContain("<strong>bold</strong>")
    })

    it("renders bold with __", () => {
      const html = renderMarkdownFallback("text __bold__ text")
      expect(html).toContain("<strong>bold</strong>")
    })

    it("renders italic with *", () => {
      const html = renderMarkdownFallback("text *italic* text")
      expect(html).toContain("<em>italic</em>")
    })

    it("renders italic with _", () => {
      const html = renderMarkdownFallback("text _italic_ text")
      expect(html).toContain("<em>italic</em>")
    })

    it("renders inline code with backticks", () => {
      const html = renderMarkdownFallback("use `foo()` here")
      expect(html).toContain("<code>foo()</code>")
    })

    it("renders link [text](url)", () => {
      const html = renderMarkdownFallback("[click here](https://example.com)")
      expect(html).toContain('href="https://example.com"')
      expect(html).toContain("click here</a>")
    })

    it("renders image ![alt](url)", () => {
      const html = renderMarkdownFallback(
        "![my image](https://example.com/img.png)"
      )
      expect(html).toContain('src="https://example.com/img.png"')
      expect(html).toContain('alt="my image"')
    })
  })

  describe("escapeHtml via code block", () => {
    it("escapes & < > \" ' in code", () => {
      const md = "```\n& < > \" '\n```"
      const html = renderMarkdownFallback(md)
      expect(html).toContain("&amp;")
      expect(html).toContain("&lt;")
      expect(html).toContain("&gt;")
      expect(html).toContain("&quot;")
      expect(html).toContain("&#039;")
    })
  })

  describe("mixed content", () => {
    it("renders a realistic markdown document", () => {
      const md = [
        "# Guide",
        "",
        "## Setup",
        "",
        "Run this command:",
        "",
        "```bash",
        "bun install",
        "```",
        "",
        "### Steps",
        "",
        "- Clone the repo",
        "- Install deps",
        "",
        "> Note: requires Bun 1.x",
        "",
        "---",
        "",
        "Done! Visit [docs](https://docs.example.com) for more.",
      ].join("\n")

      const html = renderMarkdownFallback(md)
      expect(html).toContain("<h1>Guide</h1>")
      expect(html).toContain("<h2>Setup</h2>")
      expect(html).toContain("<h3>Steps</h3>")
      expect(html).toContain('<pre><code class="language-bash">')
      expect(html).toContain("<li>Clone the repo</li>")
      expect(html).toContain("<blockquote>")
      expect(html).toContain("<hr />")
      expect(html).toContain("docs.example.com")
    })
  })
})
