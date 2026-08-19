import { describe, expect, it } from "bun:test"
import { renderMarkdownToHtml } from "./markdown"

describe("renderMarkdownToHtml", () => {
  it("renders the structure used by knowledge-base guides", () => {
    const html = renderMarkdownToHtml(
      "# WhatsApp API Key Guide\n\n" +
        "## 1. Authenticating API Requests\n\n" +
        "Use the [OpenAPI reference](/api/openapi)."
    )

    expect(html).toContain("<h1>WhatsApp API Key Guide</h1>")
    expect(html).toContain("<h2>1. Authenticating API Requests</h2>")
    expect(html).toContain('href="/api/openapi"')
  })

  it("renders fenced examples without changing their contents", () => {
    const html = renderMarkdownToHtml(
      "```bash\n" +
        'curl -H "Authorization: Bearer secret" https://example.test\n' +
        "```"
    )

    expect(html).toContain('<pre><code class="language-bash">')
    expect(html).toContain("Authorization: Bearer secret")
  })
})
