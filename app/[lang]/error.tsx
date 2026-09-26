"use client"

import { GlobalErrorView } from "@/components/global-error-view"

export default function LocalizedError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <GlobalErrorView error={error} reset={reset} />
}
