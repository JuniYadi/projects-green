"use client"

import type { ReactNode } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DeployWizardProvider } from "@/modules/deploy/deploy.store"
import { LifecycleNav } from "@/modules/deploy/ui/lifecycle-nav"

export default function DeployLayout({ children }: { children: ReactNode }) {
  return (
    <DeployWizardProvider>
      <main className="mx-auto w-full max-w-5xl p-6 md:p-8">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="gap-2">
              <CardTitle>Deploy Application</CardTitle>
              <p className="text-xs text-muted-foreground">
                Build, operate, and observe your Kubernetes app lifecycle.
              </p>
            </CardHeader>
            <CardContent>
              <LifecycleNav />
            </CardContent>
          </Card>

          {children}
        </div>
      </main>
    </DeployWizardProvider>
  )
}
