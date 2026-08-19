import Link from "next/link"
import {
  Lightning,
  BookOpen,
  CaretRight,
  ChatCircleDots,
  Cloud,
  ShieldCheck,
  FileText,
} from "@phosphor-icons/react/dist/ssr"
import { prisma } from "@/lib/prisma"

type Props = {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}

const CATEGORY_ICONS: Record<string, typeof ChatCircleDots> = {
  WhatsApp: ChatCircleDots,
  "App Hosting": Cloud,
  Security: ShieldCheck,
  General: FileText,
}

export default async function PublicDocsLayout({ children, params }: Props) {
  const { lang } = await params

  // Fetch all public categories and documents for navigation
  const documents = await prisma.docsKnowledgeDocument.findMany({
    where: { organizationId: null, isPublic: true },
    select: {
      path: true,
      title: true,
      category: true,
    },
    orderBy: [{ category: "asc" }, { path: "asc" }],
  })

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

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-emerald-500/20 selection:text-emerald-400">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
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
              <span>Documentation</span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href={`/${lang}/console`}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm shadow-emerald-600/25 transition-all hover:bg-emerald-500 active:scale-95"
            >
              Console
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8">
        <div className="flex w-full flex-col gap-8 py-8 md:flex-row md:gap-10">
          {/* Left Navigation Sidebar */}
          <aside className="w-full shrink-0 md:w-64 lg:w-72">
            <div className="sticky top-24 space-y-6">
              <div>
                <Link
                  href={`/${lang}/docs`}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <span className="flex items-center gap-2">
                    <BookOpen size={16} />
                    <span>Overview & Guides</span>
                  </span>
                  <CaretRight size={14} className="text-muted-foreground/60" />
                </Link>
              </div>

              <div className="space-y-6">
                {Object.entries(categories).map(([categoryName, docs]) => {
                  const CategoryIcon = CATEGORY_ICONS[categoryName] || FileText
                  return (
                    <div key={categoryName} className="space-y-2">
                      <div className="flex items-center gap-2 px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        <CategoryIcon size={14} className="text-emerald-500" />
                        <span>{categoryName}</span>
                      </div>
                      <nav className="space-y-1">
                        {docs.map((doc) => {
                          const docSlug = doc.path.replace(/^\//, "")
                          return (
                            <Link
                              key={doc.path}
                              href={`/${lang}/docs/${docSlug}`}
                              className="group block rounded-lg px-3 py-2 text-sm leading-snug font-normal text-muted-foreground transition-all hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
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
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  )
}
