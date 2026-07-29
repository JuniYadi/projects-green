import { ScopedNotFoundShell } from "@/components/scoped-not-found-shell"

export default function ConsoleNotFound() {
  return <ScopedNotFoundShell surface="console" fallbackPath="/console" />
}
