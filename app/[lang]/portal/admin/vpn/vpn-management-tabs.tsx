"use client"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

import { RegionsTable } from "./regions-table"
import { ServersTable } from "./servers-table"
import { SshKeysTable } from "./ssh-keys-table"

export function VpnManagementTabs() {
  return (
    <Tabs defaultValue="regions" className="w-full">
      <TabsList>
        <TabsTrigger value="regions">Regions</TabsTrigger>
        <TabsTrigger value="servers">Servers</TabsTrigger>
        <TabsTrigger value="ssh-keys">SSH Keys</TabsTrigger>
      </TabsList>
      <TabsContent value="regions" className="mt-4">
        <RegionsTable />
      </TabsContent>
      <TabsContent value="servers" className="mt-4">
        <ServersTable />
      </TabsContent>
      <TabsContent value="ssh-keys" className="mt-4">
        <SshKeysTable />
      </TabsContent>
    </Tabs>
  )
}
