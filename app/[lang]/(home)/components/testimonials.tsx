"use client"

import { Quotes, Star } from "@phosphor-icons/react"

const testimonials = [
  {
    id: 1,
    name: "Sarah Chen",
    role: "CTO",
    company: "Nexus Labs",
    avatar: "SC",
    avatarBg: "bg-chart-5",
    rating: 5,
    quote:
      "PFNApp replaced four separate vendors for us. Hosting, email, storage, and auth — all in one dashboard. Our DevOps overhead dropped by 60%.",
  },
  {
    id: 2,
    name: "Marcus Rivera",
    role: "Lead Engineer",
    company: "FinTrack",
    avatar: "MR",
    avatarBg: "bg-primary",
    rating: 5,
    quote:
      "The developer experience is unmatched. Git push, it deploys. S3 storage just works. The CLI is clean and fast. Exactly what I wanted.",
  },
  {
    id: 3,
    name: "Aiko Tanaka",
    role: "Founder",
    company: "Kura AI",
    avatar: "AT",
    avatarBg: "bg-chart-1",
    rating: 5,
    quote:
      "We went from zero to production in 2 hours. The AI services integration is seamless — embeddings and completions with one API key.",
  },
  {
    id: 4,
    name: "David Okafor",
    role: "Backend Dev",
    company: "ShipStack",
    avatar: "DO",
    avatarBg: "bg-chart-3",
    rating: 5,
    quote:
      "Transactional emails used to be a nightmare. PFNApp's communication service just works — 99.8% deliverability and webhooks out of the box.",
  },
  {
    id: 5,
    name: "Priya Nair",
    role: "Product Manager",
    company: "Waverly",
    avatar: "PN",
    avatarBg: "bg-chart-4",
    rating: 5,
    quote:
      "The billing is transparent and the free tier is genuinely useful. We validated our MVP before spending a single dollar.",
  },
  {
    id: 6,
    name: "Tom Brennan",
    role: "Solo Developer",
    company: "indie",
    avatar: "TB",
    avatarBg: "bg-muted",
    rating: 5,
    quote:
      "As a solo dev, I don't have time to set up infrastructure. PFNApp handles all of that so I can focus on shipping features.",
  },
]

export function TestimonialsSection() {
  return (
    <section className="relative py-28 bg-background overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,color-mix(in_oklch,var(--chart-5)_6%,transparent),transparent)]" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-secondary border border-border rounded-full px-4 py-1.5 mb-6">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Testimonials
            </span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-5 tracking-tight">
            Loved by{" "}
            <span className="bg-gradient-to-r from-chart-5 to-chart-3 bg-clip-text text-transparent">
              developers worldwide
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Join 10,000+ developers who ship faster with PFNApp.
          </p>
        </div>

        {/* Masonry grid */}
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 space-y-5">
          {testimonials.map((t) => (
            <div
              key={t.id}
              className="break-inside-avoid bg-card border border-border hover:border-primary/20 rounded-2xl p-6 transition-all duration-300 group"
            >
              <Quotes weight="fill" className="w-6 h-6 text-border mb-4" />

              {/* Stars */}
              <div className="flex gap-1 mb-3">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} weight="fill" className="w-3.5 h-3.5 text-chart-1" />
                ))}
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed mb-6 group-hover:text-foreground/75 transition-colors">
                &ldquo;{t.quote}&rdquo;
              </p>

              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-full ${t.avatarBg} flex items-center justify-center text-xs font-bold text-primary-foreground flex-shrink-0`}
                >
                  {t.avatar}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{t.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.role} · {t.company}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
