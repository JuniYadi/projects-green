"use client"

import { useState, useEffect, MouseEvent, WheelEvent } from "react"
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
  const [isMounted, setIsMounted] = useState(() => typeof window !== "undefined" && process.env.NODE_ENV === "test")

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true)
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  // Zoom & Pan states
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  
  // Simulation speed & flow toggle
  const [isAnimPaused, setIsAnimPaused] = useState(false)

  // A simple tick state to trigger periodic UI updates for pod meters
  const [tick, setTick] = useState(0)

  // Keep track of the domains prop we last saw
  const [prevDomains, setPrevDomains] = useState(domains)

  // Selected domain state
  const [selectedDomain, setSelectedDomain] = useState<string>(() => {
    const primary = domains?.find((d) => d.isPrimary)
    return primary ? primary.domain : domains?.[0]?.domain || "laravel-shop.local"
  })

  // Sync selectedDomain during render when domains list changes (e.g. env switches)
  if (domains !== prevDomains) {
    setPrevDomains(domains)
    const primary = domains?.find((d) => d.isPrimary)
    setSelectedDomain(primary ? primary.domain : domains?.[0]?.domain || "laravel-shop.local")
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
    setOffset({ x: 0, y: 0 })
  }

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    const zoomIntensity = 0.03
    const delta = -e.deltaY
    const newScale = Math.max(0.5, Math.min(2.0, scale + (delta > 0 ? zoomIntensity : -zoomIntensity)))
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
  const isSslError = diagnosticMode === "ssl_expired"
  const is502Error = diagnosticMode === "error_502"
  const isRedirectLoop = diagnosticMode === "redirect_loop"
  const isHealthy = diagnosticMode === "healthy"

  // Path styles and colors
  const clientFlowColor = isSslError
    ? "#EF4444" // Red on SSL failure
    : isRedirectLoop
      ? "#F59E0B" // Amber on redirect loop
      : "#10B981" // Green normal

  const dbFlowColor = dbConnected
    ? is502Error
      ? "#9CA3AF" // Grey if server crashed
      : "#10B981" // Green healthy
    : "#EF4444" // Red disconnected

  if (!isMounted) {
    return (
      <div 
        className="relative rounded-2xl border border-white/[0.08] bg-[#0A0A0C]/50 shadow-2xl backdrop-blur-md overflow-hidden select-none animate-pulse"
        style={{ height: "414px" }}
      >
        {/* Canvas Header Control Bar */}
        <div className="flex flex-row items-center justify-between border-b border-white/[0.06] bg-neutral-950/30 px-5 py-3 h-[54px]">
          <div className="space-y-0.5">
            <span className="text-sm font-bold text-white flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex h-2 w-2 rounded-full bg-neutral-700"></span>
              </span>
              Cluster Traffic Routing Canvas
            </span>
            <span className="text-[10px] text-muted-foreground block">
              Loading simulation canvas...
            </span>
          </div>
        </div>
        <div className="w-full bg-black/40" style={{ height: "360px" }} />
      </div>
    )
  }

  return (
    <div className="relative rounded-2xl border border-white/[0.08] bg-[#0A0A0C]/50 shadow-2xl backdrop-blur-md overflow-hidden select-none">
      
      {/* Canvas Header Control Bar */}
      <div className="flex flex-row items-center justify-between border-b border-white/[0.06] bg-neutral-950/30 px-5 py-3">
        <div className="space-y-0.5">
          <span className="text-sm font-bold text-white flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${isHealthy ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
              <span className={`relative inline-flex h-2 w-2 rounded-full ${isHealthy ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            </span>
            Cluster Traffic Routing Canvas
          </span>
          <span className="text-[10px] text-muted-foreground block">
            Drag to pan, scroll to zoom. Live request paths from edge to database.
          </span>
        </div>

        {/* Action Toggles & Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 text-xs z-10">
          {/* Domain Dropdown Selection */}
          <div className="flex items-center gap-2 bg-neutral-900/60 border border-white/[0.06] px-3 py-1 rounded-xl">
            <span className="text-muted-foreground font-semibold">Active Domain:</span>
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="bg-transparent text-white border-none font-bold focus:outline-none cursor-pointer text-[10px] hover:text-primary transition-all pr-1"
            >
              {domains?.map((d) => (
                <option key={d.id} value={d.domain} className="bg-neutral-950 text-white text-xs">
                  {d.domain} {d.isPrimary ? "(Primary)" : ""}
                </option>
              ))}
              {(!domains || domains.length === 0) && (
                <option value="laravel-shop.local" className="bg-neutral-950 text-white text-xs">
                  laravel-shop.local
                </option>
              )}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-neutral-900/60 border border-white/[0.06] px-3 py-1 rounded-xl">
            <span className="text-muted-foreground font-semibold">Cloudflare:</span>
            <button
              onClick={() => setCloudflareEnabled(!cloudflareEnabled)}
              className={`rounded-lg px-2 py-0.5 font-bold transition-all text-[10px] uppercase ${
                cloudflareEnabled
                  ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                  : "bg-neutral-800 text-muted-foreground border border-white/5"
              }`}
            >
              {cloudflareEnabled ? "Proxied" : "Bypass"}
            </button>
          </div>

          <div className="flex items-center gap-2 bg-neutral-900/60 border border-white/[0.06] px-3 py-1 rounded-xl">
            <span className="text-muted-foreground font-semibold">Database:</span>
            <button
              onClick={() => setDbConnected(!dbConnected)}
              className={`rounded-lg px-2 py-0.5 font-bold transition-all text-[10px] uppercase ${
                dbConnected
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
              }`}
            >
              {dbConnected ? "Connected" : "Offline"}
            </button>
          </div>

          {/* Pause Animation button */}
          <button
            onClick={() => setIsAnimPaused(!isAnimPaused)}
            className="text-[10px] font-bold text-muted-foreground hover:text-white px-2 py-1 rounded border border-white/5 hover:bg-white/5"
          >
            {isAnimPaused ? "Resume Flow" : "Pause Flow"}
          </button>
        </div>
      </div>

      {/* Interactive Drag & Scroll Area */}
      <div
        className="w-full cursor-grab active:cursor-grabbing overflow-hidden bg-black/40 relative"
        style={{ height: "360px" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onDoubleClick={resetZoom}
      >
        {/* Scalable & Pannable Viewport Group */}
        <div
          className="absolute origin-top-left pointer-events-none"
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
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
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
                  stroke="rgba(255, 255, 255, 0.025)"
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
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="2.5"
                />
                {!isAnimPaused && (
                  <path
                    d={pathClientToCf}
                    fill="none"
                    stroke={clientFlowColor}
                    strokeWidth="4"
                    strokeDasharray="6, 54"
                    className="animate-traffic-cf"
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
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="2.5"
                />
                {!isAnimPaused && (
                  <path
                    d={pathCfToIngress}
                    fill="none"
                    stroke={clientFlowColor}
                    strokeWidth="4"
                    strokeDasharray="6, 29"
                    className="animate-traffic-ingress"
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
                    className="animate-traffic-flow"
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
                stroke="rgba(255,255,255,0.03)"
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
                    stroke={showFlow ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)"}
                    strokeWidth="2"
                  />
                  {showFlow && (
                    <path
                      d={pathStr}
                      fill="none"
                      stroke={pathColor}
                      strokeWidth="2.5"
                      strokeDasharray="6, 12"
                      className="animate-traffic-flow"
                      filter="url(#glow)"
                    />
                  )}
                </g>
              )
            })}

            {/* 5. Paths from Pods to Database */}
            {pods.map((pod, idx) => {
              const pathStr = `M ${pod.x + 75} ${pod.y} C ${pod.x + 120} ${pod.y}, ${pod.x + 120} ${dbY}, ${dbX - 55} ${dbY}`
              const showFlow = dbConnected && !is502Error && !isSslError && !isRedirectLoop && !isAnimPaused

              return (
                <g key={`db-path-${idx}`}>
                  <path
                    d={pathStr}
                    fill="none"
                    stroke={dbConnected ? "rgba(255,255,255,0.06)" : "rgba(239, 68, 68, 0.15)"}
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
                      className="animate-traffic-flow"
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
            className="absolute rounded-2xl border border-white/[0.08] bg-[#0E0E12] p-3 flex flex-col justify-between text-left pointer-events-auto ring-1 ring-blue-500/10 shadow-lg"
          >
            <div className="flex items-center gap-2">
              <Globe size={18} className="text-blue-400 shrink-0" />
              <span className="text-[11px] font-bold text-white tracking-wide">Internet</span>
            </div>
            <div className="text-[9px] font-semibold text-muted-foreground select-none leading-tight">
              User Traffic
            </div>
            <div className="text-[9px] font-mono leading-none">
              <span className={isSslError ? "text-rose-500 font-bold" : "text-emerald-400 font-bold"}>
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
            className={`absolute rounded-2xl border p-3 flex flex-col justify-between text-left pointer-events-auto shadow-lg transition-all duration-300 ${
              cloudflareEnabled
                ? "border-orange-500/20 bg-[#0E0E12]"
                : "border-white/5 bg-[#0E0E12]/30 opacity-50"
            }`}
          >
            <div className="flex items-center gap-2">
              <Cloud size={18} className={cloudflareEnabled ? "text-orange-400 shrink-0" : "text-neutral-600 shrink-0"} />
              <span className={`text-[11px] font-bold tracking-wide ${cloudflareEnabled ? 'text-white' : 'text-neutral-500'}`}>
                Cloudflare
              </span>
            </div>
            <div className="text-[8px] font-bold font-mono">
              <span className={cloudflareEnabled ? "text-orange-400" : "text-neutral-600"}>
                {cloudflareEnabled ? "WAF / PROXY ON" : "BYPASSED"}
              </span>
            </div>
            {cloudflareEnabled && (
              <div className="text-[8px] font-mono text-muted-foreground">
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
            className={`absolute rounded-2xl border p-3 flex flex-col justify-between text-left pointer-events-auto shadow-lg ${
              isSslError
                ? "border-rose-500/30 bg-[#0E0E12] ring-1 ring-rose-500/10"
                : "border-white/[0.08] bg-[#0E0E12]"
            }`}
            title={selectedDomain}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Cpu size={16} className={`shrink-0 ${isSslError ? "text-rose-500 animate-pulse" : "text-emerald-400"}`} />
              <span className="text-[10px] font-bold text-white tracking-tight truncate block">
                {selectedDomain}
              </span>
            </div>
            <div className="text-[8px] font-mono mt-1 select-none">
              {isSslError ? (
                <span className="text-rose-500 font-bold">SSL HANDSHAKE FAIL</span>
              ) : isRedirectLoop ? (
                <span className="text-amber-500 font-bold">301 LOOP DETECTED</span>
              ) : (
                <span className="text-emerald-400 font-medium">SSL ACTIVE (ACM)</span>
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
            className="absolute rounded-3xl border border-dashed border-white/5 bg-white/[0.005] p-3 text-left pointer-events-auto flex flex-col"
          >
            <span className="text-[8px] font-bold text-muted-foreground/80 tracking-wider block mb-2 uppercase select-none">
              K8s Namespace
            </span>

            {/* Container mapping active Pods */}
            <div className="flex flex-col gap-2.5 h-full justify-center -mt-3.5">
              {pods.map((pod, idx) => {
                const cpu = Math.floor(((Math.sin(tick * 0.7 + idx) + 1) / 2) * 15) + 5
                const mem = Math.floor(((Math.cos(tick * 0.4 + idx) + 1) / 2) * 35) + 124
                const ip = `10.244.1.${12 + idx}`
                const isPodError = is502Error

                return (
                  <div
                    key={`pod-${idx}`}
                    className={`rounded-xl border p-2 bg-[#0D0D11]/95 text-left transition-all duration-300 ${
                      isPodError
                        ? "border-rose-500/20 shadow-lg shadow-rose-500/5 ring-1 ring-rose-500/10"
                        : "border-white/[0.08]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${isPodError ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                        <span className="text-[9px] font-bold text-white leading-none">{pod.label}</span>
                      </div>
                      <span className="text-[7.5px] font-mono text-muted-foreground/50">{ip}</span>
                    </div>

                    <div className="flex justify-between text-[8px] font-mono text-muted-foreground/80 mt-1.5 pt-1.5 border-t border-white/[0.03]">
                      <span>CPU: <span className="text-white font-bold">{cpu}%</span></span>
                      <span>RAM: <span className="text-white font-bold">{mem}MB</span></span>
                    </div>
                    <div className="text-[8px] font-mono text-muted-foreground/80 mt-1">
                      <span>STATUS: <span className={isPodError ? "text-rose-500 font-bold" : "text-emerald-400 font-bold"}>{isPodError ? "ERR_CRASH" : "RUNNING"}</span></span>
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
            className={`absolute rounded-2xl border p-3 flex flex-col justify-between text-left pointer-events-auto shadow-lg transition-all duration-300 ${
              dbConnected
                ? "border-emerald-500/20 bg-[#0E0E12]"
                : "border-rose-500/30 bg-[#0E0E12] ring-1 ring-rose-500/10"
            }`}
          >
            <div className="flex items-center gap-2">
              <Database size={18} className={`shrink-0 ${dbConnected ? "text-emerald-400" : "text-rose-500"}`} />
              <span className="text-[11px] font-bold text-white tracking-wide">MySQL DB</span>
            </div>
            <div className="text-[8px] font-mono mt-1 font-bold">
              {dbConnected ? (
                <span className="text-emerald-400 font-medium">12 Active Conns</span>
              ) : (
                <span className="text-rose-500">CONN_TIMEOUT</span>
              )}
            </div>
          </div>

        </div>

        {/* Floating Zoom / Pan Controls (Bottom Left) */}
        <div className="absolute bottom-4 left-4 flex flex-col gap-1.5 bg-neutral-900/80 border border-white/[0.08] p-1.5 rounded-xl shadow-lg backdrop-blur-md z-10">
          <button
            onClick={zoomIn}
            className="w-7 h-7 flex items-center justify-center text-white/80 hover:text-white bg-white/[0.02] hover:bg-white/[0.06] rounded-lg active:scale-95 transition-all"
            title="Zoom In"
          >
            <MagnifyingGlassPlus size={16} />
          </button>
          <button
            onClick={zoomOut}
            className="w-7 h-7 flex items-center justify-center text-white/80 hover:text-white bg-white/[0.02] hover:bg-white/[0.06] rounded-lg active:scale-95 transition-all"
            title="Zoom Out"
          >
            <MagnifyingGlassMinus size={16} />
          </button>
          <button
            onClick={resetZoom}
            className="w-7 h-7 flex items-center justify-center text-white/80 hover:text-white bg-white/[0.02] hover:bg-white/[0.06] rounded-lg active:scale-95 transition-all"
            title="Reset Zoom"
          >
            <ArrowsOutSimple size={16} />
          </button>
        </div>

        {/* Floating Canvas Overlay Legend (Bottom Right) */}
        <div className="absolute bottom-4 right-4 bg-neutral-900/80 border border-white/[0.08] px-3 py-2 rounded-xl shadow-lg backdrop-blur-md text-[10px] text-muted-foreground flex flex-col gap-1 z-10">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 bg-emerald-500 rounded-full inline-block" />
            <span>Healthy / Active traffic</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 bg-rose-500 rounded-full inline-block" />
            <span>Blocked / Error traffic</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 bg-orange-400 rounded-full inline-block" />
            <span>Cloudflare Proxied path</span>
          </div>
        </div>
      </div>
    </div>
  )
}
