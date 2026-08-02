import { parsePublicGitUrl } from "./public-source"

export type PublicSourceUpdate = {
  remoteSha: string
  updateAvailable: boolean
}

export async function checkPublicSourceUpdate(input: {
  url: string
  ref: string
  deployedSha?: string | null
}): Promise<PublicSourceUpdate> {
  const parsed = parsePublicGitUrl(input.url)
  if ("error" in parsed) throw new Error("INVALID_PUBLIC_SOURCE")

  const proc = Bun.spawn(["git", "ls-remote", parsed.url, input.ref], {
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
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
