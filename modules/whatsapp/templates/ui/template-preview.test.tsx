/**
 * Template Preview — Unit tests
 *
 * NOTE: Avoid importing `screen` from @testing-library/react — it is evaluated
 * at module-import time when document.body is still null (Happy DOM).
 * Use `render()`'s destructured container/queries or `within(document.body)`.
 */

import { describe, expect, it } from "bun:test"
import { render } from "@testing-library/react"
import * as React from "react"
import {
  getTemplatePlaceholderIndexes,
  getLanguageDisplay,
  renderTemplateBody,
  resolveTemplatePreviewValues,
  WhatsAppTemplatePreview,
  TemplateLanguageBadge,
} from "./template-preview"
import type { WhatsAppTemplateLanguage } from "@/lib/api/whatsapp-client"

// ─── getTemplatePlaceholderIndexes ────────────────────────────────────────────

describe("getTemplatePlaceholderIndexes", () => {
  it("returns empty array for null/undefined body", () => {
    expect(getTemplatePlaceholderIndexes(null)).toEqual([])
    expect(getTemplatePlaceholderIndexes(undefined)).toEqual([])
  })

  it("extracts sorted unique indexes from body", () => {
    expect(
      getTemplatePlaceholderIndexes("Hello {{1}}, you have {{2}} new {{2}}")
    ).toEqual([1, 2])
  })

  it("handles whitespace in placeholders", () => {
    expect(getTemplatePlaceholderIndexes("Hi {{ 1 }}, code {{2}}")).toEqual([
      1, 2,
    ])
  })

  it("returns empty for body without placeholders", () => {
    expect(getTemplatePlaceholderIndexes("Hello world")).toEqual([])
  })
})

// ─── getLanguageDisplay ───────────────────────────────────────────────────────

describe("getLanguageDisplay", () => {
  it("maps en to en label with US flag", () => {
    const result = getLanguageDisplay("en")
    expect(result.code).toBe("en")
    expect(result.label).toBe("English")
    expect(result.flag).toBe("US")
  })

  it("maps id to Indonesian label with ID flag", () => {
    const result = getLanguageDisplay("id")
    expect(result.code).toBe("id")
    expect(result.label).toBe("Indonesian")
    expect(result.flag).toBe("ID")
  })

  it("normalizes underscore and uppercase region for en_US", () => {
    const result = getLanguageDisplay("en_US")
    expect(result.code).toBe("en-US")
    expect(result.flag).toBe("US")
  })

  it("returns no flag for unknown codes", () => {
    const result = getLanguageDisplay("xh")
    expect(result.flag).toBe("")
  })
})

// ─── renderTemplateBody ───────────────────────────────────────────────────────

describe("renderTemplateBody", () => {
  it("replaces placeholders with values", () => {
    expect(
      renderTemplateBody("Hello {{1}}, you have {{2}} new", {
        1: "Alice",
        2: "5",
      })
    ).toBe("Hello Alice, you have 5 new")
  })

  it("returns body unchanged when no values provided", () => {
    expect(renderTemplateBody("Hello {{1}}", undefined)).toBe("Hello {{1}}")
  })

  it("returns empty string for null/undefined", () => {
    expect(renderTemplateBody(null)).toBe("")
    expect(renderTemplateBody(undefined)).toBe("")
  })

  it("leaves text without placeholders unchanged", () => {
    expect(renderTemplateBody("Hello world")).toBe("Hello world")
  })
})

// ─── resolveTemplatePreviewValues ─────────────────────────────────────────────

