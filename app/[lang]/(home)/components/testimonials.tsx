"use client"

import { Quotes, Star } from "@phosphor-icons/react"

const testimonials = [
  {
    id: 1,
    name: "Sarah Chen",
    role: "CTO",
    company: "Nexus Labs",
    avatar: "SC",
    avatarGradient: "from-violet-500 to-purple-600",
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
    avatarGradient: "from-emerald-500 to-teal-600",
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
    avatarGradient: "from-amber-500 to-orange-600",
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
    avatarGradient: "from-blue-500 to-cyan-600",
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
    avatarGradient: "from-pink-500 to-rose-600",
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
    avatarGradient: "from-slate-500 to-gray-600",
    rating: 5,
    quote:
      "As a solo dev, I don't have time to set up infrastructure. PFNApp handles all of that so I can focus on shipping features.",
  },
]

export function TestimonialsSection() {
  return (
    <section className="relative py-28 bg-[#060b18] overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(139,92,246,0.06),transparent)]" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6">
            <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">
              Testimonials
            </span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-5 tracking-tight">
            Loved by{" "}
            <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
              developers worldwide
            </span>
          </h2>
          <p className="text-lg text-white/40 max-w-xl mx-auto">
            Join 10,000+ developers who ship faster with PFNApp.
          </p>
        </div>

        {/* Masonry-style grid */}
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 space-y-5">
          {testimonials.map((t) => (
            <div
              key={t.id}
              className="break-inside-avoid bg-white/[0.03] border border-white/8 rounded-2xl p-6 hover:bg-white/[0.06] hover:border-white/15 transition-all duration-300 group"
            >
              {/* Quote icon */}
              <Quotes weight="fill" className="w-6 h-6 text-white/10 mb-4" />

              {/* Stars */}
              <div className="flex gap-1 mb-3">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} weight="fill" className="w-3.5 h-3.5 text-amber-400" />
                ))}
              </div>

              <p className="text-sm text-white/60 leading-relaxed mb-6 group-hover:text-white/75 transition-colors">
                &ldquo;{t.quote}&rdquo;
              </p>

              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-full bg-gradient-to-br ${t.avatarGradient} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}
                >
                  {t.avatar}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{t.name}</div>
                  <div className="text-xs text-white/40">
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
