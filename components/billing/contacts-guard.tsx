"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { getPlatformRole } from "@/lib/platform-role-client"
import { Skeleton } from "@/components/ui/skeleton"

type ContactsGuardProps = {
  children: React.ReactNode
}

export function ContactsGuard({ children }: ContactsGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)
  const [shouldRedirect, setShouldRedirect] = useState(false)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      // Skip guard when already on the contacts page (prevent redirect loop)
      if (pathname.endsWith("/contacts") || pathname.includes("/contacts/")) {
        setChecking(false)
        return
      }

      try {
        // Check platform role first — skip guard for super admins
        const role = await getPlatformRole()
        if (role === "super_admin") {
          setChecking(false)
          return
        }

        // Lightweight contacts count — no side effects
        // ponytail: raw globalThis.fetch for client-side fetch (eden doesn't cover Elysia routes from components/)
        const res = await globalThis.fetch("/api/billing/contacts/count")
        if (!res.ok) {
          setChecking(false)
          return
        }

        const data = (await res.json()) as { ok: boolean; count: number }
        if (data.ok && data.count === 0) {
          const langPrefix = pathname.split("/")[1] || "en"
          setShouldRedirect(true)
          router.replace(`/${langPrefix}/console/billing/contacts`)
          return
        }
      } catch {
        // Fail open — don't block billing if the check errors
      }

      if (!cancelled) setChecking(false)
    }

    void check()
    return () => {
      cancelled = true
    }
  }, [pathname, router])

  if (checking || shouldRedirect) {
    // Render a skeleton instead of null so the page never flashes blank
    // during the guard's first-load check + redirect. Matches the visual
    // weight of the contacts list so the transition is seamless.
    return (
      <div
        className="flex flex-1 flex-col gap-6 p-6 pt-0"
        aria-busy="true"
        aria-live="polite"
        data-testid="contacts-guard-loading"
      >
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  return <>{children}</>
}
