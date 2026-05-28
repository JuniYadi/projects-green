"use client"

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
  return (
    <Card className="rounded-none border-0 border-b shadow-none">
      <CardHeader className="px-6">
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {description}
          {organizationName && (
            <>
              {" "}
              for <span className="font-medium">{organizationName}</span>.
            </>
          )}
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
