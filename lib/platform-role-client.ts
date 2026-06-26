export async function getPlatformRole(): Promise<string> {
  try {
    const res = await fetch("/api/auth/platform-role")
    if (!res.ok) return "none"
    const data = (await res.json()) as { role: string }
    return data.role
  } catch {
    return "none"
  }
}
