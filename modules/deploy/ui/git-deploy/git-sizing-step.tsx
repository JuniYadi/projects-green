"use client"

import { useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Cpu,
  Globe,
  HardDrives,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { GitSizingConfig } from "./types"

type GitSizingStepProps = {
  initialConfig?: Partial<GitSizingConfig>
  suggestedSubdomain: string
  onBack: () => void
  onNext: (config: GitSizingConfig) => void
}

const TIERS = [
  {
    id: "starter" as const,
    name: "Starter Tier",
    rate: 0.02,
    cpu: 250,
    memory: 512,
    description: "Best for lightweight APIs, test deployments, and blogs.",
  },
  {
    id: "standard" as const,
    name: "Standard Tier",
    rate: 0.04,
    cpu: 500,
    memory: 1024,
    recommended: true,
    description: "Optimal for production Next.js, Node.js, and SSR web apps.",
  },
  {
    id: "pro" as const,
    name: "Pro High-Capacity",
    rate: 0.08,
    cpu: 1000,
    memory: 2048,
    description:
      "Heavy traffic workloads, queues, and database intensive tasks.",
  },
]

export function GitSizingStep({
  initialConfig,
  suggestedSubdomain,
  onBack,
  onNext,
}: GitSizingStepProps) {
  const [tier, setTier] = useState<"starter" | "standard" | "pro">(
    initialConfig?.tier ?? "standard"
  )
  const [subdomain, setSubdomain] = useState(
    initialConfig?.subdomain ?? suggestedSubdomain
  )

  const selectedTierConfig = TIERS.find((t) => t.id === tier) ?? TIERS[1]!

  const handleContinue = () => {
    onNext({
      tier,
      cpu: selectedTierConfig.cpu,
      memory: selectedTierConfig.memory,
      hourlyRate: selectedTierConfig.rate,
      subdomain: subdomain.trim().toLowerCase(),
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Target Region */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Deployment Region</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Dedicated Kubernetes cluster hosting your ingress and container pods.
        </p>

        <div className="mt-4 flex items-center justify-between rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold">
                Singapore APAC-1 (sgp-k8s-prod-01)
              </p>
              <p className="text-xs text-muted-foreground">
                High Availability · Low Latency (SE Asia & Pacific)
              </p>
            </div>
          </div>
          <Badge
            variant="secondary"
            className="bg-emerald-500/10 text-emerald-700"
          >
            Online & Ready
          </Badge>
        </div>
      </div>

      {/* Compute Sizing Presets */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Compute & Sizing Tier</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Transparent hourly billing deducted per second of container runtime.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {TIERS.map((item) => {
            const isSelected = tier === item.id
            return (
              <div
                key={item.id}
                onClick={() => setTier(item.id)}
                className={`flex cursor-pointer flex-col justify-between rounded-xl border p-5 transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border bg-card hover:border-border/80"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{item.name}</h3>
                    {item.recommended && (
                      <Badge variant="secondary" className="text-[10px]">
                        Recommended
                      </Badge>
                    )}
                  </div>

                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-2xl font-bold">
                      ${item.rate.toFixed(4)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      / hour
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.description}
                  </p>

                  <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-3 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Cpu className="h-3.5 w-3.5" />
                      <span>{item.cpu}m vCPU</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <HardDrives className="h-3.5 w-3.5" />
                      <span>{item.memory} MiB RAM</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-2">
                  <Button
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="w-full"
                  >
                    {isSelected ? "Selected" : "Select Tier"}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Domain & Public Ingress */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Domain & Ingress Endpoint</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your application is provisioned with automated TLS wildcard
          certificates via Let’s Encrypt.
        </p>

        <div className="mt-4 max-w-lg">
          <label className="text-xs font-medium text-muted-foreground uppercase">
            Subdomain Prefix
          </label>
          <div className="mt-1 flex items-center gap-2">
            <Input
              className="font-mono text-sm"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
              placeholder="my-application"
            />
            <span className="text-sm font-medium text-muted-foreground">
              .pfnapp.dev
            </span>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700">
            <CheckCircle className="h-3.5 w-3.5" />
            Automatic HTTPS and TLS routing configured
          </p>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Build Config
        </Button>
        <Button onClick={handleContinue} disabled={!subdomain.trim()}>
          Review Deployment
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
