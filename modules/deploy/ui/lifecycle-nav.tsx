"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { defaultLocale, type AppLocale } from "@/lib/i18n/config"
import { getLocaleFromPathname, localizePathname } from "@/lib/i18n/pathname"
import { cn } from "@/lib/utils"

type LifecycleNavItem = {
  id: string
  label: string
  description: string
  href: string
}

const buildLifecycleNavItems = (locale: AppLocale): LifecycleNavItem[] => [
  {
    id: "deploy",
    label: "Deploy",
    description: "Day-0 release setup",
    href: localizePathname({ pathname: "/console/app/deploy", locale }),
  },
  {
    id: "manage",
    label: "Manage",
    description: "Day-1 runtime controls",
    href: localizePathname({
      pathname: "/console/app/manage",
      locale,
    }),
  },
  {
    id: "monitoring",
    label: "Monitoring",
    description: "Day-2 health and telemetry",
    href: localizePathname({
      pathname: "/console/app/monitoring",
      locale,
    }),
  },
]

const resolveActiveItem = (pathname: string): string => {
  if (pathname.startsWith("/console/app/monitoring")) {
    return "monitoring"
  }

  if (pathname.startsWith("/console/app/manage")) {
    return "manage"
  }

  return "deploy"
}

export function LifecycleNav() {
  const pathname = usePathname()
  const { locale, pathnameWithoutLocale } = getLocaleFromPathname(pathname)
  const activeItem = resolveActiveItem(pathnameWithoutLocale)
  const items = buildLifecycleNavItems((locale ?? defaultLocale) as AppLocale)

  return (
    <nav
      className="grid gap-2 sm:grid-cols-3"
      aria-label="Deployment lifecycle views"
    >
      {items.map((item) => {
        const isActive = item.id === activeItem

        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "rounded-md border px-4 py-3 text-left text-sm transition-colors",
              isActive
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background hover:bg-muted/50"
            )}
          >
            <p className="font-medium">{item.label}</p>
            <p className="text-muted-foreground">{item.description}</p>
          </Link>
        )
      })}
    </nav>
  )
}
