import React from "react"
import {
  SiDocker,
  SiHermes,
  SiMysql,
  SiN8N,
  SiPostgresql,
  SiRedis,
  SiUmami,
  SiWordpress,
} from "react-icons/si"
import { Package } from "@phosphor-icons/react"

// Mapping for known React Icons (Simple Icons) by slug / keyword
const REACT_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  n8n: SiN8N,
  hermes: SiHermes,
  umami: SiUmami,
  wordpress: SiWordpress,
  postgres: SiPostgresql,
  postgresql: SiPostgresql,
  redis: SiRedis,
  mysql: SiMysql,
  docker: SiDocker,
}

interface TemplateLogoProps {
  slug?: string
  name?: string
  iconUrl?: string | null
  className?: string
}

export function TemplateLogo({
  slug = "",
  name = "",
  iconUrl,
  className = "size-5",
}: TemplateLogoProps) {
  const [prevSource, setPrevSource] = React.useState<string | null>(null)
  const [hasError, setHasError] = React.useState(false)
  const normalizedSlug = slug.toLowerCase().trim()
  const ReactIcon = REACT_ICON_MAP[normalizedSlug]
  const imageSource =
    iconUrl ||
    (normalizedSlug ? `/app-hosting/icons/${normalizedSlug}.svg` : null)

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
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageSource}
        alt={name || slug}
        className={`${className} object-contain`}
        onError={() => setHasError(true)}
      />
    )
  }

  // Priority 3: Final fallback placeholder if no image exists
  return <Package className={`${className} text-muted-foreground`} />
}
