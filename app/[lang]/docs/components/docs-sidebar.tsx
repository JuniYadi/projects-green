"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookOpen,
  CaretDown,
  CaretRight,
  ChatCircleDots,
  Cloud,
  CreditCard,
  ShieldCheck,
  FileText,
  SidebarSimple,
  Sparkle,
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
  Billing: CreditCard,
  WhatsApp: ChatCircleDots,
  "App Hosting": Cloud,
  Security: ShieldCheck,
  General: FileText,
}

export function DocsSidebar({ lang, categories }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = React.useState(false)

  // Track manual user toggles (true = collapsed by user, false = open by user)
  const [collapsedCategories, setCollapsedCategories] = React.useState<
    Record<string, boolean>
  >({})

  const toggleCategory = (categoryName: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [categoryName]: !prev[categoryName],
    }))
  }

  return (
    <aside
      className={`shrink-0 transition-all duration-300 ease-in-out ${
        collapsed ? "w-12" : "w-full md:w-60 lg:w-64"
      }`}
    >
      <div className="sticky top-24 space-y-5">
        {/* Header / Collapse Toggle */}
        <div className="flex items-center justify-between px-1">
          {!collapsed && (
            <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-muted-foreground uppercase">
              <Sparkle size={13} className="text-emerald-500" />
              <span>
                {lang === "id" ? "Navigasi Dokumen" : "Documentation"}
              </span>
            </div>
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
          <div className="space-y-4">
            {/* Overview / Index Link */}
            <div className="space-y-1">
              <Link
                href={`/${lang}/docs`}
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                  pathname === `/${lang}/docs`
                    ? "border border-emerald-500/30 bg-emerald-500/10 font-semibold text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span className="flex items-center gap-2">
                  <BookOpen size={15} />
                  <span>
                    {lang === "id" ? "Ikhtisar & Panduan" : "Overview & Guides"}
                  </span>
                </span>
                <CaretRight size={13} className="text-muted-foreground/60" />
              </Link>
            </div>

            {/* Collapsible Category Groups */}
            <div className="space-y-3">
              {Object.entries(categories).map(([categoryName, docs]) => {
                const CategoryIcon = CATEGORY_ICONS[categoryName] || FileText
                const activeInThisCat = docs.some((d) => {
                  const docSlug = d.path.replace(/^\//, "")
                  return pathname === `/${lang}/docs/${docSlug}`
                })

                // Default open if active or WhatsApp, unless explicitly toggled
                const isDefaultOpen =
                  activeInThisCat || categoryName === "WhatsApp"
                const isOpen =
                  collapsedCategories[categoryName] !== undefined
                    ? !collapsedCategories[categoryName]
                    : isDefaultOpen

                return (
                  <div
                    key={categoryName}
                    className="overflow-hidden rounded-xl border border-border/40 bg-card/30"
                  >
                    {/* Category Accordion Header */}
                    <button
                      type="button"
                      onClick={() => toggleCategory(categoryName)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-[11px] font-bold tracking-wider uppercase transition-colors ${
                        activeInThisCat
                          ? "bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <CategoryIcon
                          size={14}
                          className={
                            activeInThisCat
                              ? "text-emerald-500"
                              : "text-muted-foreground"
                          }
                        />
                        <span>{categoryName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="py-0.2 rounded-full bg-muted/80 px-1.5 text-[10px] font-medium text-muted-foreground">
                          {docs.length}
                        </span>
                        {isOpen ? (
                          <CaretDown
                            size={12}
                            className="text-muted-foreground"
                          />
                        ) : (
                          <CaretRight
                            size={12}
                            className="text-muted-foreground"
                          />
                        )}
                      </div>
                    </button>

                    {/* Category Item Links */}
                    {isOpen && (
                      <nav className="space-y-0.5 border-t border-border/30 p-1.5">
                        {docs.map((doc) => {
                          const docSlug = doc.path.replace(/^\//, "")
                          const docUrl = `/${lang}/docs/${docSlug}`
                          const isActive = pathname === docUrl
                          return (
                            <Link
                              key={doc.path}
                              href={docUrl}
                              className={`group relative flex items-center rounded-lg px-2.5 py-1.5 text-xs transition-all ${
                                isActive
                                  ? "bg-emerald-500/15 font-semibold text-emerald-600 dark:text-emerald-400"
                                  : "font-normal text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                              }`}
                            >
                              {isActive && (
                                <span className="absolute top-1/2 left-0 h-3.5 w-1 -translate-y-1/2 rounded-r-full bg-emerald-500" />
                              )}
                              <span className="line-clamp-1 pl-1">
                                {doc.title}
                              </span>
                            </Link>
                          )
                        })}
                      </nav>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
