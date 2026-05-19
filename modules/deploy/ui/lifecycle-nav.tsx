"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

type LifecycleNavItem = {
  id: string
  label: string
  description: string
  href: string
}

const LIFECYCLE_NAV_ITEMS: LifecycleNavItem[] = [
  {
    id: "deploy",
    label: "Deploy",
    description: "Day-0 release setup",
    href: "/console/app/deploy",
  },
  {
    id: "operate",
    label: "Operate",
    description: "Day-1 runtime controls",
    href: "/console/app/deploy/operate",
  },
  {
    id: "observe",
    label: "Observe",
    description: "Day-2 health and telemetry",
    href: "/console/app/deploy/observe",
  },
]

const resolveActiveItem = (pathname: string): string => {
  if (pathname.startsWith("/console/app/deploy/observe")) {
    return "observe"
  }

  if (pathname.startsWith("/console/app/deploy/operate")) {
    return "operate"
  }

  return "deploy"
}

export function LifecycleNav() {
  const pathname = usePathname()
  const activeItem = resolveActiveItem(pathname)

  return (
    <nav
      className="grid gap-2 sm:grid-cols-3"
      aria-label="Deployment lifecycle views"
    >
      {LIFECYCLE_NAV_ITEMS.map((item) => {
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
