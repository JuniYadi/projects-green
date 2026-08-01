"use client"

import { useParams } from "next/navigation"
import { ClusterDetail } from "./cluster-detail"

export default function ClusterDetailPage() {
  const params = useParams<{ clusterId: string }>()

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <ClusterDetail clusterId={params.clusterId} />
    </main>
  )
}
