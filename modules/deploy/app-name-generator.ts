/**
 * Shared application name and subdomain generator.
 * Aligns Console Git Deploy with App Marketplace naming conventions.
 */

const ADJECTIVES = [
  "sparkling",
  "swift",
  "radiant",
  "cosmic",
  "nimble",
  "vibrant",
  "stellar",
  "luminous",
  "daring",
  "zenith",
]

const NOUNS = [
  "star",
  "nebula",
  "aurora",
  "phoenix",
  "pulsar",
  "falcon",
  "voyager",
  "atlas",
  "horizon",
  "comet",
]

export function generateSuggestedAppName(baseName: string): string {
  const cleanSlug = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  const base = cleanSlug || "app"
  const formattedBase = /^[0-9]/.test(base) ? `app-${base}` : base
  const suffix = Math.random().toString(36).substring(2, 6)
  return `${formattedBase}-${adj}-${noun}-${suffix}`
}
