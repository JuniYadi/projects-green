"use client"

import * as React from "react"
import {
  Phone,
  ChatCircle,
  PaperPlaneTilt,
  ChartLine,
  Lightning,
  CheckCircle,
  Warning,
} from "@phosphor-icons/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function WhatsAppDashboardPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">WhatsApp Dashboard</h1>
          <p className="text-muted-foreground">Overview of your WhatsApp Business activities</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/console/whatsapp/devices">
              <Phone className="mr-2 size-4" />
              Manage Devices
            </Link>
          </Button>
          <Button asChild>
            <Link href="/console/whatsapp/messages">
              <PaperPlaneTilt className="mr-2 size-4" />
              Send Message
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Today</CardTitle>
            <ChatCircle className="size-4 text-muted-foreground" weight="fill" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Inbound + Outbound</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quota Usage</CardTitle>
            <ChartLine className="size-4 text-muted-foreground" weight="fill" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0%</div>
            <p className="text-xs text-muted-foreground">0 / 0 messages</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Devices</CardTitle>
            <Phone className="size-4 text-muted-foreground" weight="fill" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0 / 0</div>
            <p className="text-xs text-muted-foreground">Connected devices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Lightning className="size-4 text-muted-foreground" weight="fill" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">--</div>
            <p className="text-xs text-muted-foreground">Message delivery rate</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer transition-colors hover:bg-muted/50">
          <Link href="/console/whatsapp/messages" className="block">
            <CardHeader>
              <PaperPlaneTilt className="mb-2 size-8 text-primary" weight="fill" />
              <CardTitle>Send a Message</CardTitle>
              <CardDescription>Send a direct message to a contact</CardDescription>
            </CardHeader>
          </Link>
        </Card>

        <Card className="cursor-pointer transition-colors hover:bg-muted/50">
          <Link href="/console/whatsapp/templates" className="block">
            <CardHeader>
              <Lightning className="mb-2 size-8 text-yellow-600" weight="fill" />
              <CardTitle>Use a Template</CardTitle>
              <CardDescription>Send a pre-approved template message</CardDescription>
            </CardHeader>
          </Link>
        </Card>

        <Card className="cursor-pointer transition-colors hover:bg-muted/50">
          <Link href="/console/whatsapp/contacts" className="block">
            <CardHeader>
              <ChartLine className="mb-2 size-8 text-blue-600" weight="fill" />
              <CardTitle>View Contacts</CardTitle>
              <CardDescription>Manage your contact list and groups</CardDescription>
            </CardHeader>
          </Link>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Device Status</CardTitle>
          <CardDescription>Your connected WhatsApp Business devices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Phone className="mb-3 size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No devices configured yet</p>
            <Button className="mt-3" asChild>
              <Link href="/console/whatsapp/devices">Add your first device</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Conversations</CardTitle>
          <CardDescription>Latest message activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ChatCircle className="mb-3 size-10 text-muted-foreground" weight="fill" />
            <p className="text-sm text-muted-foreground">No recent conversations</p>
            <Button variant="outline" className="mt-3" asChild>
              <Link href="/console/whatsapp/messages">View all messages</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}