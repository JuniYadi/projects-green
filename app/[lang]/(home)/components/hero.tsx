"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, ArrowRight, CheckCircle } from "@phosphor-icons/react"
import { useState } from "react"

import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

const featuredApps = [
  {
    id: "hermes",
    name: "Hermes Agent",
    icon: "/app-hosting/icons/hermes.svg",
    storage: { id: "Memori tetap tersimpan", en: "Memory stays saved" },
    url: "hermes-agent.sg.pfnapp.dev",
  },
  {
    id: "9router",
    name: "9router",
    icon: "/app-hosting/icons/9router.svg",
    storage: { id: "Konfigurasi tetap tersimpan", en: "Settings stay saved" },
    url: "9router.sg.pfnapp.dev",
  },
  {
    id: "n8n",
    name: "n8n Automation",
    icon: "/app-hosting/icons/n8n.svg",
    storage: { id: "Data alur kerja tersimpan", en: "Workflows stay saved" },
    url: "n8n.sg.pfnapp.dev",
  },
] as const

export function HeroSection() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const isId = locale === "id"
  const [activeIndex, setActiveIndex] = useState(0)

  const selectNext = () =>
    setActiveIndex((index) => (index + 1) % featuredApps.length)
  const selectPrevious = () =>
    setActiveIndex(
      (index) => (index - 1 + featuredApps.length) % featuredApps.length
    )

  return (
    <section className="relative overflow-hidden bg-[#060b18] pt-32 pb-20 text-white md:pt-36 md:pb-28">
      <div className="pointer-events-none absolute top-0 right-0 h-[36rem] w-[36rem] rounded-full bg-emerald-500/8 blur-[120px]" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
        <div>
          <p className="mb-6 text-xs font-semibold tracking-[0.18em] text-emerald-400 uppercase">
            {isId ? "App Hosting PFNApp" : "PFNApp App Hosting"}
          </p>
          <h1 className="max-w-2xl text-[clamp(2.65rem,5vw,4.75rem)] leading-[1.08] font-semibold tracking-tight">
            {isId
              ? "Jalankan aplikasi Anda tanpa menyiapkan server."
              : "Run your apps without setting up a server."}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/65 md:text-lg">
            {isId
              ? "Pilih Hermes atau n8n, atau hubungkan repo Anda. PFNApp menyiapkan deployment, penyimpanan, dan URL aplikasi."
              : "Choose Hermes or n8n, or connect your repository. PFNApp sets up your deployment, storage, and app URL."}
          </p>
          <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href={`/${locale}#templates`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 sm:px-6 sm:text-base"
            >
              {isId
                ? "Lihat template siap deploy"
                : "Explore ready-to-deploy apps"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href={`/${locale}/login?next=%2F${locale}%2Fconsole%2Fapp%2Fdeploy`}
              className="inline-flex items-center justify-center rounded-xl px-5 py-3.5 font-medium text-white/75 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              {isId ? "Deploy dari Git →" : "Deploy from Git →"}
            </Link>
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-xs font-medium tracking-wide text-white/55 uppercase">
              {isId ? "Pilih aplikasi" : "Choose an app"}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectPrevious}
                aria-label={isId ? "Aplikasi sebelumnya" : "Previous app"}
                className="rounded-full border border-white/15 p-2 text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-400"
              >
                <ArrowLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={selectNext}
                aria-label={isId ? "Aplikasi berikutnya" : "Next app"}
                className="rounded-full border border-white/15 p-2 text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-400"
              >
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#101923] shadow-2xl shadow-black/30">
            <div
              className="flex motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out"
              style={{ transform: `translateX(-${activeIndex * 100}%)` }}
            >
              {featuredApps.map((app, index) => (
                <div
                  key={app.id}
                  className="min-w-full p-6 sm:p-8"
                  aria-hidden={index !== activeIndex}
                  inert={index !== activeIndex}
                >
                  <div className="flex items-center gap-4 border-b border-white/10 pb-6">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={app.icon} alt="" width={30} height={30} />
                    </div>
                    <div>
                      <p className="text-xs text-white/50">
                        {isId ? "Template aplikasi" : "App template"}
                      </p>
                      <p className="mt-1 text-lg font-semibold">{app.name}</p>
                    </div>
                  </div>
                  <div className="space-y-5 py-7 text-sm sm:text-base">
                    <p className="flex items-center gap-3 text-white/70">
                      <CheckCircle
                        className="size-5 shrink-0 text-emerald-400"
                        aria-hidden="true"
                      />
                      {isId ? "Pilih template" : "Choose a template"}
                    </p>
                    <p className="flex items-center gap-3 text-white/70">
                      <CheckCircle
                        className="size-5 shrink-0 text-emerald-400"
                        aria-hidden="true"
                      />
                      {app.storage[locale]}
                    </p>
                    <p className="flex items-center gap-3 text-white/70">
                      <CheckCircle
                        className="size-5 shrink-0 text-emerald-400"
                        aria-hidden="true"
                      />
                      {isId ? "URL aplikasi disiapkan" : "Your app gets a URL"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0b121a] px-4 py-3 text-sm">
                    <span className="size-2 shrink-0 rounded-full bg-emerald-400" />
                    <span className="truncate font-mono text-white/75">
                      {app.url}
                    </span>
                    <span className="ml-auto shrink-0 text-emerald-400">
                      {isId ? "Contoh" : "Preview"}
                    </span>
                  </div>
                  <Link
                    href={`/${locale}/login?next=${encodeURIComponent(`/${locale}/console/app/marketplace?template=${app.id}`)}`}
                    className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-400"
                  >
                    Deploy {app.name}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
          <div
            className="mt-4 flex justify-center gap-2"
            role="group"
            aria-label={isId ? "Pilih template" : "Select a template"}
          >
            {featuredApps.map((app, index) => (
              <button
                key={app.id}
                type="button"
                aria-label={app.name}
                aria-pressed={index === activeIndex}
                onClick={() => setActiveIndex(index)}
                className={`h-2 rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${index === activeIndex ? "w-8 bg-emerald-400" : "w-2 bg-white/30 hover:bg-white/60"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
