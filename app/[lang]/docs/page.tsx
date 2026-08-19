import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Sparkle } from "@phosphor-icons/react/dist/ssr"
import { prisma } from "@/lib/prisma"

type Props = {
  params: Promise<{ lang: string }>
}

export const metadata: Metadata = {
  title: "Documentation & Knowledge Base — PFNApp",
  description:
    "Explore developer guides, API references, and screenshot-guided tutorials for WhatsApp Business, App Hosting, and Cloud Services.",
}

export default async function PublicDocsIndexPage({ params }: Props) {
  const { lang } = await params

  const featuredDocs = await prisma.docsKnowledgeDocument.findMany({
    where: { organizationId: null, isPublic: true },
    select: {
      path: true,
      title: true,
      purpose: true,
      category: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 6,
  })

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <Sparkle size={14} weight="fill" />
          <span>Knowledge Base</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          PFNApp Platform Documentation
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Complete guides, screenshot tutorials, and API integration references
          to help you build and scale with PFNApp.
        </p>
      </div>

      {/* Featured Cards */}
      <div className="grid gap-6 sm:grid-cols-2">
        {featuredDocs.map((doc) => {
          const docSlug = doc.path.replace(/^\//, "")
          return (
            <Link
              key={doc.path}
              href={`/${lang}/docs/${docSlug}`}
              className="group flex flex-col justify-between rounded-xl border bg-card p-6 shadow-sm transition-all hover:border-emerald-500/40 hover:shadow-md"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {doc.category}
                  </span>
                  <ArrowRight
                    size={16}
                    className="text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-emerald-500"
                  />
                </div>
                <h3 className="text-lg leading-snug font-semibold transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                  {doc.title}
                </h3>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {doc.purpose}
                </p>
              </div>
              <div className="pt-4 text-xs text-muted-foreground/60">
                Updated {new Date(doc.updatedAt).toLocaleDateString()}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
