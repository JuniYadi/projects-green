import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  Sparkle,
  ChatCircleDots,
  Cloud,
  CreditCard,
  Key,
  ShieldCheck,
  CodeBlock,
  RocketLaunch,
  Receipt,
  EnvelopeSimpleOpen,
  ArrowSquareOut,
} from "@phosphor-icons/react/dist/ssr"
import { prisma } from "@/lib/prisma"
import { DocsSearch } from "./components/docs-search"

type Props = {
  params: Promise<{ lang: string }>
}

export const metadata: Metadata = {
  title: "Documentation & Knowledge Base — PFNApp",
  description:
    "Explore developer guides, API references, and screenshot-guided tutorials for WhatsApp Business, App Hosting, and Cloud Services.",
}

const CATEGORY_META: Record<
  string,
  {
    icon: typeof ChatCircleDots
    descriptionEn: string
    descriptionId: string
    color: string
    bg: string
  }
> = {
  Billing: {
    icon: CreditCard,
    descriptionEn:
      "Organization deposit balance, automated renewals, invoice receipts, and top-ups.",
    descriptionId:
      "Saldo deposit organisasi, perpanjangan otomatis, mutasi invoice, dan pengisian saldo.",
    color: "text-amber-500",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  WhatsApp: {
    icon: ChatCircleDots,
    descriptionEn:
      "Cloud API integration, pre-approved templates, live chat, and broadcast dispatches.",
    descriptionId:
      "Integrasi Cloud API, template pesan resmi Meta, live chat, dan pengiriman siaran massal.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  "App Hosting": {
    icon: Cloud,
    descriptionEn:
      "Zero-config Docker deployment, custom domains, automated SSL, and compute scaling.",
    descriptionId:
      "Deploy Docker otomatis, domain kustom, SSL gratis, dan penskalaan komputasi.",
    color: "text-blue-500",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  Security: {
    icon: ShieldCheck,
    descriptionEn:
      "Authentication tokens, static API key lifecycle, and security audit trails.",
    descriptionId:
      "Token otentikasi, siklus hidup API key statis, dan jejak audit keamanan.",
    color: "text-purple-500",
    bg: "bg-purple-500/10 border-purple-500/20",
  },
}

export default async function PublicDocsIndexPage({ params }: Props) {
  const { lang } = await params
  const isId = lang === "id"

  // 1. Fetch docs for active locale
  let allDocs = await prisma.docsKnowledgeDocument.findMany({
    where: { organizationId: null, isPublic: true, locale: lang },
    select: {
      path: true,
      title: true,
      purpose: true,
      category: true,
      updatedAt: true,
    },
    orderBy: [{ category: "asc" }, { path: "asc" }],
  })

  // 2. Fallback to 'en' if no docs in this locale
  if (allDocs.length === 0 && lang !== "en") {
    allDocs = await prisma.docsKnowledgeDocument.findMany({
      where: { organizationId: null, isPublic: true, locale: "en" },
      select: {
        path: true,
        title: true,
        purpose: true,
        category: true,
        updatedAt: true,
      },
      orderBy: [{ category: "asc" }, { path: "asc" }],
    })
  }

  // Group by category
  const categories = allDocs.reduce<Record<string, typeof allDocs>>(
    (acc, doc) => {
      const cat = doc.category || "General"
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(doc)
      return acc
    },
    {}
  )

  const searchableDocs = allDocs.map((d) => ({
    path: d.path,
    title: d.title,
    purpose: d.purpose,
    category: d.category || "General",
  }))

  return (
    <div className="space-y-12 pb-12">
      {/* Hero Header & Search */}
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Sparkle size={14} weight="fill" />
            <span>
              {isId
                ? "Knowledge Base & Panduan PFNApp"
                : "PFNApp Knowledge Base & Guides"}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {isId ? "Dokumentasi & Tutorial" : "Documentation & Tutorials"}
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {isId
              ? "Panduan ramah pemula, tangkapan layar antarmuka asli, dan spesifikasi API interaktif untuk membantu Anda memulai dengan cepat."
              : "Beginner-friendly guides, verified UI screenshots, and interactive API specs to help you get started in minutes."}
          </p>
        </div>

        {/* Live Search Component */}
        <DocsSearch lang={lang} documents={searchableDocs} />
      </div>

      {/* 🚀 Popular Quickstarts for Beginners */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
          <RocketLaunch size={15} className="text-emerald-500" />
          <span>{isId ? "Mulai Cepat Populer" : "Popular Quickstarts"}</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href={`/${lang}/docs/whatsapp/templates`}
            className="group flex flex-col justify-between rounded-2xl border border-border/50 bg-card/40 p-4 transition-all hover:border-emerald-500/40 hover:bg-card/80 hover:shadow-sm"
          >
            <div className="space-y-2">
              <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <EnvelopeSimpleOpen size={18} weight="duotone" />
              </div>
              <h3 className="text-sm font-semibold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                {isId ? "Buat Template WhatsApp" : "Create WhatsApp Template"}
              </h3>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {isId
                  ? "Panduan 3 langkah membuat dan mengajukan template resmi ke Meta."
                  : "3-step guide to design and submit pre-approved Meta message templates."}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <span>{isId ? "Buka panduan" : "Get started"}</span>
              <ArrowRight size={11} />
            </div>
          </Link>

          <Link
            href={`/${lang}/docs/whatsapp/api-keys`}
            className="group flex flex-col justify-between rounded-2xl border border-border/50 bg-card/40 p-4 transition-all hover:border-emerald-500/40 hover:bg-card/80 hover:shadow-sm"
          >
            <div className="space-y-2">
              <div className="flex size-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Key size={18} weight="duotone" />
              </div>
              <h3 className="text-sm font-semibold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400">
                {isId ? "Buat API Key WhatsApp" : "Get WhatsApp API Key"}
              </h3>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {isId
                  ? "Generate token rahasia untuk integrasi backend dan bot."
                  : "Generate your organization's secret token for backend integrations."}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              <span>{isId ? "Buka panduan" : "Get started"}</span>
              <ArrowRight size={11} />
            </div>
          </Link>

          <Link
            href={`/${lang}/docs/billing`}
            className="group flex flex-col justify-between rounded-2xl border border-border/50 bg-card/40 p-4 transition-all hover:border-blue-500/40 hover:bg-card/80 hover:shadow-sm"
          >
            <div className="space-y-2">
              <div className="flex size-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                <Receipt size={18} weight="duotone" />
              </div>
              <h3 className="text-sm font-semibold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {isId ? "Isi Saldo & Faktur" : "Top Up Balance & Invoices"}
              </h3>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {isId
                  ? "Panduan top up saldo deposit, pembayaran QRIS, dan unduh PDF invoice."
                  : "Manage organization deposits, payment methods, and PDF invoices."}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
              <span>{isId ? "Buka panduan" : "Get started"}</span>
              <ArrowRight size={11} />
            </div>
          </Link>

          <a
            href="/api/openapi"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col justify-between rounded-2xl border border-border/50 bg-card/40 p-4 transition-all hover:border-purple-500/40 hover:bg-card/80 hover:shadow-sm"
          >
            <div className="space-y-2">
              <div className="flex size-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
                <CodeBlock size={18} weight="duotone" />
              </div>
              <h3 className="text-sm font-semibold text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400">
                {isId ? "OpenAPI & Swagger" : "OpenAPI & Swagger"}
              </h3>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {isId
                  ? "Eksplorasi dokumentasi REST API interaktif dan skema payload."
                  : "Explore interactive API specifications, schemas, and live sandbox calls."}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-purple-600 dark:text-purple-400">
              <span>{isId ? "Buka /api/openapi" : "Open Reference"}</span>
              <ArrowSquareOut size={11} />
            </div>
          </a>
        </div>
      </div>

      {/* Categorized Documentation Grid */}
      <div className="space-y-8">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          {isId ? "Jelajahi Berdasarkan Kategori" : "Explore by Category"}
        </h2>

        <div className="grid gap-6 md:grid-cols-2">
          {Object.entries(categories).map(([categoryName, docs]) => {
            const meta = CATEGORY_META[categoryName] || {
              icon: ChatCircleDots,
              descriptionEn: "Guides and documentation for this module.",
              descriptionId: "Panduan dan dokumentasi untuk modul ini.",
              color: "text-foreground",
              bg: "bg-muted border-border",
            }
            const Icon = meta.icon

            return (
              <div
                key={categoryName}
                className="flex flex-col justify-between rounded-2xl border border-border/40 bg-card/40 p-5 shadow-sm backdrop-blur-sm"
              >
                <div>
                  {/* Category Header */}
                  <div className="flex items-center gap-3 border-b border-border/30 pb-4">
                    <div
                      className={`flex size-9 items-center justify-center rounded-xl border ${meta.bg}`}
                    >
                      <Icon size={18} className={meta.color} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-foreground">
                          {categoryName}
                        </h3>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {docs.length} {isId ? "artikel" : "guides"}
                        </span>
                      </div>
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {isId ? meta.descriptionId : meta.descriptionEn}
                      </p>
                    </div>
                  </div>

                  {/* Clean 1-Line Article Links */}
                  <div className="divide-y divide-border/20 pt-2">
                    {docs.map((doc) => {
                      const docSlug = doc.path.replace(/^\//, "")
                      return (
                        <Link
                          key={doc.path}
                          href={`/${lang}/docs/${docSlug}`}
                          className="group flex items-center justify-between py-2.5 text-xs transition-colors hover:text-emerald-500"
                        >
                          <span className="font-medium text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                            {doc.title}
                          </span>
                          <ArrowRight
                            size={12}
                            className="text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-500"
                          />
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
