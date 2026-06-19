"use client"

import { useState, useEffect, useRef, MouseEvent, WheelEvent } from "react"
import {
  Globe,
  Cloud,
  Cpu,
  Database,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  ArrowsOutSimple,
} from "@phosphor-icons/react"
import type { CustomDomain } from "@/modules/deploy/operate.types"

type TrafficFlowCanvasProps = {
  diagnosticMode: string
  replicas: number
  cloudflareEnabled: boolean
  dbConnected: boolean
  setCloudflareEnabled: (val: boolean) => void
  setDbConnected: (val: boolean) => void
  domains: CustomDomain[]
}

export function TrafficFlowCanvas({
  diagnosticMode,
  replicas,
  cloudflareEnabled,
  dbConnected,
  setCloudflareEnabled,
  setDbConnected,
  domains,
}: TrafficFlowCanvasProps) {
  // Hydration safety
  const [isMounted, setIsMounted] = useState(
    () => typeof window !== "undefined" && process.env.NODE_ENV === "test"
  )

  // Zoom & Pan states
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Canvas content spans x≈40..955, center≈497. Center the viewport on mount.
  const computeCenterOffset = () => {
    const containerWidth = containerRef.current?.offsetWidth ?? 1000
    return { x: containerWidth / 2 - 497, y: 0 }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true)
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  // Set centered offset once mounted and container is measured
  useEffect(() => {
    if (containerRef.current) {
      setOffset(computeCenterOffset())
    }
  }, [isMounted])

  // Simulation speed & flow toggle
  const [isAnimPaused, setIsAnimPaused] = useState(false)

  // A simple tick state to trigger periodic UI updates for pod meters
  const [tick, setTick] = useState(0)

  // Keep track of the domains prop we last saw
  const [prevDomains, setPrevDomains] = useState(domains)

  // Selected domain state
  const [selectedDomain, setSelectedDomain] = useState<string>(() => {
    const primary = domains?.find((d) => d.isPrimary)
    return primary
      ? primary.domain
      : domains?.[0]?.domain || "laravel-shop.local"
  })

  // Sync selectedDomain during render when domains list changes (e.g. env switches)
  if (domains !== prevDomains) {
    setPrevDomains(domains)
    const primary = domains?.find((d) => d.isPrimary)
    setSelectedDomain(
      primary ? primary.domain : domains?.[0]?.domain || "laravel-shop.local"
    )
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1)
    }, 3000)

    return () => clearInterval(timer)
  }, [])

  // Mouse handlers for dragging/panning
  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.closest("button") || target.closest("select")) return
    if (e.button !== 0) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
  }

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Zoom handlers
  const zoomIn = () => setScale((prev) => Math.min(2.0, prev + 0.1))
  const zoomOut = () => setScale((prev) => Math.max(0.5, prev - 0.1))
  const resetZoom = () => {
    setScale(1)
    setOffset(computeCenterOffset())
  }

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    const zoomIntensity = 0.03
    const delta = -e.deltaY
    const newScale = Math.max(
      0.5,
      Math.min(2.0, scale + (delta > 0 ? zoomIntensity : -zoomIntensity))
    )
    setScale(newScale)
  }

  // Fixed nodes coordinate configuration
  const internetX = 100
  const internetY = 200

  const cfX = 290
  const cfY = 200

  const ingressX = 480
  const ingressY = 200

  const dbX = 900
  const dbY = 200

  // Derive Pod coordinates based on replica count
  const getPodCoords = () => {
    const serverClusterX = 710
    const count = Math.min(4, replicas) // Max 4 pods visual representation
    if (count === 1) {
      return [{ x: serverClusterX, y: 200, label: "pod-prod-a8f1" }]
    }
    if (count === 2) {
      return [
        { x: serverClusterX, y: 140, label: "pod-prod-a8f1" },
        { x: serverClusterX, y: 260, label: "pod-prod-c2d4" },
      ]
    }
    if (count === 3) {
      return [
        { x: serverClusterX, y: 110, label: "pod-prod-a8f1" },
        { x: serverClusterX, y: 200, label: "pod-prod-c2d4" },
        { x: serverClusterX, y: 290, label: "pod-prod-e9f6" },
      ]
    }
    // Default 4
    return [
      { x: serverClusterX, y: 90, label: "pod-prod-a8f1" },
      { x: serverClusterX, y: 165, label: "pod-prod-c2d4" },
      { x: serverClusterX, y: 235, label: "pod-prod-e9f6" },
      { x: serverClusterX, y: 310, label: "pod-prod-g5h7" },
    ]
  }

  const pods = getPodCoords()

  // Generate connection paths (Coordinates matching edges of HTML nodes)
  const pathClientToCf = `M ${internetX + 60} ${internetY} L ${cfX - 70} ${cfY}`
  // Ingress is widened to 170px, so left edge is at ingressX - 85, right edge is at ingressX + 85
  const pathCfToIngress = `M ${cfX + 70} ${cfY} L ${ingressX - 85} ${ingressY}`
  const pathBypassCf = `M ${internetX + 60} ${internetY} C ${(internetX + ingressX - 25) / 2} 70, ${(internetX + ingressX - 25) / 2} 70, ${ingressX - 85} ${ingressY}`

  // Status flags
  const selectedDomainObj = domains?.find((d) => d.domain === selectedDomain)
  const isDomainExpired = selectedDomainObj?.tlsStatus === "expired"

  const isSslError = diagnosticMode === "ssl_expired" || isDomainExpired
  const is502Error = diagnosticMode === "error_502"
  const isRedirectLoop = diagnosticMode === "redirect_loop" && !isDomainExpired
  const isHealthy = diagnosticMode === "healthy" && !isDomainExpired

  // Path styles and colors
  const clientFlowColor = isSslError
    ? "#EF4444" // Red on SSL failure
    : isRedirectLoop
      ? "#F59E0B" // Amber on redirect loop
      : cloudflareEnabled
        ? "#F97316" // Orange on Cloudflare proxy path
        : "#10B981" // Green normal

  const dbFlowColor = dbConnected
    ? is502Error
      ? "#9CA3AF" // Grey if server crashed
      : "#10B981" // Green healthy
    : "#EF4444" // Red disconnected

  if (!isMounted) {
    return (
      <div
        className="relative animate-pulse overflow-hidden rounded-2xl border border-border bg-card/50 shadow-2xl backdrop-blur-md select-none dark:bg-[#0A0A0C]/50"
        style={{ height: "414px" }}
      >
        {/* Canvas Header Control Bar */}
        <div className="flex h-[54px] flex-row items-center justify-between border-b border-border/60 bg-muted/20 px-5 py-3">
          <div className="space-y-0.5">
            <span className="flex items-center gap-2 text-sm font-bold text-foreground">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex h-2 w-2 rounded-full bg-neutral-700"></span>
              </span>
              Cluster Traffic Routing Canvas
            </span>
            <span className="block text-[10px] text-muted-foreground">
              Loading simulation canvas...
            </span>
          </div>
        </div>
        <div
          className="w-full"
          style={{ height: "360px", backgroundColor: "var(--canvas-bg)" }}
        />
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card/50 shadow-2xl backdrop-blur-md select-none dark:bg-[#0A0A0C]/50">
      {/* Canvas Header Control Bar */}
      <div className="flex flex-row items-center justify-between border-b border-border/60 bg-muted/20 px-5 py-3">
        <div className="space-y-0.5">
          <span className="flex items-center gap-2 text-sm font-bold text-foreground">
            <span className="relative flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${isHealthy ? "bg-emerald-400" : "bg-rose-400"}`}
              ></span>
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${isHealthy ? "bg-emerald-500" : "bg-rose-500"}`}
              ></span>
            </span>
            Cluster Traffic Routing Canvas
          </span>
          <span className="block text-[10px] text-muted-foreground">
            Drag to pan, scroll to zoom. Live request paths from edge to
            database.
          </span>
        </div>

        {/* Action Toggles & Dropdowns */}
        <div className="z-10 flex flex-wrap items-center gap-3 text-xs">
          {/* Domain Dropdown Selection */}
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/60 px-3 py-1">
            <span className="font-semibold text-muted-foreground">
              Active Domain:
            </span>
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="cursor-pointer border-none bg-transparent pr-1 text-[10px] font-bold text-foreground transition-all hover:text-primary focus:outline-none"
            >
              {domains?.map((d) => (
                <option
                  key={d.id}
                  value={d.domain}
                  className="bg-card text-xs text-foreground"
                >
                  {d.domain} {d.isPrimary ? "(Primary)" : ""}
                </option>
              ))}
              {(!domains || domains.length === 0) && (
                <option
                  value="laravel-shop.local"
                  className="bg-card text-xs text-foreground"
                >
                  laravel-shop.local
                </option>
              )}
            </select>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/60 px-3 py-1">
            <span className="font-semibold text-muted-foreground">
              Cloudflare:
            </span>
            <button
              onClick={() => setCloudflareEnabled(!cloudflareEnabled)}
              className={`cursor-pointer rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase transition-all ${
                cloudflareEnabled
                  ? "border border-orange-500/30 bg-orange-500/20 text-orange-600 dark:text-orange-400"
                  : "border border-border/40 bg-muted text-muted-foreground"
              }`}
            >
              {cloudflareEnabled ? "Proxied" : "Bypass"}
            </button>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/60 px-3 py-1">
            <span className="font-semibold text-muted-foreground">
              Database:
            </span>
            <button
              onClick={() => setDbConnected(!dbConnected)}
              className={`cursor-pointer rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase transition-all ${
                dbConnected
                  ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  : "border border-rose-500/30 bg-rose-500/20 text-rose-600 dark:text-rose-400"
              }`}
            >
              {dbConnected ? "Connected" : "Offline"}
            </button>
          </div>

          {/* Pause Animation button */}
          <button
            onClick={() => setIsAnimPaused(!isAnimPaused)}
            className="cursor-pointer rounded border border-border/40 px-2 py-1 text-[10px] font-bold text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          >
            {isAnimPaused ? "Resume Flow" : "Pause Flow"}
          </button>
        </div>
      </div>

      {/* Interactive Drag & Scroll Area */}
      <div
        ref={containerRef}
        className="relative w-full cursor-grab overflow-hidden active:cursor-grabbing"
        style={{ height: "360px", backgroundColor: "var(--canvas-bg)" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onDoubleClick={resetZoom}
      >
        {/* Scalable & Pannable Viewport Group */}
        <div
          className="pointer-events-none absolute origin-top-left"
          style={{
            width: "1000px",
            height: "400px",
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
        >
          {/* SVG LAYER FOR PATHS AND GRID */}
          <svg
            width="1000"
            height="400"
            viewBox="0 0 1000 400"
            className="absolute inset-0"
          >
            <defs>
              <style>{`
                @keyframes flow-global {
                  from { stroke-dashoffset: 0; }
                  to { stroke-dashoffset: -18px; }
                }
                @keyframes flow-cf-global {
                  from { stroke-dashoffset: 0; }
                  to { stroke-dashoffset: -60px; }
                }
                @keyframes flow-ingress-global {
                  from { stroke-dashoffset: 0; }
                  to { stroke-dashoffset: -35px; }
                }
              `}</style>
              <filter
                id="glow"
                x="0"
                y="0"
                width="1000"
                height="400"
                filterUnits="userSpaceOnUse"
              >
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <pattern
                id="grid"
                width="24"
                height="24"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 24 0 L 0 0 0 24"
                  fill="none"
                  stroke="currentColor"
                  className="text-neutral-400/40 dark:text-white/[0.025]"
                  strokeWidth="1.2"
                />
              </pattern>
            </defs>

            {/* Grid Background */}
            <rect width="1000" height="400" fill="url(#grid)" />

            {/* 1. Client to Cloudflare (Direct) */}
            {cloudflareEnabled && (
              <>
                <path
                  d={pathClientToCf}
                  fill="none"
                  stroke="currentColor"
                  className="text-neutral-500/15 dark:text-white/10"
                  strokeWidth="2.5"
                />
                {!isAnimPaused && (
                  <path
                    d={pathClientToCf}
                    fill="none"
                    stroke={clientFlowColor}
                    strokeWidth="4"
                    strokeDasharray="6, 12"
                    style={{ animation: "flow-cf-global 1.5s linear infinite" }}
                    filter="url(#glow)"
                  />
                )}
              </>
            )}

            {/* 2. Cloudflare to Ingress */}
            {cloudflareEnabled && (
              <>
                <path
                  d={pathCfToIngress}
                  fill="none"
                  stroke="currentColor"
                  className="text-neutral-500/15 dark:text-white/10"
                  strokeWidth="2.5"
                />
                {!isAnimPaused && (
                  <path
                    d={pathCfToIngress}
                    fill="none"
                    stroke={clientFlowColor}
                    strokeWidth="4"
                    strokeDasharray="6, 12"
                    style={{
                      animation: "flow-ingress-global 1.0s linear infinite",
                    }}
                    filter="url(#glow)"
                  />
                )}
              </>
            )}

            {/* 3. Cloudflare Bypass Path */}
            {!cloudflareEnabled && (
              <>
                <path
                  d={pathBypassCf}
                  fill="none"
                  stroke="rgba(16, 185, 129, 0.15)"
                  strokeWidth="2.5"
                  strokeDasharray="4,4"
                />
                {!isAnimPaused && (
                  <path
                    d={pathBypassCf}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="3.5"
                    strokeDasharray="6, 12"
                    style={{ animation: "flow-global 2.0s linear infinite" }}
                    filter="url(#glow)"
                  />
                )}
              </>
            )}

            {/* Grayed-out dotted path through Cloudflare if disabled */}
            {!cloudflareEnabled && (
              <path
                d={`M ${internetX + 60} ${internetY} L ${cfX} ${cfY} L ${ingressX - 85} ${ingressY}`}
                fill="none"
                stroke="currentColor"
                className="text-neutral-500/15 dark:text-white/5"
                strokeWidth="1.5"
                strokeDasharray="4,4"
              />
            )}

            {/* 4. Paths from Ingress to Server Pods */}
            {pods.map((pod, idx) => {
              const pathStr = `M ${ingressX + 85} ${ingressY} C ${ingressX + 130} ${ingressY}, ${ingressX + 130} ${pod.y}, ${pod.x - 75} ${pod.y}`
              const showFlow = !isSslError && !isRedirectLoop && !isAnimPaused
              const pathColor = is502Error ? "#EF4444" : "#10B981"

              return (
                <g key={`pod-path-${idx}`}>
                  <path
                    d={pathStr}
                    fill="none"
                    stroke={showFlow ? "currentColor" : "currentColor"}
                    className={
                      showFlow
                        ? "text-neutral-500/15 dark:text-white/10"
                        : "text-neutral-500/5 dark:text-white/5"
                    }
                    strokeWidth="2"
                  />
                  {showFlow && (
                    <path
                      d={pathStr}
                      fill="none"
                      stroke={pathColor}
                      strokeWidth="2.5"
                      strokeDasharray="6, 12"
                      style={{ animation: "flow-global 1.2s linear infinite" }}
                      filter="url(#glow)"
                    />
                  )}
                </g>
              )
            })}

            {/* 5. Paths from Pods to Database */}
            {pods.map((pod, idx) => {
              const pathStr = `M ${pod.x + 75} ${pod.y} C ${pod.x + 120} ${pod.y}, ${pod.x + 120} ${dbY}, ${dbX - 55} ${dbY}`
              const showFlow =
                dbConnected &&
                !is502Error &&
                !isSslError &&
                !isRedirectLoop &&
                !isAnimPaused

              return (
                <g key={`db-path-${idx}`}>
                  <path
                    d={pathStr}
                    fill="none"
                    stroke={
                      dbConnected ? "currentColor" : "rgba(239, 68, 68, 0.15)"
                    }
                    className={
                      dbConnected
                        ? "text-neutral-500/15 dark:text-white/10"
                        : ""
                    }
                    strokeWidth="2"
                    strokeDasharray={dbConnected ? undefined : "3,3"}
                  />
                  {showFlow && (
                    <path
                      d={pathStr}
                      fill="none"
                      stroke={dbFlowColor}
                      strokeWidth="2.5"
                      strokeDasharray="6, 12"
                      style={{ animation: "flow-global 1.5s linear infinite" }}
                      filter="url(#glow)"
                    />
                  )}
                </g>
              )
            })}
          </svg>

          {/* HTML NODES */}

          {/* A. INTERNET NODE */}
          <div
            style={{
              left: `${internetX - 60}px`,
              top: `${internetY - 35}px`,
              width: "120px",
              height: "70px",
            }}
            className="pointer-events-auto absolute flex flex-col justify-between rounded-2xl border border-border bg-card p-3 text-left shadow-lg ring-1 ring-blue-500/10"
          >
            <div className="flex items-center gap-2">
              <Globe
                size={18}
                className="shrink-0 text-blue-500 dark:text-blue-400"
              />
              <span className="text-[11px] font-bold tracking-wide text-foreground">
                Internet
              </span>
            </div>
            <div className="text-[9px] leading-tight font-semibold text-neutral-600 select-none dark:text-neutral-400">
              User Traffic
            </div>
            <div className="font-mono text-[9px] leading-none">
              <span
                className={
                  isSslError
                    ? "font-bold text-rose-600 dark:text-rose-500"
                    : "font-bold text-emerald-600 dark:text-emerald-400"
                }
              >
                {isSslError ? "BLOCKED" : "124 RPS"}
              </span>
            </div>
          </div>

          {/* B. CLOUDFLARE NODE */}
          <div
            style={{
              left: `${cfX - 70}px`,
              top: `${cfY - 37.5}px`,
              width: "140px",
              height: "75px",
            }}
            className={`pointer-events-auto absolute flex flex-col justify-between rounded-2xl border p-3 text-left shadow-lg transition-all duration-300 ${
              cloudflareEnabled
                ? "border-orange-500/25 bg-card"
                : "border-border/40 bg-card/30 opacity-50"
            }`}
          >
            <div className="flex items-center gap-2">
              <Cloud
                size={18}
                className={
                  cloudflareEnabled
                    ? "shrink-0 text-orange-500 dark:text-orange-400"
                    : "shrink-0 text-neutral-500"
                }
              />
              <span
                className={`text-[11px] font-bold tracking-wide ${cloudflareEnabled ? "text-foreground" : "text-muted-foreground"}`}
              >
                Cloudflare
              </span>
            </div>
            <div className="font-mono text-[8px] font-bold">
              <span
                className={
                  cloudflareEnabled
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-neutral-500 dark:text-neutral-400"
                }
              >
                {cloudflareEnabled ? "WAF / PROXY ON" : "BYPASSED"}
              </span>
            </div>
            {cloudflareEnabled && (
              <div className="font-mono text-[8px] font-medium text-neutral-600 dark:text-neutral-400">
                SSL: Full Strict
              </div>
            )}
          </div>

          {/* C. ACTIVE DOMAIN NODE */}
          <div
            style={{
              left: `${ingressX - 85}px`,
              top: `${ingressY - 35}px`,
              width: "170px",
              height: "70px",
            }}
            className={`pointer-events-auto absolute flex flex-col justify-between rounded-2xl border p-3 text-left shadow-lg ${
              isSslError
                ? "border-rose-500/30 bg-card ring-1 ring-rose-500/10"
                : "border-border bg-card"
            }`}
            title={selectedDomain}
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <Cpu
                size={16}
                className={`shrink-0 ${isSslError ? "animate-pulse text-rose-500" : "text-emerald-500 dark:text-emerald-400"}`}
              />
              <span className="block truncate text-[10px] font-bold tracking-tight text-foreground">
                {selectedDomain}
              </span>
            </div>
            <div className="mt-1 font-mono text-[8px] select-none">
              {isSslError ? (
                <span className="font-bold text-rose-600 dark:text-rose-500">
                  SSL HANDSHAKE FAIL
                </span>
              ) : isRedirectLoop ? (
                <span className="font-bold text-amber-600 dark:text-amber-500">
                  301 LOOP DETECTED
                </span>
              ) : (
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  SSL ACTIVE (ACM)
                </span>
              )}
            </div>
          </div>

          {/* D. SERVER CLUSTER BOUNDING BOX */}
          <div
            style={{
              left: "620px",
              top: "50px",
              width: "180px",
              height: "300px",
            }}
            className="pointer-events-auto absolute flex flex-col rounded-3xl border border-dashed border-border bg-muted/[0.05] p-3 text-left dark:bg-white/[0.005]"
          >
            <span className="mb-2 block text-[8px] font-bold tracking-wider text-neutral-500 uppercase select-none dark:text-muted-foreground/80">
              K8s Namespace
            </span>

            {/* Container mapping active Pods */}
            <div className="-mt-3.5 flex h-full flex-col justify-center gap-2.5">
              {pods.map((pod, idx) => {
                const cpu =
                  Math.floor(((Math.sin(tick * 0.7 + idx) + 1) / 2) * 15) + 5
                const mem =
                  Math.floor(((Math.cos(tick * 0.4 + idx) + 1) / 2) * 35) + 124
                const ip = `10.244.1.${12 + idx}`
                const isPodError = is502Error

                return (
                  <div
                    key={`pod-${idx}`}
                    className={`rounded-xl border bg-card p-2 text-left transition-all duration-300 ${
                      isPodError
                        ? "border-rose-500/20 shadow-lg ring-1 shadow-rose-500/5 ring-rose-500/10"
                        : "border-border"
                    }`}
                  >
                    <div className="flex min-w-0 items-center justify-between gap-1.5">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${isPodError ? "animate-pulse bg-rose-500" : "bg-emerald-500"} shrink-0`}
                        />
                        <span
                          style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: "70px",
                          }}
                          className="text-[9px] leading-none font-bold text-foreground"
                          title={pod.label}
                        >
                          {pod.label}
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-[7.5px] font-medium text-neutral-600 dark:text-neutral-400">
                        {ip}
                      </span>
                    </div>

                    <div className="mt-1.5 flex justify-between border-t border-border/40 pt-1.5 font-mono text-[8px] font-medium text-neutral-600 dark:text-neutral-400">
                      <span>
                        CPU:{" "}
                        <span className="font-bold text-foreground">
                          {cpu}%
                        </span>
                      </span>
                      <span>
                        RAM:{" "}
                        <span className="font-bold text-foreground">
                          {mem}MB
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[8px] font-medium text-neutral-600 dark:text-neutral-400">
                      <span>
                        STATUS:{" "}
                        <span
                          className={
                            isPodError
                              ? "font-bold text-rose-500"
                              : "font-bold text-emerald-600 dark:text-emerald-400"
                          }
                        >
                          {isPodError ? "ERR_CRASH" : "RUNNING"}
                        </span>
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* E. DATABASE NODE */}
          <div
            style={{
              left: `${dbX - 55}px`,
              top: `${dbY - 35}px`,
              width: "110px",
              height: "70px",
            }}
            className={`pointer-events-auto absolute flex flex-col justify-between rounded-2xl border p-3 text-left shadow-lg transition-all duration-300 ${
              dbConnected
                ? "border-emerald-500/20 bg-card"
                : "border-rose-500/30 bg-card ring-1 ring-rose-500/10"
            }`}
          >
            <div className="flex items-center gap-2">
              <Database
                size={18}
                className={`shrink-0 ${dbConnected ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500"}`}
              />
              <span className="text-[11px] font-bold tracking-wide text-foreground">
                MySQL DB
              </span>
            </div>
            <div className="mt-1 font-mono text-[8px] font-bold">
              {dbConnected ? (
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  12 Active Conns
                </span>
              ) : (
                <span className="text-rose-500">CONN_TIMEOUT</span>
              )}
            </div>
          </div>
        </div>

        {/* Floating Zoom / Pan Controls (Bottom Left) */}
        <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1.5 rounded-xl border border-border bg-card p-1.5 shadow-md backdrop-blur-md">
          <button
            onClick={zoomIn}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-muted text-foreground/80 transition-all hover:bg-muted/80 hover:text-foreground active:scale-95"
            title="Zoom In"
          >
            <MagnifyingGlassPlus size={16} />
          </button>
          <button
            onClick={zoomOut}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-muted text-foreground/80 transition-all hover:bg-muted/80 hover:text-foreground active:scale-95"
            title="Zoom Out"
          >
            <MagnifyingGlassMinus size={16} />
          </button>
          <button
            onClick={resetZoom}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-muted text-foreground/80 transition-all hover:bg-muted/80 hover:text-foreground active:scale-95"
            title="Reset Zoom"
          >
            <ArrowsOutSimple size={16} />
          </button>
        </div>

        {/* Floating Canvas Overlay Legend (Bottom Right) */}
        <div className="absolute right-4 bottom-4 z-10 flex flex-col gap-1 rounded-xl border border-border bg-card px-3 py-2 text-[10px] font-medium text-neutral-600 shadow-md backdrop-blur-md dark:text-neutral-400">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-1 w-2.5 rounded-full bg-emerald-500" />
            <span>Healthy / Active traffic</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-1 w-2.5 rounded-full bg-rose-500" />
            <span>Blocked / Error traffic</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-1 w-2.5 rounded-full bg-orange-400" />
            <span>Cloudflare Proxied path</span>
          </div>
        </div>
      </div>
    </div>
  )
}
