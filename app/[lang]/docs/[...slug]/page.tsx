import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Folder,
  ListNumbers,
  CheckCircle,
  Translate,
  BookOpenText,
} from "@phosphor-icons/react/dist/ssr"
import { prisma } from "@/lib/prisma"
import { renderMarkdownToHtml } from "@/lib/markdown"
import { MermaidRenderer } from "../components/mermaid-renderer"
import { CodeBlockCopyEnhancer } from "../components/code-copy-enhancer"
import { OnThisPage, type TocItem } from "../components/on-this-page"
type Props = {
  params: Promise<{ lang: string; slug: string[] }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params
  const docPath = `/${slug.join("/")}`

  let doc = await prisma.docsKnowledgeDocument.findFirst({
    where: {
      path: docPath,
      locale: lang,
      organizationId: null,
      isPublic: true,
    },
    select: { title: true, purpose: true },
  })

  if (!doc && lang !== "en") {
    doc = await prisma.docsKnowledgeDocument.findFirst({
      where: {
        path: docPath,
        locale: "en",
        organizationId: null,
        isPublic: true,
      },
      select: { title: true, purpose: true },
    })
  }

  if (!doc) {
    return {
      title: "Document Not Found — PFNApp Docs",
    }
  }

  return {
    title: `${doc.title} — PFNApp Docs`,
    description: doc.purpose,
  }
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/&amp;/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
}

