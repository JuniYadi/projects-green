import sanitizeHtmlLib from "sanitize-html"

export function sanitizeHtml(dirtyHtml: string | null | undefined): string {
  if (!dirtyHtml) return ""
  return sanitizeHtmlLib(dirtyHtml, {
    allowedTags: [
      "a",
      "b",
      "blockquote",
      "br",
      "code",
      "em",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "i",
      "li",
      "ol",
      "p",
      "pre",
      "span",
      "strong",
      "table",
      "tbody",
      "td",
      "th",
      "thead",
      "tr",
      "ul",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel", "class"],
      "*": ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
  })
}
