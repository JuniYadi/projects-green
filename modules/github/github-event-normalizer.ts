export type NormalizedGithubWebhookPayload = {
  githubInstallationId: bigint | null
  githubRepositoryId: bigint | null
  repositoryFullName: string | null
  repositoryOwner: string | null
  repositoryName: string | null
  ref: string | null
  branch: string | null
  commitSha: string | null
  commitMessage: string | null
  commitAuthorName: string | null
  commitAuthorEmail: string | null
  commitUrl: string | null
  senderLogin: string | null
  senderAvatarUrl: string | null
}

type JsonRecord = Record<string, unknown>

const asRecord = (value: unknown): JsonRecord | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null

const asBigInt = (value: unknown): bigint | null => {
  if (typeof value === "bigint") return value
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value)
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value)
  return null
}

const branchFromRef = (ref: string | null): string | null => {
  if (!ref) return null
  if (ref.startsWith("refs/heads/")) return ref.slice("refs/heads/".length)
  return ref
}

export const normalizeGithubWebhookPayload = (
  payload: unknown
): NormalizedGithubWebhookPayload => {
  const root = asRecord(payload) ?? {}
  const installation = asRecord(root.installation)
  const repository = asRecord(root.repository)
  const owner = asRecord(repository?.owner)
  const headCommit = asRecord(root.head_commit)
  const commitAuthor = asRecord(headCommit?.author)
  const sender = asRecord(root.sender)
  const ref = asString(root.ref)

  return {
    githubInstallationId: asBigInt(installation?.id),
    githubRepositoryId: asBigInt(repository?.id),
    repositoryFullName: asString(repository?.full_name),
    repositoryOwner: asString(owner?.login),
    repositoryName: asString(repository?.name),
    ref,
    branch: branchFromRef(ref),
    commitSha: asString(headCommit?.id),
    commitMessage: asString(headCommit?.message),
    commitAuthorName: asString(commitAuthor?.name),
    commitAuthorEmail: asString(commitAuthor?.email),
    commitUrl: asString(headCommit?.url),
    senderLogin: asString(sender?.login),
    senderAvatarUrl: asString(sender?.avatar_url),
  }
}