// Extract H2 (##) and H3 (###) sections for on-page Table of Contents
function extractToc(markdown: string): TocItem[] {
  const headingMatches = markdown.matchAll(/^(#{2,3})\s+(.+)$/gm)
  const headings: TocItem[] = []
  for (const match of headingMatches) {
    const level = match[1].length === 2 ? 2 : 3
    const text = match[2].trim()
    const id = slugifyHeading(text)
    headings.push({ text, id, level })
  }
  return headings
}

// Inject id attributes to <h2> and <h3> tags in rendered HTML so anchor links jump correctly
function injectHeadingIds(html: string): string {
  let result = html.replace(/<h2(.*?)>(.*?)<\/h2>/gi, (_match, attrs, text) => {
    const rawText = text.replace(/<[^>]*>/g, "")
    const id = slugifyHeading(rawText)
    return `<h2${attrs} id="${id}">${text}</h2>`
  })

  result = result.replace(/<h3(.*?)>(.*?)<\/h3>/gi, (_match, attrs, text) => {
    const rawText = text.replace(/<[^>]*>/g, "")
    const id = slugifyHeading(rawText)
    return `<h3${attrs} id="${id}">${text}</h3>`
  })

  return result
}

function estimateReadingTime(text: string): number {
  const words = text.trim().split(/\s+/).length
  return Math.max(1, Math.ceil(words / 180))
}

export default async function PublicDocDetailPage({ params }: Props) {
  const { lang, slug } = await params
  const docPath = `/${slug.join("/")}`

  // 1. Fetch document matching the active locale
  let doc = await prisma.docsKnowledgeDocument.findFirst({
    where: {
      path: docPath,
      locale: lang,
      organizationId: null,
      isPublic: true,
    },
  })

  let isFallback = false

  // 2. If translation is missing, fallback smoothly to English
  if (!doc && lang !== "en") {
    doc = await prisma.docsKnowledgeDocument.findFirst({
      where: {
        path: docPath,
        locale: "en",
        organizationId: null,
        isPublic: true,
      },
    })
    if (doc) isFallback = true
  }

  if (!doc) {
    notFound()
  }

  // Fetch all docs in the same category for continuous bottom pagination (Prev / Next)
  const categoryDocs = await prisma.docsKnowledgeDocument.findMany({
    where: {
      category: doc.category,
      locale: isFallback ? "en" : lang,
      organizationId: null,
      isPublic: true,
    },
    select: {
      path: true,
      title: true,
      purpose: true,
    },
    orderBy: { path: "asc" },
  })

  const currentIndex = categoryDocs.findIndex((d) => d.path === doc.path)
  const prevDoc = currentIndex > 0 ? categoryDocs[currentIndex - 1] : null
  const nextDoc =
    currentIndex >= 0 && currentIndex < categoryDocs.length - 1
      ? categoryDocs[currentIndex + 1]
      : null

  const rawMarkdown = doc.contentMarkdown || ""
  const toc = extractToc(rawMarkdown)
  const readTimeMinutes = estimateReadingTime(rawMarkdown)

  // Strip initial redundant markdown # Title if present to prevent double heading
  const cleanedMarkdown = rawMarkdown.replace(/^#\s+.+\r?\n/, "")
  const rawHtml = renderMarkdownToHtml(cleanedMarkdown)
  const renderedHtml = injectHeadingIds(rawHtml)

  return (
    <div className="flex w-full flex-col gap-10 xl:flex-row xl:items-start xl:gap-12">
      {/* Center Reading Content */}
      <div className="min-w-0 flex-1 space-y-10">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Link
            href={`/${lang}/docs`}
            className="flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <ArrowLeft size={12} />
            <span>{lang === "id" ? "Dokumentasi" : "Documentation"}</span>
          </Link>
          <span>/</span>
          <span className="flex items-center gap-1 text-foreground">
            <Folder size={13} className="text-emerald-500" />
            <span>{doc.category}</span>
          </span>
        </div>

        {/* Fallback Language Notice */}
        {isFallback && (
          <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-600 dark:text-amber-400">
            <Translate size={18} className="shrink-0" />
            <span>
              {lang === "id"
                ? "Artikel ini belum diterjemahkan ke Bahasa Indonesia. Menampilkan versi Bahasa Inggris."
                : "This article is not yet available in your selected language. Showing English version."}
            </span>
          </div>
        )}

        {/* Hero Header */}
        <header className="space-y-4 border-b border-border/40 pb-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle size={13} weight="fill" />
              <span>
                {lang === "id" ? "Panduan Terverifikasi" : "Verified Guide"}
              </span>
            </span>
            <span className="rounded-md bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {doc.category}
            </span>
            <span className="rounded-md border border-border/60 bg-card px-2 py-0.5 text-[11px] font-semibold text-foreground uppercase">
              {doc.locale.toUpperCase()}
            </span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {doc.title}
          </h1>

          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            {doc.purpose}
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <BookOpenText size={14} className="text-emerald-500" />
              <span>
                {readTimeMinutes} {lang === "id" ? "menit baca" : "min read"}
              </span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Clock size={14} />
              <span>
                {lang === "id" ? "Diperbarui" : "Last updated"}{" "}
                {new Date(doc.updatedAt).toLocaleDateString(
                  lang === "id" ? "id-ID" : "en-US"
                )}
              </span>
            </span>
            <span>•</span>
            <span className="font-mono text-[11px] text-muted-foreground/80">
              {doc.path}
            </span>
          </div>
        </header>

        {/* Prose Markdown Body */}
        <article
          className="prose max-w-none dark:prose-invert [&_blockquote]:my-6 [&_blockquote]:rounded-xl [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-500 [&_blockquote]:bg-emerald-500/10 [&_blockquote]:p-4 [&_blockquote]:text-sm [&_blockquote]:text-foreground [&_code]:rounded-md [&_code]:border [&_code]:border-emerald-500/20 [&_code]:bg-emerald-500/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_code]:font-medium [&_code]:text-emerald-600 dark:[&_code]:text-emerald-400 [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:scroll-mt-28 [&_h2]:border-b [&_h2]:border-border/50 [&_h2]:pb-2 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:scroll-mt-28 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_hr]:my-8 [&_hr]:border-border/40 [&_img]:rounded-xl [&_img]:border [&_img]:border-border/50 [&_img]:shadow-md [&_li]:text-sm [&_li]:leading-relaxed [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-muted-foreground sm:[&_p]:text-base [&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-xl [&_table]:border [&_table]:border-border/60 [&_td]:border-b [&_td]:border-border/40 [&_td]:p-3 [&_td]:text-xs sm:[&_td]:text-sm [&_th]:border-b [&_th]:border-border/60 [&_th]:bg-muted/50 [&_th]:p-3 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-foreground sm:[&_th]:text-sm [&_tr:last-child_td]:border-b-0"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
        <MermaidRenderer />
        <CodeBlockCopyEnhancer />

        {/* Bottom Pagination Flow (Previous / Next Article Cards) */}
        {(prevDoc || nextDoc) && (
          <nav
            aria-label="Document Pagination"
            className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2"
          >
            {prevDoc ? (
              <Link
                href={`/${lang}/docs/${prevDoc.path.replace(/^\//, "")}`}
                className="group flex flex-col gap-1.5 rounded-2xl border border-border/50 bg-card/40 p-5 transition-all hover:border-emerald-500/40 hover:bg-card/80 hover:shadow-sm"
              >
                <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground group-hover:text-emerald-500">
                  <ArrowLeft size={12} />
                  <span>{lang === "id" ? "SEBELUMNYA" : "PREVIOUS"}</span>
                </div>
                <span className="text-sm font-semibold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                  {prevDoc.title}
                </span>
                <span className="line-clamp-1 text-xs text-muted-foreground">
                  {prevDoc.purpose}
                </span>
              </Link>
            ) : (
              <div />
            )}

            {nextDoc && (
              <Link
                href={`/${lang}/docs/${nextDoc.path.replace(/^\//, "")}`}
                className="group flex flex-col items-end gap-1.5 rounded-2xl border border-border/50 bg-card/40 p-5 text-right transition-all hover:border-emerald-500/40 hover:bg-card/80 hover:shadow-sm"
              >
                <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground group-hover:text-emerald-500">
                  <span>{lang === "id" ? "SELANJUTNYA" : "NEXT"}</span>
                  <ArrowRight size={12} />
                </div>
                <span className="text-sm font-semibold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                  {nextDoc.title}
                </span>
                <span className="line-clamp-1 text-xs text-muted-foreground">
                  {nextDoc.purpose}
                </span>
              </Link>
            )}
          </nav>
        )}
      </div>

      {/* Right Column: Sticky Table of Contents */}
      {toc.length > 0 && (
        <aside className="sticky top-24 hidden w-64 shrink-0 self-start xl:block">
          <div className="space-y-3 rounded-2xl border border-border/40 bg-card/40 p-5 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
              <ListNumbers size={14} className="text-emerald-500" />
              <span>{lang === "id" ? "Daftar Isi" : "On this page"}</span>
            </div>
            <OnThisPage toc={toc} lang={lang} />
          </div>
        </aside>
      )}
    </div>
  )
}
