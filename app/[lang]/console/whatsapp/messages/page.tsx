"use client"

import * as React from "react"
import { ChatCircle, PaperPlaneTilt, ArrowBendDownLeft, ArrowBendUpRight, MagnifyingGlass } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function WhatsAppMessagesPage() {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [directionFilter, setDirectionFilter] = React.useState("all")

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
        <p className="text-muted-foreground">
          View and manage your WhatsApp message history.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Conversations List */}
        <div className="rounded-lg border bg-card lg:col-span-1">
          <div className="border-b p-4">
            <h3 className="font-semibold">Conversations</h3>
            <div className="mt-3 flex flex-col gap-2">
              <div className="relative">
                <MagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ChatCircle className="mb-3 size-10 text-muted-foreground" weight="fill" />
              <p className="text-sm text-muted-foreground">No conversations yet</p>
              <Button variant="outline" className="mt-3">
                <PaperPlaneTilt className="mr-2 size-4" />
                Start a conversation
              </Button>
            </div>
          </div>
        </div>

        {/* Message Thread */}
        <div className="rounded-lg border bg-card lg:col-span-2">
          <div className="border-b p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Select a conversation</h3>
              <Select
                value={directionFilter}
                onValueChange={setDirectionFilter}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="INBOX">Inbox</SelectItem>
                  <SelectItem value="OUTBOX">Outbox</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex max-h-[500px] flex-col items-center justify-center overflow-y-auto p-4">
            <ChatCircle className="mb-3 size-10 text-muted-foreground" weight="fill" />
            <p className="text-sm text-muted-foreground">
              Select a conversation to view messages
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}