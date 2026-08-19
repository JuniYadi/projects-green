import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Clock, Folder } from "@phosphor-icons/react/dist/ssr"
import { prisma } from "@/lib/prisma"

type Props = {
  params: Promise<{ lang: string; slug: string[] }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const docPath = `/${slug.join("/")}`

  const doc = await prisma.docsKnowledgeDocument.findFirst({
    where: { path: docPath, organizationId: null, isPublic: true },
    select: { title: true, purpose: true },
  })

  if (!doc) {
    return {
      title: "Document Not Found — PFNApp Docs",
    }
  }

  return {
    title: `${doc.title} — PFNApp Docs`,
    description: doc.purpose,
    openGraph: {
      title: `${doc.title} — PFNApp Platform Documentation`,
      description: doc.purpose,
      type: "article",
    },
  }
}

export default async function PublicDocDetailPage({ params }: Props) {
  const { lang, slug } = await params
  const docPath = `/${slug.join("/")}`

  const doc = await prisma.docsKnowledgeDocument.findFirst({
    where: { path: docPath, organizationId: null, isPublic: true },
  })

  if (!doc) {
    notFound()
  }

  // Render markdown natively with Bun
  const rawMarkdown =
    doc.contentMarkdown ||
    `# ${doc.title}\n\n${doc.purpose}\n\n## Overview\n\n${doc.howTo.map((h) => `- ${h}`).join("\n")}`

  const renderedHtml = Bun.markdown.html(rawMarkdown)

  return (
    <div className="max-w-4xl space-y-8">
      {/* Breadcrumb / Back */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={`/${lang}/docs`}
          className="flex items-center gap-1 transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} />
          <span>Documentation</span>
        </Link>
        <span>/</span>
        <span className="flex items-center gap-1">
          <Folder size={14} />
          <span>{doc.category}</span>
        </span>
      </div>

      {/* Header Info */}
      <header className="space-y-3 border-b pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {doc.title}
        </h1>
        <p className="text-lg leading-relaxed text-muted-foreground">
          {doc.purpose}
        </p>
        <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock size={14} />
            <span>Updated {new Date(doc.updatedAt).toLocaleDateString()}</span>
          </span>
          <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px]">
            {doc.path}
          </span>
        </div>
      </header>

      {/* Rendered Markdown Body */}
      <article
        className="prose dark:prose-invert prose-headings:scroll-mt-24 prose-headings:font-bold prose-headings:text-foreground prose-h1:hidden prose-h2:text-2xl prose-h2:border-b prose-h2:pb-2 prose-h2:mt-8 prose-h3:text-lg prose-h3:mt-6 prose-p:leading-relaxed prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-code:text-emerald-600 dark:prose-code:text-emerald-400 prose-code:font-mono prose-code:bg-muted/80 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-border/60 prose-pre:rounded-xl prose-pre:p-4 prose-pre:shadow-sm prose-img:rounded-xl prose-img:border prose-img:shadow-md prose-img:my-6 prose-img:max-w-full max-w-none"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    </div>
  )
}
