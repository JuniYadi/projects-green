import type { ReactNode } from "react"

type LifecyclePageShellProps = {
  title: string
  description: string
  children: ReactNode
}

export function LifecyclePageShell({
  title,
  description,
  children,
}: LifecyclePageShellProps) {
  return (
    <>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>

      {children}
    </>
  )
}
