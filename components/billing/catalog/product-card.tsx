import Link from "next/link"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  GlobeIcon,
  RocketLaunchIcon,
  WhatsappLogoIcon,
} from "@/components/ui/phosphor-icons"
import { cn } from "@/lib/utils"
import type { CatalogProduct } from "@/lib/billing-client"

type ProductCode = "APP_HOSTING" | "VPN" | "WHATSAPP"

type ProductInfo = {
  label: string
  icon: React.ReactNode
}

const productConfig: Record<ProductCode, ProductInfo> = {
  APP_HOSTING: {
    label: "App Hosting",
    icon: <RocketLaunchIcon className="h-6 w-6" />,
  },
  VPN: {
    label: "VPN",
    icon: <GlobeIcon className="h-6 w-6" />,
  },
  WHATSAPP: {
    label: "WhatsApp",
    icon: <WhatsappLogoIcon className="h-6 w-6" />,
  },
}

type CatalogProductCardProps = {
  product: CatalogProduct
  className?: string
}

export function CatalogProductCard({
  product,
  className,
}: CatalogProductCardProps) {
  const code = product.code as ProductCode
  const info = productConfig[code] ?? {
    label: product.code,
    icon: <RocketLaunchIcon className="h-6 w-6" />,
  }

  return (
    <Card
      className={cn(
        "group transition-shadow duration-200 hover:shadow-md",
        className
      )}
    >
      <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-3">
        {info.icon}
        <div className="space-y-1">
          <CardTitle className="text-base font-medium">{info.label}</CardTitle>
          <CardDescription className="text-sm">
            {product.description ?? ""}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Link
          href={`/console/billing/services/${product.code.toLowerCase()}`}
          className="text-sm font-medium text-primary underline underline-offset-2 hover:text-primary/80"
        >
          View plans
        </Link>
      </CardContent>
    </Card>
  )
}
