import React, { useState } from "react"
import { SiDocker, SiN8N, SiUmami, SiWordpress } from "react-icons/si"
import { Cpu, Database, Package } from "@phosphor-icons/react"

const REACT_ICON_MAP: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  n8n: SiN8N,
  hermes: Cpu,
  umami: SiUmami,
  wordpress: SiWordpress,
  postgres: Database,
  postgresql: Database,
  redis: Database,
  mysql: Database,
  docker: SiDocker,
}

interface TemplateLogoProps {
  slug?: string
  name?: string
  iconUrl?: string | null
  className?: string
}

const sanitizeImageUrl = (url?: string | null): string | null => {
  if (!url) return null
  const trimmed = url.trim()
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://")
  ) {
    try {
      // Ensure URL is well-formed if absolute
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        const parsed = new URL(trimmed)
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          return parsed.href
        }
        return null
      }
      // Relative path: ensure no protocol relative or javascript: bypass
      if (trimmed.startsWith("//") || trimmed.includes("javascript:")) {
        return null
      }
      return encodeURI(decodeURI(trimmed))
    } catch {
      return null
    }
  }
  return null
}

export function TemplateLogo({
  slug = "",
  name = "",
  iconUrl,
  className = "size-5",
}: TemplateLogoProps) {
  const [prevSource, setPrevSource] = useState<string | null>(null)
  const [hasError, setHasError] = useState(false)
  const normalizedSlug = slug.toLowerCase().trim()
  const ReactIcon = REACT_ICON_MAP[normalizedSlug]

  const safeCustomUrl = sanitizeImageUrl(iconUrl)
  const defaultSlugUrl = normalizedSlug
    ? `/app-hosting/icons/${encodeURIComponent(normalizedSlug)}.svg`
    : null
  const imageSource = safeCustomUrl || defaultSlugUrl

  if (prevSource !== imageSource) {
    setPrevSource(imageSource)
    setHasError(false)
  }

  // Priority 1: Use react-icons/si if it exists
  if (ReactIcon) {
    return <ReactIcon className={className} />
  }
  // Priority 2: Fallback to public/app-hosting/icons/<slug>.svg (or provided custom iconUrl)
  if (imageSource && !hasError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- dynamic icon path/SVG rendering
      <img
        src={imageSource}
        alt={name || slug || "Template icon"}
        className={`${className} object-contain`}
        onError={() => setHasError(true)}
      />
    )
  }

  // Priority 3: Final fallback placeholder if no image exists
  return <Package className={`${className} text-muted-foreground`} />
}
