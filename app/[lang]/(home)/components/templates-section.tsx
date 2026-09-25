"use client"

import Link from "next/link"
import { useParams } from "next/navigation"

import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

const apps = [
  {
    id: "hermes",
    name: "Hermes Agent",
    icon: "/app-hosting/icons/hermes.svg",
    description: {
      id: "Bot AI dengan memori persisten",
      en: "AI agent with persistent memory",
    },
    available: true,
  },
  {
    id: "9router",
    name: "9router",
    icon: "/app-hosting/icons/9router.svg",
    description: {
      id: "Satu pintu untuk berbagai model AI",
      en: "One gateway for multiple AI models",
    },
    available: true,
  },
  {
    id: "n8n",
    name: "n8n Automation",
    icon: "/app-hosting/icons/n8n.svg",
    description: {
      id: "Otomasi alur kerja dan integrasi",
      en: "Workflows and integrations",
    },
    available: true,
  },
  {
    id: "openclaw",
    name: "OpenClaw",
    icon: "/app-hosting/icons/openclaw.svg",
    description: { id: "Pengumpulan data web", en: "Web data collection" },
    available: false,
  },
  {
    id: "omniroute",
    name: "OmniRoute",
    icon: null,
    description: { id: "Routing model AI", en: "AI model routing" },
    available: false,
  },
  {
    id: "wordpress",
    name: "WordPress",
    icon: null,
    description: { id: "Situs web dan konten", en: "Websites and content" },
    available: false,
  },
] as const

export function TemplatesSection() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const isId = locale === "id"
  const ticketPath = `/${locale}/console/support-tickets/new`

  return (
    <section
      id="templates"
      className="scroll-mt-24 bg-slate-50 py-16 sm:py-20 dark:bg-[#060b18]"
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-8">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-white">
            {isId
              ? "Pilih aplikasi yang ingin dijalankan"
              : "Choose what to run"}
          </h2>
          <p className="mt-3 text-slate-600 dark:text-white/60">
            {isId
              ? "Tersedia sekarang atau sedang disiapkan."
              : "Available now or in preparation."}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => {
            const content = (
              <>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5">
                  {app.icon ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={app.icon}
                      alt=""
                      width={24}
                      height={24}
                      className="size-6 object-contain"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="size-2 rounded-full bg-slate-400"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {app.name}
                    </h3>
                    <span
                      className={`text-xs ${
                        app.available
                          ? "font-medium text-emerald-600 dark:text-emerald-400"
                          : "text-slate-500 dark:text-white/50"
                      }`}
                    >
                      {app.available
                        ? isId
                          ? "Deploy →"
                          : "Deploy →"
                        : isId
                          ? "Dalam persiapan"
                          : "In preparation"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-white/60">
                    {app.description[locale]}
                  </p>
                </div>
              </>
            )

            if (app.available) {
              const deployPath = `/${locale}/console/app/deploy?template=${app.id}`
              return (
                <Link
                  key={app.id}
                  href={`/${locale}/login?next=${encodeURIComponent(deployPath)}`}
                  className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-emerald-500/50 hover:shadow-sm dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-emerald-500/30"
                >
                  {content}
                </Link>
              )
            }

            return (
              <div
                key={app.id}
                className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 opacity-75 dark:border-white/10 dark:bg-white/[0.03]"
              >
                {content}
              </div>
            )
          })}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6 text-sm dark:border-white/10">
          <p className="text-slate-600 dark:text-white/60">
            {isId ? "Butuh template lain?" : "Need another template?"}
          </p>
          <Link
            href={`/${locale}/login?next=${encodeURIComponent(ticketPath)}`}
            className="font-medium text-slate-900 underline underline-offset-4 hover:text-emerald-700 dark:text-white dark:hover:text-emerald-300"
          >
            {isId ? "Ajukan lewat tiket →" : "Request via ticket →"}
          </Link>
        </div>
      </div>
    </section>
  )
}
