"use client"

import { ClusterList } from "./_components/cluster-list"

export default function ClusterListPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Cluster Inventory</h1>
        <p className="text-sm text-muted-foreground">
          Manage hosting clusters, regions, and integration configurations.
        </p>
      </header>

      <ClusterList />
    </main>
  )
}
