"use client"

import { ArrowLeft, ArrowRight, Check } from "@phosphor-icons/react"
import { useParams } from "next/navigation"

import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { usePreviewCarousel } from "./use-preview-carousel"

const panels = ["Logs", "Metrics", "HTTP Traffic"] as const

export function WhyPFNAppSection() {
  const locale = resolveLocaleOrDefault(useParams<{ lang?: string }>()?.lang)
  const isId = locale === "id"
  const { activeIndex, setActiveIndex, setPaused } = usePreviewCarousel(
    panels.length
  )
  const reasons = isId
    ? [
        {
          title: "Tak perlu komputer menyala terus",
          detail: "Aplikasi berjalan di server, bukan di laptop atau STB Anda.",
        },
        {
          title: "Mulai dari template atau repo Git",
          detail: "Pilih aplikasi yang tersedia, atau deploy kode sendiri.",
        },
        {
          title: "Lihat apa yang terjadi setelah deploy",
          detail: "Buka log, pantau pemakaian resource dan trafik HTTP.",
        },
        {
          title: "Kelola dari satu tempat",
          detail: "Cek status, riwayat deploy, pengaturan, dan domain.",
        },
      ]
    : [
        {
          title: "No always-on computer required",
          detail: "Your app runs on a server, not your laptop or home device.",
        },
        {
          title: "Start with a template or Git repo",
          detail: "Choose an available app, or deploy your own code.",
        },
        {
          title: "See what happens after deployment",
          detail: "Read logs and monitor resource usage and HTTP traffic.",
        },
        {
          title: "Manage it in one place",
          detail: "Check status, deploy history, settings, and domains.",
        },
      ]

  return (
    <section className="bg-white py-20 text-slate-950 md:py-28 dark:bg-[#0b1220] dark:text-white">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
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
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
              {isId ? "LIHAT KONSOL APLIKASI" : "EXPLORE THE APP CONSOLE"}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                aria-label={isId ? "Fitur sebelumnya" : "Previous feature"}
                onClick={() =>
                  setActiveIndex(
                    (index) => (index + panels.length - 1) % panels.length
                  )
                }
                className="rounded-full border border-slate-300 p-2 text-slate-700 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-emerald-400 dark:border-white/15 dark:text-white/70 dark:hover:text-white"
              >
                <ArrowLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label={isId ? "Fitur berikutnya" : "Next feature"}
                onClick={() =>
                  setActiveIndex((index) => (index + 1) % panels.length)
                }
                className="rounded-full border border-slate-300 p-2 text-slate-700 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-emerald-400 dark:border-white/15 dark:text-white/70 dark:hover:text-white"
              >
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-700 bg-[#101923] text-slate-100 shadow-xl shadow-slate-950/15 dark:shadow-black/30">
            <div
              className="flex motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out"
              style={{ transform: `translateX(-${activeIndex * 100}%)` }}
            >
              {panels.map((panel, index) => (
                <div
                  key={panel}
                  className="min-w-full p-5 sm:p-6"
                  aria-hidden={index !== activeIndex}
                  inert={index !== activeIndex}
                >
                  <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                    <div>
                      <p className="text-sm font-semibold">{panel}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {panel === "Logs"
                          ? isId
                            ? "Lihat aktivitas aplikasi"
                            : "See app activity"
                          : panel === "Metrics"
                            ? isId
                              ? "Pantau pemakaian resource"
                              : "Monitor resource usage"
                            : isId
                              ? "Pahami kunjungan aplikasi"
                              : "Understand app visits"}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] text-slate-400">
                      {isId ? "Ilustrasi" : "Illustration"}
                    </span>
                  </div>
                  <div className="h-56 pt-5 sm:h-64">
                    {panel === "Logs" && (
                      <div className="font-mono text-[11px] sm:text-xs">
                        <div className="mb-3 flex gap-2 text-[10px] text-slate-400">
                          <span className="rounded-md border border-white/15 px-2 py-1 text-white">
                            All
                          </span>
                          <span className="rounded-md border border-white/10 px-2 py-1">
                            Build
                          </span>
                          <span className="rounded-md border border-white/10 px-2 py-1">
                            Runtime
                          </span>
                        </div>
                        {[
                          ["09:41:02", "INFO", "Build complete"],
                          ["09:41:10", "INFO", "Container started"],
                          ["09:41:13", "INFO", "Listening on port 3000"],
                          ["09:42:06", "HTTP", "GET / → 200"],
                        ].map(([time, level, message]) => (
                          <div
                            key={time}
                            className="flex gap-2 border-b border-white/10 py-2 last:border-0"
                          >
                            <span className="shrink-0 text-slate-500">
                              {time}
                            </span>
                            <span className="shrink-0 text-sky-400">
                              {level}
                            </span>
                            <span className="min-w-0 truncate text-slate-200">
                              {message}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {panel === "Metrics" && (
                      <div className="space-y-5">
                        {[
                          {
                            name: "CPU",
                            bars: [4, 6, 5, 8, 6, 7, 5, 9, 7, 6, 8, 7],
                          },
                          {
                            name: "Memory",
                            bars: [5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8, 8],
                          },
                          {
                            name: "Network I/O",
                            bars: [3, 7, 4, 9, 5, 8, 4, 6, 9, 5, 7, 4],
                          },
                        ].map(({ name, bars }) => (
                          <div key={name} className="flex items-center gap-4">
                            <span className="w-20 shrink-0 text-xs text-slate-300">
                              {name}
                            </span>
                            <div
                              className="flex h-10 min-w-0 flex-1 items-end gap-1 border-b border-white/10"
                              aria-hidden="true"
                            >
                              {bars.map((height, barIndex) => (
                                <span
                                  key={barIndex}
                                  className="flex-1 rounded-t-sm bg-sky-400/70"
                                  style={{ height: `${height * 10}%` }}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {panel === "HTTP Traffic" && (
                      <div>
                        <p className="text-xs font-medium text-slate-300">
                          {isId ? "Kualitas permintaan" : "Request quality"}
                        </p>
                        <div
                          className="mt-4 flex h-3 overflow-hidden rounded-full"
                          aria-hidden="true"
                        >
                          <div className="w-8/12 bg-sky-400/80" />
                          <div className="w-3/12 bg-amber-400/80" />
                          <div className="w-1/12 bg-rose-400/80" />
                        </div>
                        <div className="mt-3 flex justify-between text-[11px] text-slate-400">
                          <span>2xx {isId ? "Berhasil" : "Success"}</span>
                          <span>4xx {isId ? "Klien" : "Client"}</span>
                          <span>5xx {isId ? "Server" : "Server"}</span>
                        </div>
                        <div className="mt-5 border-t border-white/10 pt-4">
                          <p className="mb-2 text-xs font-medium text-slate-300">
                            {isId ? "Halaman teratas" : "Top pages"}
                          </p>
                          <div className="space-y-2 font-mono text-xs text-slate-400">
                            <div className="flex justify-between border-b border-white/10 pb-2">
                              <span>/</span>
                              <span className="text-sky-400">2xx</span>
                            </div>
                            <div className="flex justify-between">
                              <span>/dashboard</span>
                              <span className="text-sky-400">2xx</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div
            className="mt-4 flex justify-center gap-2"
            aria-label={isId ? "Pilih fitur konsol" : "Choose console feature"}
          >
            {panels.map((panel, index) => (
              <button
                key={panel}
                type="button"
                aria-label={panel}
                aria-pressed={index === activeIndex}
                onClick={() => setActiveIndex(index)}
                className={`h-2 rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${index === activeIndex ? "w-8 bg-emerald-600" : "w-2 bg-slate-400/60 dark:bg-white/30"}`}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-4 text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase dark:text-slate-400">
            {isId ? "KENAPA PFNAPP" : "WHY PFNAPP"}
          </p>
          <h2 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
            {isId
              ? "Laptop boleh ditutup. Kendali aplikasi tetap di tangan Anda."
              : "Close your laptop. Stay in control of your app."}
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-400">
            {isId
              ? "Hermes dan aplikasi lain tetap berjalan di server. Saat ingin tahu apa yang terjadi, semuanya bisa dilihat dari konsol."
              : "Hermes and your other apps keep running on a server. When you need to know what is happening, check the console."}
          </p>
          <ul className="mt-8 divide-y divide-slate-200 dark:divide-white/10">
            {reasons.map((reason) => (
              <li key={reason.title} className="flex gap-4 py-4 first:pt-0">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Check className="size-4" weight="bold" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-semibold">{reason.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {reason.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
