"use client"

import { useAuth } from "@workos-inc/authkit-nextjs/components"
import { useMemo, useState } from "react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { CaretUpDownIcon, SparkleIcon, CheckCircleIcon, CreditCardIcon, BellIcon, SignOutIcon } from "@phosphor-icons/react"

import type { AppSidebarUser } from "@/components/app-sidebar"

const resolveInitials = (name: string, email: string) => {
  const normalizedName = name.trim()
  const fallbackName = email.trim().split("@")[0]?.trim()
  const source = normalizedName || fallbackName || "User"
  const parts = source.split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return "U"
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}

export function NavUser({
  user,
}: {
  user: AppSidebarUser
}) {
  const { isMobile } = useSidebar()
  const { signOut } = useAuth()
  const initials = resolveInitials(user.name, user.email)
  const [avatarStatus, setAvatarStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle")
  const hasAvatarUrl = useMemo(() => Boolean(user.avatarUrl?.trim()), [user.avatarUrl])
  const showFallback = !hasAvatarUrl || avatarStatus === "error"

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                {hasAvatarUrl ? (
                  <AvatarImage
                    src={user.avatarUrl ?? undefined}
                    alt={user.name}
                    onLoadingStatusChange={setAvatarStatus}
                  />
                ) : null}
                {showFallback ? <AvatarFallback className="rounded-lg">{initials}</AvatarFallback> : null}
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <CaretUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  {hasAvatarUrl ? (
                    <AvatarImage
                      src={user.avatarUrl ?? undefined}
                      alt={user.name}
                      onLoadingStatusChange={setAvatarStatus}
                    />
                  ) : null}
                  {showFallback ? <AvatarFallback className="rounded-lg">{initials}</AvatarFallback> : null}
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <SparkleIcon
                />
                Upgrade to Pro
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <CheckCircleIcon
                />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCardIcon
                />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem>
                <BellIcon
                />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault()
                void signOut({ returnTo: "/login" })
              }}
            >
              <SignOutIcon
              />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
