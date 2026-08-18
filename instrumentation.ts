export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "edge") {
    return
  }

  const { installNextServerActionDiagnostics } =
    await import("@/lib/next-server-action-logging")
  installNextServerActionDiagnostics()
}
