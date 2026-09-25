"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowUpRight } from "@phosphor-icons/react"

import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export function ServicesSection() {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const isId = locale === "id"

  const services = [
    {
      id: "whatsapp",
      name: "WhatsApp Official API",
      description: isId
        ? "Pesan bisnis lewat API resmi Meta."
        : "Business messages via Meta's official API.",
      href: `/${locale}/products/whatsapp-official`,
    },
    {
      id: "vpn",
      name: "WireGuard VPN",
      description: isId
        ? "Akses jaringan privat dari perangkat Anda."
        : "Access private networks from your devices.",
      href: `/${locale}/login?next=%2F${locale}%2Fconsole%2Fvpn`,
    },
    {
      id: "storage",
      name: isId ? "Penyimpanan S3" : "S3 Storage",
      description: isId
        ? "Simpan file dan aset aplikasi."
        : "Store files and app assets.",
    },
    {
      id: "ai",
      name: "AI Agent",
      description: isId
        ? "Bangun agent dengan pengetahuan bisnis Anda."
        : "Build agents with your business knowledge.",
    },
  ]

  return (
    <section
      id="services"
      className="bg-slate-100 py-16 text-slate-950 sm:py-20 dark:bg-[#0c1420] dark:text-white"
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-8 max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {isId ? "Layanan lain di PFNApp" : "More from PFNApp"}
          </h2>
          <p className="mt-3 text-slate-600 dark:text-white/60">
            {isId
              ? "Layanan yang sudah tersedia dan yang sedang disiapkan."
              : "What's available and what's on the way."}
          </p>
        </div>
        <div className="grid gap-x-12 sm:grid-cols-2">
          {services.map((service) => {
            const content = (
              <>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{service.name}</h3>
                    {!service.href && (
                      <span className="text-xs text-slate-500 dark:text-white/50">
                        {isId ? "Segera hadir" : "Coming soon"}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-white/55">
                    {service.description}
                  </p>
                </div>
                {service.href && (
                  <ArrowUpRight
                    className="mt-1 size-5 shrink-0 text-slate-500 dark:text-white/50"
                    aria-hidden="true"
                  />
                )}
              </>
            )

            return service.href ? (
              <Link
                key={service.id}
                id={service.id}
                href={service.href}
                className="flex items-start justify-between gap-4 border-t border-slate-200 py-5 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-500 dark:border-white/15 dark:hover:text-emerald-300"
              >
                {content}
              </Link>
            ) : (
              <div
                key={service.id}
                id={service.id}
                className="flex items-start justify-between gap-4 border-t border-slate-200 py-5 dark:border-white/15"
              >
                {content}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
