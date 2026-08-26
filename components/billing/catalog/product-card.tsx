import Link from "next/link"
import { useParams } from "next/navigation"
import { cn } from "@/lib/utils"
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
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import type { CatalogProduct } from "@/lib/billing-client"

type ProductCode = "APP_HOSTING" | "VPN" | "WHATSAPP"

type ProductInfo = {
  icon: React.ReactNode
}

const productConfig: Record<ProductCode, ProductInfo> = {
  APP_HOSTING: {
    icon: <RocketLaunchIcon className="h-6 w-6" />,
  },
  VPN: {
    icon: <GlobeIcon className="h-6 w-6" />,
  },
  WHATSAPP: {
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
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)
  const messages = getMessages(locale)
  const t = messages.console.billing
  const code = product.code as ProductCode
  const info = productConfig[code] ?? {
    icon: <RocketLaunchIcon className="h-6 w-6" />,
  }
  const label =
    code === "APP_HOSTING"
      ? t.singleSubscription.appHostingTitle
      : code === "VPN"
        ? t.singleSubscription.vpnTitle
        : code === "WHATSAPP"
          ? t.singleSubscription.whatsappTitle
          : product.name

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
          <CardTitle className="text-base font-medium">{label}</CardTitle>
          <CardDescription className="text-sm">
            {product.description ?? ""}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Link
          href={`/${locale}/console/billing/services/${product.code.toLowerCase()}`}
          className="text-sm font-medium text-primary underline underline-offset-2 hover:text-primary/80"
        >
          {t.services.viewPlans}
        </Link>
      </CardContent>
    </Card>
  )
}
