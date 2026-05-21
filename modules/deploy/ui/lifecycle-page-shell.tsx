import type { ReactNode } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LifecycleNav } from "@/modules/deploy/ui/lifecycle-nav"

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
    <section className="flex w-full flex-col gap-4">
      <Card>
        <CardHeader className="gap-2">
          <CardTitle>{title}</CardTitle>
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardHeader>
        <CardContent>
          <LifecycleNav />
        </CardContent>
      </Card>

      {children}
    </section>
  )
}
