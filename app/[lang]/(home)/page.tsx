import type { Metadata } from "next"
import { HomeNav } from "./components/nav"
import { HeroSection } from "./components/hero"
import { TemplatesSection } from "./components/templates-section"
import { ServicesSection } from "./components/services"
import { CTASection, Footer } from "./components/footer"

export const metadata: Metadata = {
  title: {
    absolute: "PFNApp — Deploy Aplikasi Tanpa Menyiapkan Server",
  },
  description:
    "Jalankan Hermes, 9router, n8n, atau aplikasi dari repo Git tanpa menyiapkan server. Lihat template App Hosting PFNApp.",
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
    title: "PFNApp — Deploy Aplikasi Tanpa Menyiapkan Server",
    description:
      "Jalankan Hermes, 9router, n8n, atau aplikasi dari repo Git tanpa menyiapkan server.",
    siteName: "PFNApp",
    type: "website",
  },
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <HomeNav />
      <main>
        <HeroSection />
        <TemplatesSection />
        <ServicesSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  )
}
