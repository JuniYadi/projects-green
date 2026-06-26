export async function getPlatformRole(): Promise<string> {
  try {
    // ponytail: eden doesn't cover Next.js API routes — raw fetch needed here
    const res = await globalThis.fetch("/api/auth/platform-role")
    if (!res.ok) return "none"
    const data = (await res.json()) as { role: string }
    return data.role
  } catch {
    return "none"
  }
}
