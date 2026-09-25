"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
} from "@phosphor-icons/react"
import { useEffect, useState } from "react"

import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { HomeOffer } from "../home-offer"
import { usePreviewCarousel } from "./use-preview-carousel"

const featuredApps = [
  {
    id: "hermes",
    name: "Hermes Agent",
    icon: "/app-hosting/icons/hermes.svg",
  },
  {
    id: "9router",
    name: "9router",
    icon: "/app-hosting/icons/9router.svg",
  },
  {
    id: "n8n",
    name: "n8n Automation",
    icon: "/app-hosting/icons/n8n.svg",
  },
] as const

function AppPreviewDetails({
  appId,
  locale,
}: {
  appId: (typeof featuredApps)[number]["id"]
  locale: "id" | "en"
}) {
  const [previewStep, setPreviewStep] = useState(0)
  const isId = locale === "id"

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const timer = window.setTimeout(() => setPreviewStep(4), 0)
      return () => window.clearTimeout(timer)
    }

    const firstTimer = window.setTimeout(() => setPreviewStep(1), 450)
    const secondTimer = window.setTimeout(() => setPreviewStep(2), 900)
    const thirdTimer = window.setTimeout(() => setPreviewStep(3), 1350)
    const fourthTimer = window.setTimeout(() => setPreviewStep(4), 1800)
    return () => {
      window.clearTimeout(firstTimer)
      window.clearTimeout(secondTimer)
      window.clearTimeout(thirdTimer)
      window.clearTimeout(fourthTimer)
    }
  }, [])

  const reveal = (step: number) =>
    `transition-opacity duration-300 motion-reduce:transition-none ${previewStep >= step ? "opacity-100" : "opacity-40"}`

  return (
    <div
      className="min-h-48 py-4 text-xs sm:text-sm"
      aria-label={isId ? "Ilustrasi penggunaan" : "Usage illustration"}
    >
      {appId === "hermes" && (
        <div className="space-y-2">
          {[
            {
              from: "you",
              id: "Bantu pecah rencana launching jadi tugas kecil.",
              en: "Break my launch plan into smaller tasks.",
            },
            {
              from: "hermes",
              id: "Mulai dari halaman produk, pembayaran, lalu uji coba.",
              en: "Start with the product page, payments, then a trial run.",
            },
            {
              from: "you",
              id: "Apa yang harus dikerjakan dulu?",
              en: "What should I work on first?",
            },
            {
              from: "hermes",
              id: "Halaman produk. Tulis manfaat utamanya dulu.",
              en: "The product page. Write its main benefit first.",
            },
          ].map((message, index) => (
            <div
              key={index}
              className={`${reveal(index)} ${message.from === "you" ? "ml-auto max-w-[84%]" : "max-w-[84%]"}`}
            >
              <p
                className={`mb-0.5 text-[11px] ${message.from === "you" ? "text-right text-slate-500 dark:text-white/50" : "font-medium text-emerald-700 dark:text-emerald-400"}`}
              >
                {message.from === "you" ? (isId ? "Anda" : "You") : "Hermes"}
              </p>
              <p
                className={`rounded-xl px-3 py-2 text-slate-800 dark:text-white/90 ${message.from === "you" ? "rounded-tr-sm bg-slate-100 dark:bg-white/10" : "rounded-tl-sm border border-slate-200 dark:border-white/10"}`}
              >
                {message[locale]}
              </p>
            </div>
          ))}
        </div>
      )}
      {appId === "9router" && (
        <div className="font-mono text-[10px] sm:text-xs">
          {[
            {
              model: "GPT-6 Luna",
              input: "1.384",
              output: "839",
              time: isId ? "baru" : "now",
            },
            {
              model: "Claude Sonnet",
              input: "890",
              output: "318",
              time: isId ? "2 mnt" : "2 min",
            },
            {
              model: "Gemini Flash",
              input: "624",
              output: "211",
              time: isId ? "5 mnt" : "5 min",
            },
            {
              model: "DeepSeek V3",
              input: "1.102",
              output: "506",
              time: isId ? "8 mnt" : "8 min",
            },
            {
              model: "Qwen 3",
              input: "742",
              output: "284",
              time: isId ? "12 mnt" : "12 min",
            },
          ].map((request, index) => (
            <div
              key={request.model}
              className={`flex min-w-0 items-center gap-1.5 border-b border-slate-200 py-3 last:border-0 dark:border-white/10 ${reveal(index)}`}
            >
              <span className="min-w-0 flex-1 truncate font-medium text-slate-900 dark:text-white">
                {request.model}
              </span>
              <span
                className="inline-flex items-center gap-1 text-slate-600 tabular-nums dark:text-white/70"
                aria-label={`Input ${request.input} token`}
              >
                <ArrowUp className="size-3" aria-hidden="true" />
                {request.input}
              </span>
              <span
                className="inline-flex items-center gap-1 text-slate-600 tabular-nums dark:text-white/70"
                aria-label={`Output ${request.output} token`}
              >
                <ArrowDown className="size-3" aria-hidden="true" />
                {request.output}
              </span>
              <span className="w-10 shrink-0 text-right whitespace-nowrap text-slate-500 dark:text-white/45">
                {request.time}
              </span>
            </div>
          ))}
        </div>
      )}
      {appId === "n8n" && (
        <div className="relative">
          <div
            className="absolute top-3 bottom-3 left-1/2 w-px -translate-x-1/2 bg-emerald-500/50"
            aria-hidden="true"
          />
          {(
            [
              { app: "Email", action: isId ? "Pesanan masuk" : "New order" },
              {
                app: "Google Drive",
                action: isId ? "Simpan lampiran" : "Save attachment",
              },
              {
                app: "Calendar",
                action: isId ? "Jadwalkan tindak lanjut" : "Schedule follow-up",
              },
              {
                app: "Email",
                action: isId ? "Kirim konfirmasi" : "Send confirmation",
              },
            ] as const
          ).map((step, index) => (
            <div
              key={index}
              className={`relative grid grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)] items-center py-2 ${reveal(index)}`}
            >
              <div
                className={
                  index % 2 === 0
                    ? "pr-3 text-right"
                    : "col-start-3 pl-3 text-left"
                }
              >
                <p className="font-semibold text-slate-900 dark:text-white">
                  {step.app}
                </p>
                <p className="text-slate-600 dark:text-white/65">
                  {step.action}
                </p>
              </div>
              <span
                className="relative z-10 col-start-2 row-start-1 mx-auto size-2 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-[#101923]"
                aria-hidden="true"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function HeroSection({ offer }: { offer: HomeOffer }) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const isId = locale === "id"
  const promo = offer.kind === "promo"
  const standardPrice =
    offer.kind === "standard" && offer.monthlyPriceIdr
      ? new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0,
        }).format(Number(offer.monthlyPriceIdr))
      : null
  const { activeIndex, setActiveIndex, setPaused } = usePreviewCarousel(
    featuredApps.length
  )

  const selectNext = () =>
    setActiveIndex((index) => (index + 1) % featuredApps.length)
  const selectPrevious = () =>
    setActiveIndex(
      (index) => (index - 1 + featuredApps.length) % featuredApps.length
    )

  return (
    <section className="relative overflow-hidden bg-slate-50 pt-32 pb-20 text-slate-950 md:pt-36 md:pb-28 dark:bg-[#060b18] dark:text-white">
      <div className="pointer-events-none absolute top-0 right-0 h-[36rem] w-[36rem] rounded-full bg-emerald-500/8 blur-[120px]" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
        <div>
          <p className="mb-6 text-xs font-semibold tracking-[0.18em] text-emerald-700 uppercase dark:text-emerald-400">
            {promo
              ? isId
                ? "PROMO PELUNCURAN"
                : "LAUNCH OFFER"
              : isId
                ? "HERMES AGENT DI PFNAPP"
                : "HERMES AGENT ON PFNAPP"}
          </p>
          <h1 className="max-w-2xl text-[clamp(2.65rem,5vw,4.75rem)] leading-[1.08] font-semibold tracking-tight">
            {promo
              ? isId
                ? "AI Assistance seharga secangkir kopi? Emang bisa?"
                : "An AI assistant for the price of a cup of coffee? Really?"
              : isId
                ? "Jalankan AI assistant Anda tanpa mengurus server."
                : "Run your AI assistant without managing a server."}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600 md:text-lg dark:text-white/65">
            {promo
              ? isId
                ? "Mulai Rp9.900/bulan untuk 15 pelanggan pertama; harga tetap saat perpanjangan. Jalankan Hermes sekarang, lalu ganti template tanpa langganan baru. OpenClaw sedang disiapkan."
                : "Rp9,900/month for the first 15 customers, including renewals. Start with Hermes, then switch templates without a new subscription. OpenClaw is in preparation."
              : isId
                ? `${standardPrice ? `Paket Starter mulai ${standardPrice}/bulan. ` : "Harga reguler berlaku; lihat paket di konsol. "}Jalankan Hermes sekarang, lalu ganti template tanpa langganan baru. OpenClaw sedang disiapkan.`
                : `${standardPrice ? `Starter plans from ${standardPrice}/month. ` : "Regular pricing applies; see plans in the console. "}Start with Hermes, then switch templates without a new subscription. OpenClaw is in preparation.`}
          </p>
          <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href={`/${locale}/login?next=${encodeURIComponent(`/${locale}/console/app/marketplace`)}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 sm:px-6 sm:text-base"
            >
              {isId ? "Jelajahi marketplace" : "Explore marketplace"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href={`/${locale}#templates`}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-medium text-slate-700 transition-colors hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 dark:text-white/75 dark:hover:text-white"
            >
              {isId ? "Lihat template lain" : "Explore other templates"}
              <ArrowDown className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div
          className="min-w-0"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setPaused(false)
            }
          }}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-xs font-medium tracking-wide text-slate-600 uppercase dark:text-white/55">
              {isId ? "LIHAT CONTOH APLIKASI" : "APP PREVIEW"}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectPrevious}
                aria-label={isId ? "Aplikasi sebelumnya" : "Previous app"}
                className="rounded-full border border-slate-300 p-2 text-slate-700 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-emerald-400 dark:border-white/15 dark:text-white/70 dark:hover:text-white"
              >
                <ArrowLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={selectNext}
                aria-label={isId ? "Aplikasi berikutnya" : "Next app"}
                className="rounded-full border border-slate-300 p-2 text-slate-700 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-emerald-400 dark:border-white/15 dark:text-white/70 dark:hover:text-white"
              >
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-[#101923] dark:shadow-2xl dark:shadow-black/30">
            <div
              className="flex motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out"
              style={{ transform: `translateX(-${activeIndex * 100}%)` }}
            >
              {featuredApps.map((app, index) => (
                <div
                  key={app.id}
                  className="min-w-full p-5 sm:p-6"
                  aria-hidden={index !== activeIndex}
                  inert={index !== activeIndex}
                >
                  <div className="flex items-center gap-3 border-b border-slate-200 pb-4 dark:border-white/10">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={app.icon}
                        alt=""
                        width={23}
                        height={23}
                        className="size-6 object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{app.name}</p>
                    </div>
                  </div>
                  {index === activeIndex && (
                    <AppPreviewDetails appId={app.id} locale={locale} />
                  )}
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
                className={`h-2 rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${index === activeIndex ? "w-8 bg-emerald-600" : "w-2 bg-slate-300 hover:bg-slate-500 dark:bg-white/30 dark:hover:bg-white/60"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
