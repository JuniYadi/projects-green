import Link from "next/link"
import {
  Lightning,
  BookOpen,
  Code,
  TerminalWindow,
} from "@phosphor-icons/react/dist/ssr"
import { prisma } from "@/lib/prisma"
import { DocsSidebar } from "./components/docs-sidebar"
import { LanguageFlags } from "./components/language-flags"
import { NavbarSearch } from "./components/navbar-search"
import { ThemeToggle } from "@/components/theme-toggle"
type Props = {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}
export const dynamic = "force-dynamic"

export default async function PublicDocsLayout({ children, params }: Props) {
  const { lang } = await params

  // 1. Fetch documents matching active locale
  let documents = await prisma.docsKnowledgeDocument.findMany({
    where: { organizationId: null, isPublic: true, locale: lang },
    select: {
      path: true,
      title: true,
      purpose: true,
      category: true,
    },
    orderBy: [{ category: "asc" }, { path: "asc" }],
  })

  // 2. If no docs found for this locale, fallback to 'en'
  if (documents.length === 0 && lang !== "en") {
    documents = await prisma.docsKnowledgeDocument.findMany({
      where: { organizationId: null, isPublic: true, locale: "en" },
      select: {
        path: true,
        title: true,
        purpose: true,
        category: true,
      },
      orderBy: [{ category: "asc" }, { path: "asc" }],
    })
  }

  // Group by category
  const categories = documents.reduce<Record<string, typeof documents>>(
    (acc, doc) => {
      const cat = doc.category || "General"
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(doc)
      return acc
    },
    {}
  )

  const searchableDocs = documents.map((d) => ({
    path: d.path,
    title: d.title,
    purpose: d.purpose,
    category: d.category || "General",
  }))

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-emerald-500/20 selection:text-emerald-400">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Logo & Section */}
          <div className="flex items-center gap-6">
            <Link
              href={`/${lang}`}
              className="flex items-center gap-2.5 transition-opacity hover:opacity-85"
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 shadow-sm shadow-emerald-500/20">
                <Lightning size={20} weight="fill" className="text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-foreground">
                PFNApp
              </span>
            </Link>
            <div className="h-5 w-px bg-border/60" />
            <Link
              href={`/${lang}/docs`}
              className="flex items-center gap-1.5 text-sm font-semibold text-foreground transition-colors hover:text-emerald-500"
            >
              <BookOpen
                size={16}
                weight="duotone"
                className="text-emerald-500"
              />
              <span>{lang === "id" ? "Dokumentasi" : "Documentation"}</span>
            </Link>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-3">
            {/* Global Search Button with Animated Modal */}
            <NavbarSearch lang={lang} documents={searchableDocs} />

            {/* OpenAPI Spec Reference Button */}
            <Link
              href="/api/openapi"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden h-9 items-center gap-1.5 rounded-xl border border-border/60 bg-card/60 px-3 text-xs font-semibold text-foreground shadow-sm backdrop-blur-sm transition-all hover:bg-muted md:inline-flex"
            >
              <Code size={15} className="text-blue-500" />
              <span>OpenAPI Reference</span>
            </Link>

            {/* Theme Toggle (Light / Dark Mode) */}
            <ThemeToggle />

            {/* Language Switcher Flags (Icon Only) */}
            <LanguageFlags currentLang={lang} />
            {/* Console Action Button with Icon */}
            <Link
              href={`/${lang}/console`}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow-sm shadow-emerald-600/25 transition-all hover:bg-emerald-500 active:scale-95"
            >
              <TerminalWindow size={16} weight="bold" />
              <span>Console</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Wide Container (up to 1440px) */}
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 px-4 sm:px-6 lg:px-8">
        <div className="flex w-full flex-col gap-8 py-8 md:flex-row md:gap-8 lg:gap-10">
          {/* Collapsible Left Navigation Sidebar */}
          <DocsSidebar lang={lang} categories={categories} />

          {/* Main Content Area (Expansive Width) */}
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  )
}
