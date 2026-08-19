"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookOpen,
  CaretRight,
  ChatCircleDots,
  Cloud,
  ShieldCheck,
  FileText,
  Code,
  SidebarSimple,
} from "@phosphor-icons/react"

interface SidebarProps {
  lang: string
  categories: Record<
    string,
    Array<{
      path: string
      title: string
      category: string | null
    }>
  >
}

const CATEGORY_ICONS: Record<string, typeof ChatCircleDots> = {
  WhatsApp: ChatCircleDots,
  "App Hosting": Cloud,
  Security: ShieldCheck,
  General: FileText,
}

export function DocsSidebar({ lang, categories }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = React.useState(false)

  return (
    <aside
      className={`shrink-0 transition-all duration-300 ease-in-out ${
        collapsed ? "w-12" : "w-full md:w-60 lg:w-64"
      }`}
    >
      <div className="sticky top-24 space-y-6">
        {/* Toggle Button */}
        <div className="flex items-center justify-between px-1">
          {!collapsed && (
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Navigation
            </span>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex size-8 items-center justify-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <SidebarSimple size={16} weight={collapsed ? "fill" : "regular"} />
          </button>
        </div>

        {!collapsed && (
          <>
            <div className="space-y-1">
              <Link
                href={`/${lang}/docs`}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  pathname === `/${lang}/docs`
                    ? "bg-emerald-500/10 font-semibold text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span className="flex items-center gap-2">
                  <BookOpen size={16} />
                  <span>Overview & Guides</span>
                </span>
                <CaretRight size={14} className="text-muted-foreground/60" />
              </Link>
              <Link
                href="/api/openapi"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <span className="flex items-center gap-2">
                  <Code size={16} className="text-blue-500" />
                  <span>OpenAPI Spec</span>
                </span>
                <CaretRight size={14} className="text-muted-foreground/60" />
              </Link>
            </div>

            <div className="space-y-5">
              {Object.entries(categories).map(([categoryName, docs]) => {
                const CategoryIcon = CATEGORY_ICONS[categoryName] || FileText
                return (
                  <div key={categoryName} className="space-y-1.5">
                    <div className="flex items-center gap-2 px-3 text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
                      <CategoryIcon size={13} className="text-emerald-500" />
                      <span>{categoryName}</span>
                    </div>
                    <nav className="space-y-0.5">
                      {docs.map((doc) => {
                        const docSlug = doc.path.replace(/^\//, "")
                        const docUrl = `/${lang}/docs/${docSlug}`
                        const isActive = pathname === docUrl
                        return (
                          <Link
                            key={doc.path}
                            href={docUrl}
                            className={`group block rounded-lg px-3 py-1.5 text-xs leading-relaxed transition-all ${
                              isActive
                                ? "bg-emerald-500/15 font-semibold text-emerald-600 dark:text-emerald-400"
                                : "font-normal text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            <span className="line-clamp-2">{doc.title}</span>
                          </Link>
                        )
                      })}
                    </nav>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
