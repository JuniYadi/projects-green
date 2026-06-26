"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { getPlatformRole } from "@/lib/platform-role-client"

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

  if (checking) {
    return null // ponytail: brief flash then redirect — no loading skeleton for a guard
  }

  if (shouldRedirect) {
    return null // Redirect already in-flight
  }

  return <>{children}</>
}
