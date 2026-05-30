"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

import { MemberBillingTable } from "@/components/billing/admin/member-billing-table"
import { getAdminMembers } from "@/lib/billing-client"
import type { AdminMember } from "@/lib/billing-client"

type MembersTabProps = {
  lang: string
}

export function MembersTab({ lang }: MembersTabProps) {
  const [members, setMembers] = useState<AdminMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadMembers() {
      try {
        const response = await getAdminMembers()
        setMembers(response.members)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load members")
      } finally {
        setIsLoading(false)
      }
    }

    loadMembers()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-destructive">
          {error}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <MemberBillingTable members={members} lang={lang} />
    </div>
  )
}