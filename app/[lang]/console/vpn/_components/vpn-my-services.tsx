"use client"

import { useState } from "react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  cancelVpnSubscription,
  getVpnProxyCredentials,
  vpnConfigDownloadUrl,
  type VpnServerAccount,
  type VpnSubscription,
} from "@/lib/vpn-client"
import { DownloadIcon, EyeIcon, EyeSlashIcon } from "@phosphor-icons/react"

type Props = {
  subscriptions: VpnSubscription[]
  onChanged: () => void
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

const STATUS_VARIANT: Record<
  VpnSubscription["status"],
  "default" | "secondary" | "destructive"
> = {
  ACTIVE: "default",
  SUSPENDED: "secondary",
  EXPIRED: "destructive",
}

function ProxyCredentialCell({
  subscriptionId,
  account,
}: {
  subscriptionId: string
  account: VpnServerAccount
}) {
  const [password, setPassword] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(false)

  const toggle = async () => {
    if (revealed) {
      setRevealed(false)
      return
    }
    if (password === null) {
      setLoading(true)
      try {
        const creds = await getVpnProxyCredentials(subscriptionId, account.id)
        setPassword(creds.password ?? "—")
      } catch {
        setPassword("—")
      } finally {
        setLoading(false)
      }
    }
    setRevealed(true)
  }

  return (
    <div className="space-y-1 text-sm">
      <p>
        user: <span className="font-mono">{account.username}</span>
      </p>
      <div className="flex items-center gap-2">
        <span className="font-mono">
          pass: {revealed ? (password ?? "…") : "••••••••"}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-1"
          onClick={toggle}
          disabled={loading}
          aria-label={revealed ? "Hide password" : "Show password"}
        >
          {revealed ? (
            <EyeSlashIcon className="h-4 w-4" />
          ) : (
            <EyeIcon className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}

function ConfigCell({
  subscriptionId,
  account,
}: {
  subscriptionId: string
  account: VpnServerAccount
}) {
  if (account.protocol === "PROXY") {
    return <ProxyCredentialCell subscriptionId={subscriptionId} account={account} />
  }
  const ext = account.protocol === "WIREGUARD" ? ".conf" : ".ovpn"
  if (!account.hasConfig) {
    return <span className="text-sm text-muted-foreground">Provisioning…</span>
  }
  return (
    <Button asChild size="sm" variant="outline">
      <a href={vpnConfigDownloadUrl(subscriptionId, account.id)}>
        <DownloadIcon className="mr-1 h-4 w-4" />
        {ext}
      </a>
    </Button>
  )
}

export function VpnMyServices({ subscriptions, onChanged }: Props) {
  const [cancelling, setCancelling] = useState<string | null>(null)

  const handleCancel = async (id: string) => {
    setCancelling(id)
    try {
      await cancelVpnSubscription(id)
      onChanged()
    } finally {
      setCancelling(null)
    }
  }

  return (
    <div className="space-y-6">
      {subscriptions.map((sub) => (
        <Card key={sub.id}>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                Subscription
                <Badge variant={STATUS_VARIANT[sub.status]}>{sub.status}</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Next bill: {formatDate(sub.currentPeriodEnd)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCancel(sub.id)}
              disabled={cancelling === sub.id || sub.status !== "ACTIVE"}
            >
              {cancelling === sub.id ? "Cancelling…" : "Cancel"}
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Server</TableHead>
                  <TableHead>Use</TableHead>
                  <TableHead>Config / Credentials</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sub.serverAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">
                      {account.serverName}
                    </TableCell>
                    <TableCell>{account.protocol}</TableCell>
                    <TableCell>
                      <ConfigCell subscriptionId={sub.id} account={account} />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          account.provisioningStatus === "ACTIVE"
                            ? "default"
                            : account.provisioningStatus === "FAILED"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {account.provisioningStatus}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
