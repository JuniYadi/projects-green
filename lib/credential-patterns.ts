// CREDENTIAL_PATTERNS: list of known credential regexes. Sources: GitHub
// Secret Scanning public list and gitleaks default ruleset. Each entry
// has a stable id, a human label for the UI warning, and a RegExp.
export const CREDENTIAL_PATTERNS: ReadonlyArray<{
  id: string
  label: string
  pattern: RegExp
}> = [
  {
    id: "password-assignment",
    label: "password assignment",
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*\S+/i,
  },
  {
    id: "aws-access-key",
    label: "AWS access key id",
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    id: "private-key-block",
    label: "private key block",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  },
  {
    id: "jwt",
    label: "JSON Web Token",
    pattern:
      /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  },
  {
    id: "bearer-basic-token",
    label: "Bearer or Basic token",
    pattern: /\b(?:Bearer|Basic)\s+[A-Za-z0-9._\-+/=]{16,}\b/,
  },
  {
    id: "stripe-live-key",
    label: "Stripe live secret key",
    pattern: /\bsk_live_[0-9a-zA-Z]{24,}\b/,
  },
  {
    id: "github-pat",
    label: "GitHub personal access token",
    pattern: /\bghp_[A-Za-z0-9]{30,}\b/,
  },
  {
    id: "slack-token",
    label: "Slack token",
    pattern: /\bxox[abp]-[A-Za-z0-9-]{10,}\b/,
  },
]

export type CredentialMatch = {
  match: boolean
  patterns: string[]
}

export const looksLikeCredential = (input: string): CredentialMatch => {
  if (!input) {
    return { match: false, patterns: [] }
  }
  const matched: string[] = []
  for (const entry of CREDENTIAL_PATTERNS) {
    if (entry.pattern.test(input)) {
      matched.push(entry.id)
    }
  }
  return { match: matched.length > 0, patterns: matched }
}
