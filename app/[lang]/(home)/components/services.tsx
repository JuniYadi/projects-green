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
      id: "hosting",
      name: isId ? "Hosting Aplikasi" : "App Hosting",
      description: isId
        ? "Deploy dari template atau repo Git."
        : "Deploy from a template or Git repository.",
      href: `/${locale}#templates`,
    },
    {
      id: "whatsapp",
      name: "WhatsApp Official API",
      description: isId
        ? "Kirim pesan bisnis lewat API resmi Meta."
        : "Send business messages with Meta's official API.",
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
      href: `/${locale}/login?next=%2F${locale}%2Fconsole`,
    },
  ]

  return (
    <section id="services" className="bg-[#0c1420] py-16 text-white sm:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {isId ? "Layanan lain di PFNApp" : "More from PFNApp"}
          </h2>
          <p className="mt-3 text-white/60">
            {isId
              ? "Selain app hosting, kelola kebutuhan lain dari satu akun."
              : "Beyond app hosting, manage more from the same account."}
          </p>
        </div>
        <div className="grid gap-x-12 sm:grid-cols-2">
          {services.map((service) => (
            <Link
              key={service.id}
              id={service.id}
              href={service.href}
              className="group flex items-start justify-between gap-4 border-t border-white/15 py-6 focus-visible:outline-2 focus-visible:outline-emerald-400"
            >
              <div>
                <h3 className="text-lg font-semibold group-hover:text-emerald-300">
                  {service.name}
                </h3>
                <p className="mt-2 text-sm text-white/55">
                  {service.description}
                </p>
              </div>
              <ArrowUpRight
                className="mt-1 size-5 shrink-0 text-white/50 group-hover:text-emerald-300"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
