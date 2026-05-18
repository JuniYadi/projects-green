type MemberRole = "owner" | "admin" | "member" | null

export type DiscoverableMember = {
  id: string
  userId: string
  displayName: string
  email: string | null
  status: string
  role: MemberRole
}

export type MemberDiscoveryFilters = {
  query: string
  role: string
  status: string
}

export const ALL_MEMBER_ROLES_FILTER = "all"
export const ALL_MEMBER_STATUSES_FILTER = "all"

const ROLE_ORDER = ["owner", "admin", "member", "unknown"] as const

const normalizeText = (value: string) => value.trim().toLowerCase()

const toRoleValue = (role: MemberRole) => role ?? "unknown"

export const getMemberDiscoveryOptions = (members: DiscoverableMember[]) => {
  const roleSet = new Set<string>()
  const statusSet = new Set<string>()

  for (const member of members) {
    roleSet.add(toRoleValue(member.role))
    statusSet.add(member.status)
  }

  const roleOptions = [...roleSet].sort((left, right) => {
    const leftIndex = ROLE_ORDER.indexOf(left as (typeof ROLE_ORDER)[number])
    const rightIndex = ROLE_ORDER.indexOf(right as (typeof ROLE_ORDER)[number])

    if (leftIndex === -1 && rightIndex === -1) {
      return left.localeCompare(right)
    }

    if (leftIndex === -1) {
      return 1
    }

    if (rightIndex === -1) {
      return -1
    }

    return leftIndex - rightIndex
  })

  const statusOptions = [...statusSet].sort((left, right) =>
    left.localeCompare(right)
  )

  return { roleOptions, statusOptions }
}

export const filterMembers = (
  members: DiscoverableMember[],
  filters: MemberDiscoveryFilters
) => {
  const normalizedQuery = normalizeText(filters.query)
  const normalizedRole = normalizeText(filters.role)
  const normalizedStatus = normalizeText(filters.status)

  return members.filter((member) => {
    if (
      normalizedRole &&
      normalizedRole !== ALL_MEMBER_ROLES_FILTER &&
      normalizeText(toRoleValue(member.role)) !== normalizedRole
    ) {
      return false
    }

    if (
      normalizedStatus &&
      normalizedStatus !== ALL_MEMBER_STATUSES_FILTER &&
      normalizeText(member.status) !== normalizedStatus
    ) {
      return false
    }

    if (!normalizedQuery) {
      return true
    }

    const searchableValues = [
      member.displayName,
      member.email ?? "",
      member.userId,
      member.id,
    ]

    return searchableValues.some((value) =>
      normalizeText(value).includes(normalizedQuery)
    )
  })
}
