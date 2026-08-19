import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  Sparkle,
  ChatCircleDots,
  Cloud,
  Key,
  ShieldCheck,
  CodeBlock,
  CheckCircle,
} from "@phosphor-icons/react/dist/ssr"
import { prisma } from "@/lib/prisma"

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
    description: string
    color: string
    bg: string
  }
> = {
  WhatsApp: {
    icon: ChatCircleDots,
    description:
      "Cloud API integration, template management, webhook callbacks, and broadcasting.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  "App Hosting": {
    icon: Cloud,
    description:
      "Zero-config Docker deployment, custom domains, automated SSL, and health checks.",
    color: "text-blue-500",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  Security: {
    icon: ShieldCheck,
    description:
      "Authentication tokens, static API key lifecycle, WorkOS SSO, and audit trails.",
    color: "text-purple-500",
    bg: "bg-purple-500/10 border-purple-500/20",
  },
}

export default async function PublicDocsIndexPage({ params }: Props) {
  const { lang } = await params

  const allDocs = await prisma.docsKnowledgeDocument.findMany({
    where: { organizationId: null, isPublic: true },
    select: {
      path: true,
      title: true,
      purpose: true,
      category: true,
      updatedAt: true,
    },
    orderBy: [{ category: "asc" }, { path: "asc" }],
  })

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

  return (
    <div className="space-y-12 pb-12">
      {/* Hero Header */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <Sparkle size={14} weight="fill" />
          <span>PFNApp Knowledge Base & Guides</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          Documentation & Tutorials
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Step-by-step guides with real visual screenshots, API references, and
          practical code examples to help you integrate and scale.
        </p>
      </div>

      {/* Quick Start Pillars */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col justify-between rounded-xl border bg-card/60 p-5 backdrop-blur-sm">
          <div className="space-y-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Key size={20} weight="duotone" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">
              API Keys & Auth
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Generate static organization keys and authenticate your backend
              services securely.
            </p>
          </div>
          <Link
            href={`/${lang}/docs/whatsapp/api-keys`}
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-emerald-500 transition-colors hover:text-emerald-400"
          >
            <span>Read guide</span>
            <ArrowRight size={12} />
          </Link>
        </div>

        <div className="flex flex-col justify-between rounded-xl border bg-card/60 p-5 backdrop-blur-sm">
          <div className="space-y-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <CodeBlock size={20} weight="duotone" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">
              SDKs & Integration
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Copy-paste code samples for Node.js, Python, cURL, and webhook
              receivers.
            </p>
          </div>
          <Link
            href={`/${lang}/docs/whatsapp/api-keys#4-authenticating-api-requests`}
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-500 transition-colors hover:text-blue-400"
          >
            <span>View code examples</span>
            <ArrowRight size={12} />
          </Link>
        </div>

        <div className="flex flex-col justify-between rounded-xl border bg-card/60 p-5 backdrop-blur-sm">
          <div className="space-y-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
              <CheckCircle size={20} weight="duotone" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">
              Visual Guides
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Every workflow includes actual screenshots from the console
              dashboard.
            </p>
          </div>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <span>Verified with live UI</span>
          </span>
        </div>
      </div>

      {/* Categorized Documentation List */}
      <div className="space-y-8">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Explore by Category
        </h2>

        <div className="space-y-8">
          {Object.entries(categories).map(([categoryName, docs]) => {
            const meta = CATEGORY_META[categoryName] || {
              icon: ChatCircleDots,
              description: "Guides and documentation for this module.",
              color: "text-foreground",
              bg: "bg-muted border-border",
            }
            const Icon = meta.icon

            return (
              <div
                key={categoryName}
                className="overflow-hidden rounded-2xl border bg-card/40 backdrop-blur-sm"
              >
                <div className="border-b bg-muted/40 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex size-8 items-center justify-center rounded-lg border ${meta.bg}`}
                    >
                      <Icon size={18} className={meta.color} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        {categoryName}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {meta.description}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-border/40">
                  {docs.map((doc) => {
                    const docSlug = doc.path.replace(/^\//, "")
                    return (
                      <Link
                        key={doc.path}
                        href={`/${lang}/docs/${docSlug}`}
                        className="group flex flex-col justify-between gap-4 p-6 transition-all hover:bg-muted/30 sm:flex-row sm:items-center"
                      >
                        <div className="space-y-1.5">
                          <h4 className="text-base font-semibold text-foreground transition-colors group-hover:text-emerald-500">
                            {doc.title}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {doc.purpose}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-emerald-500">
                          <span>Read article</span>
                          <ArrowRight
                            size={14}
                            className="transition-transform group-hover:translate-x-1"
                          />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
