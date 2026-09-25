import type { Metadata } from "next"
import { connection } from "next/server"
import { HomeNav } from "./components/nav"
import { HeroSection } from "./components/hero"
import { WhyPFNAppSection } from "./components/why-pfnapp"
import { TemplatesSection } from "./components/templates-section"
import { ServicesSection } from "./components/services"
import { CTASection, Footer } from "./components/footer"
import { getHomeOffer } from "./home-offer"

export const metadata: Metadata = {
  title: {
    absolute: "PFNApp — Jalankan Hermes Agent",
  },
  description:
    "Jalankan Hermes Agent di PFNApp tanpa mengurus server. Pilih template dan lihat penawaran yang tersedia.",
  keywords: [
    "hermes agent hosting",
    "ai agent hosting",
    "9router",
    "n8n hosting",
    "cloud platform",
    "app hosting",
    "PFNApp",
  ],
  openGraph: {
    title: "PFNApp — Jalankan Hermes Agent",
    description:
      "Jalankan Hermes Agent di PFNApp tanpa mengurus server. Pilih template dan lihat penawaran yang tersedia.",
    siteName: "PFNApp",
    type: "website",
  },
}

export default async function HomePage() {
  await connection()
  const offer = await getHomeOffer()

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <HomeNav />
      <main>
        <HeroSection offer={offer} />
        <WhyPFNAppSection />
        <TemplatesSection />
        <ServicesSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  )
}
