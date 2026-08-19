import Link from "next/link"
import { Lightning, BookOpen, CaretRight } from "@phosphor-icons/react/dist/ssr"
import { prisma } from "@/lib/prisma"

type Props = {
  children: React.ReactNode
  params: Promise<{ lang: string }>
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
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link
              href={`/${lang}`}
              className="flex items-center gap-2 text-lg font-bold"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                <Lightning size={20} weight="fill" />
              </div>
              <span>PFNApp</span>
            </Link>
            <span className="font-light text-muted-foreground/40">/</span>
            <Link
              href={`/${lang}/docs`}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <BookOpen size={16} />
              <span>Documentation</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/${lang}/console`}
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              Console
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="container mx-auto max-w-7xl flex-1 px-6 py-8">
        <div className="flex flex-col gap-10 md:flex-row">
          {/* Sidebar Navigation */}
          <aside className="w-full shrink-0 md:w-64">
            <div className="sticky top-24 space-y-6">
              {Object.entries(categories).map(([category, docs]) => (
                <div key={category} className="space-y-2">
                  <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    {category}
                  </h4>
                  <ul className="space-y-1">
                    {docs.map((doc) => {
                      const docSlug = doc.path.replace(/^\//, "")
                      return (
                        <li key={doc.path}>
                          <Link
                            href={`/${lang}/docs/${docSlug}`}
                            className="group flex items-center justify-between rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <span className="truncate">{doc.title}</span>
                            <CaretRight
                              size={12}
                              className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                            />
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </aside>

          {/* Content Area */}
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  )
}
