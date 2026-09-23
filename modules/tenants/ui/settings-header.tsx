"use client"

import { useParams } from "next/navigation"

import { getMessagesForMaybeLocale } from "@/lib/i18n/messages"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type SettingsHeaderProps = {
  title: string
  description: string
  organizationName?: string
}

export function SettingsHeader({
  title,
  description,
  organizationName,
}: SettingsHeaderProps) {
  const params = useParams<{ lang?: string }>()
  const messages = getMessagesForMaybeLocale(
    params?.lang
  ).pTenantsSettingsHeader

  return (
    <Card className="rounded-none border-0 border-b shadow-none">
      <CardHeader className="px-6">
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {description}
          {organizationName && (
            <>
              {" "}
              {messages.forOrganization}{" "}
              <span className="font-medium">{organizationName}</span>.
            </>
          )}
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
