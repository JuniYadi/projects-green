import { parsePublicGitUrl } from "./public-source"

export type PublicSourceUpdate = {
  remoteSha: string
  updateAvailable: boolean
}

export type PublicSourceAccessResult =
  | { accessible: true }
  | {
      accessible: false
      reason: "private_or_missing" | "ref_not_found" | "unavailable"
    }

const checkRemote = async (url: string, ref: string) => {
  const proc = Bun.spawn(["git", "ls-remote", url, ref], {
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
    } as Record<string, string>,
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  return { stdout, stderr, exitCode }
}

export async function checkPublicSourceAccess(input: {
  url: string
  ref?: string | null
}): Promise<PublicSourceAccessResult> {
  const parsed = parsePublicGitUrl(input.url)
  if ("error" in parsed) {
    return { accessible: false, reason: "unavailable" }
  }

  const result = await checkRemote(parsed.url, input.ref?.trim() || "HEAD")
  if (result.exitCode === 0) {
    return result.stdout.trim()
      ? { accessible: true }
      : { accessible: false, reason: "ref_not_found" }
  }

  const error = result.stderr.toLowerCase()
  if (
    /repository not found|could not read username|authentication failed|access denied|permission denied|\b403\b|\b404\b/.test(
      error
    )
  ) {
    return { accessible: false, reason: "private_or_missing" }
  }

  return { accessible: false, reason: "unavailable" }
}

export async function checkPublicSourceUpdate(input: {
  url: string
  ref: string
  deployedSha?: string | null
}): Promise<PublicSourceUpdate> {
  const parsed = parsePublicGitUrl(input.url)
  if ("error" in parsed) throw new Error("INVALID_PUBLIC_SOURCE")

  const { stdout, stderr, exitCode } = await checkRemote(parsed.url, input.ref)
  if (exitCode !== 0)
    throw new Error(stderr.trim() || "PUBLIC_SOURCE_FETCH_FAILED")
  const remoteSha = stdout.trim().split(/\s+/)[0]
  if (!/^[0-9a-f]{40}$/i.test(remoteSha)) {
    throw new Error("PUBLIC_SOURCE_REF_NOT_FOUND")
  }
  return {
    remoteSha,
    updateAvailable: remoteSha !== (input.deployedSha ?? null),
  }
}
