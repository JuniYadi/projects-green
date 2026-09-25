import type { Metadata } from "next"
import { HomeNav } from "./components/nav"
import { HeroSection } from "./components/hero"
import { TemplatesSection } from "./components/templates-section"
import { ServicesSection } from "./components/services"
import { FeaturesSection } from "./components/features"
import { PricingSection } from "./components/pricing"
import { TestimonialsSection } from "./components/testimonials"
import { CTASection, Footer } from "./components/footer"

export const metadata: Metadata = {
  title: {
    absolute: "PFNApp — Deploy Hermes AI Agent & Curated Cloud Stacks",
  },
  description:
    "Deploy Hermes AI Agent, 9router, and automation workflows in 30 seconds on direct Enterprise NVMe. Claim Rp 50,000 credit voucher on launch batch.",
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
    title: "PFNApp — Deploy Hermes AI Agent & Curated Cloud Stacks",
    description:
      "Deploy Hermes AI Agent, 9router, and automation workflows in 30 seconds on direct Enterprise NVMe.",
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
        <FeaturesSection />
        <PricingSection />
        <TestimonialsSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  )
}
