export function getDateGroupLabel(date: Date): {
  label: string
  sortKey: number
} {
  const now = new Date()
  const msgDate = date
  // Normalize both to start of local day so "yesterday 23:59" isn't "Today" at 00:01
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgStart = new Date(
    msgDate.getFullYear(),
    msgDate.getMonth(),
    msgDate.getDate()
  )
  const diffMs = todayStart.getTime() - msgStart.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return { label: "Today", sortKey: 0 }
  if (diffDays === 1) return { label: "Yesterday", sortKey: 1 }
  if (diffDays <= 7) return { label: "7 Days Ago", sortKey: 2 }
  if (diffDays <= 14) return { label: "14 Days Ago", sortKey: 3 }
  if (diffDays <= 30) return { label: "30 Days Ago", sortKey: 4 }
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12)
    return {
      label: `${diffMonths} Month${diffMonths > 1 ? "s" : ""} Ago`,
      sortKey: 5,
    }
  const diffYears = Math.floor(diffMonths / 12)
  return {
    label: `${diffYears} Year${diffYears > 1 ? "s" : ""} Ago`,
    sortKey: 6,
  }
}

export function groupMessagesByDate<T extends { createdAt: string | Date }>(
  messages: T[]
): Array<{ label: string; messages: T[] }> {
  const groups = new Map<string, T[]>()

  for (const msg of messages) {
    const date =
      typeof msg.createdAt === "string"
        ? new Date(msg.createdAt)
        : msg.createdAt
    const { label } = getDateGroupLabel(date)
    const group = groups.get(label)
    if (group) {
      group.push(msg)
    } else {
      groups.set(label, [msg])
    }
  }

  return Array.from(groups.entries()).map(([label, msgs]) => ({
    label,
    messages: msgs,
  }))
}
