import type { Metadata } from "next"
import { HomeNav } from "./components/nav"
import { HeroSection } from "./components/hero"
import { ServicesSection } from "./components/services"
import { FeaturesSection } from "./components/features"
import { PricingSection } from "./components/pricing"
import { TestimonialsSection } from "./components/testimonials"
import { CTASection, Footer } from "./components/footer"

export const metadata: Metadata = {
  title: "PFNApp — The Full-Stack Cloud Platform for Developers",
  description:
    "Deploy apps, send emails & SMS, store files, and scale your infrastructure — all from a single developer-first platform. Start free, scale effortlessly.",
  keywords: [
    "cloud platform",
    "app hosting",
    "email service",
    "S3 storage",
    "developer tools",
    "SaaS",
    "PFNApp",
  ],
  openGraph: {
    title: "PFNApp — The Full-Stack Cloud Platform for Developers",
    description:
      "Deploy apps, send emails & SMS, store files, and scale your infrastructure — all from a single developer-first platform.",
    siteName: "PFNApp",
    type: "website",
  },
}

export default function HomePage() {
  return (
    <div className="bg-background min-h-screen">
      <HomeNav />
      <main>
        <HeroSection />
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