describe("resolveTemplatePreviewValues", () => {
  const baseLanguage: Pick<WhatsAppTemplateLanguage, "body" | "parameters"> = {
    body: "Hello {{1}}, from {{2}}",
    parameters: {
      components: [
        { type: "BODY", example: { body_text: [["Alice", "Acme"]] } },
      ],
    },
  }

  it("uses explicit overrides first", () => {
    const result = resolveTemplatePreviewValues(baseLanguage, {
      1: "Bob",
    })
    expect(result[1]).toBe("Bob")
    expect(result[2]).toBe("Acme")
  })

  it("falls back to parameter examples", () => {
    const result = resolveTemplatePreviewValues(baseLanguage)
    expect(result[1]).toBe("Alice")
    expect(result[2]).toBe("Acme")
  })

  it("fills missing indexes with Example N fallback", () => {
    const lang: Pick<WhatsAppTemplateLanguage, "body" | "parameters"> = {
      body: "Hi {{1}} {{2}}",
      parameters: null,
    }
    const result = resolveTemplatePreviewValues(lang)
    expect(result[1]).toBe("Example 1")
    expect(result[2]).toBe("Example 2")
  })

  it("handles flat body_text array", () => {
    const lang: Pick<WhatsAppTemplateLanguage, "body" | "parameters"> = {
      body: "Hi {{1}}",
      parameters: {
        components: [{ type: "BODY", example: { body_text: ["Alice"] } }],
      },
    }
    const result = resolveTemplatePreviewValues(lang)
    expect(result[1]).toBe("Alice")
  })

  it("handles flat array parameter format", () => {
    const lang: Pick<WhatsAppTemplateLanguage, "body" | "parameters"> = {
      body: "Hi {{1}}",
      parameters: [{ type: "BODY", text: "Bob" }],
    }
    const result = resolveTemplatePreviewValues(lang)
    expect(result[1]).toBe("Bob")
  })

  it("returns empty when no placeholders exist", () => {
    const lang: Pick<WhatsAppTemplateLanguage, "body" | "parameters"> = {
      body: "Hello world",
      parameters: null,
    }
    expect(resolveTemplatePreviewValues(lang)).toEqual({})
  })
})

// ─── WhatsAppTemplatePreview ──────────────────────────────────────────────────

const mockLanguage: WhatsAppTemplateLanguage = {
  id: "l1",
  lang: "en",
  headerText: "Welcome!",
  body: "Hello {{1}}, you have {{2}} new messages.",
  footer: "Reply STOP to opt out",
  buttons: [
    { type: "QUICK_REPLY", text: "Yes" },
    { type: "URL", cta_url: { display_text: "Learn More" } },
  ],
  parameters: {
    components: [
      {
        type: "BODY",
        example: { body_text: [["John", "5"]] },
      },
    ],
  },
}

describe("WhatsAppTemplatePreview", () => {
  it("renders header, body, footer, and buttons", () => {
    const { container } = render(
      <WhatsAppTemplatePreview language={mockLanguage} />
    )

    expect(container.textContent).toContain("Welcome!")
    expect(container.textContent).toContain(
      "Hello John, you have 5 new messages."
    )
    expect(container.textContent).toContain("Reply STOP to opt out")
    expect(container.textContent).toContain("Yes")
    expect(container.textContent).toContain("Learn More")
  })

  it("renders buttons as separate full-width rows", () => {
    const { container } = render(
      <WhatsAppTemplatePreview language={mockLanguage} />
    )

    // Buttons render as individual rows (separate divs)
    const text = container.textContent ?? ""
    const yesIdx = text.indexOf("Yes")
    const learnIdx = text.indexOf("Learn More")
    expect(yesIdx).toBeGreaterThan(-1)
    expect(learnIdx).toBeGreaterThan(-1)
    expect(learnIdx).toBeGreaterThan(yesIdx)
  })

  it("shows no preview content for empty language", () => {
    const empty: WhatsAppTemplateLanguage = {
      id: "l_empty",
      lang: "en",
    }
    const { container } = render(<WhatsAppTemplatePreview language={empty} />)
    expect(container.textContent).toContain("No preview content")
  })
})

// ─── TemplateLanguageBadge ────────────────────────────────────────────────────

describe("TemplateLanguageBadge", () => {
  it("shows code and label for Indonesian", () => {
    const { container } = render(<TemplateLanguageBadge lang="id" />)
    expect(container.textContent).toContain("id")
    expect(container.textContent).toContain("Indonesian")
  })

  it("shows code and label for English", () => {
    const { container } = render(<TemplateLanguageBadge lang="en" />)
    expect(container.textContent).toContain("en")
    expect(container.textContent).toContain("English")
  })
})
