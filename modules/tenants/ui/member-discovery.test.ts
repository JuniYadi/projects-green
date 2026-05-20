import { describe, expect, it } from "bun:test"

import {
  ALL_MEMBER_ROLES_FILTER,
  ALL_MEMBER_STATUSES_FILTER,
  filterMembers,
  getMemberDiscoveryOptions,
} from "@/modules/tenants/ui/member-discovery"

const makeMember = (
  overrides: Partial<Parameters<typeof filterMembers>[0][0]>
) => {
  return {
    id: "mem_default",
    userId: "user_default",
    displayName: "Default User",
    email: "default@example.com",
    status: "active",
    role: "member" as const,
    ...overrides,
  }
}

describe("member-discovery", () => {
  it("filters by query across name, email, membership id, and user id", () => {
    const members = [
      makeMember({ id: "mem_1", userId: "u_alice", displayName: "Alice Z" }),
      makeMember({
        id: "mem_2",
        userId: "u_bob",
        displayName: "Bob Q",
        email: "bob@example.com",
      }),
      makeMember({
        id: "mem_3",
        userId: "u_charlie",
        displayName: "Charlie R",
        email: null,
      }),
    ]

    expect(
      filterMembers(members, {
        query: "alice",
        role: ALL_MEMBER_ROLES_FILTER,
        status: ALL_MEMBER_STATUSES_FILTER,
      }).map((member) => member.id)
    ).toEqual(["mem_1"])

    expect(
      filterMembers(members, {
        query: "bob@example.com",
        role: ALL_MEMBER_ROLES_FILTER,
        status: ALL_MEMBER_STATUSES_FILTER,
      }).map((member) => member.id)
    ).toEqual(["mem_2"])

    expect(
      filterMembers(members, {
        query: "u_charlie",
        role: ALL_MEMBER_ROLES_FILTER,
        status: ALL_MEMBER_STATUSES_FILTER,
      }).map((member) => member.id)
    ).toEqual(["mem_3"])

    expect(
      filterMembers(members, {
        query: "mem_2",
        role: ALL_MEMBER_ROLES_FILTER,
        status: ALL_MEMBER_STATUSES_FILTER,
      }).map((member) => member.id)
    ).toEqual(["mem_2"])
  })

  it("applies role and status filters with all-option fallbacks", () => {
    const members = [
      makeMember({ id: "owner_active", role: "owner", status: "active" }),
      makeMember({ id: "admin_active", role: "admin", status: "active" }),
      makeMember({ id: "member_inactive", role: "member", status: "inactive" }),
      makeMember({ id: "unknown_pending", role: null, status: "pending" }),
    ]

    expect(
      filterMembers(members, {
        query: "",
        role: "owner",
        status: ALL_MEMBER_STATUSES_FILTER,
      }).map((member) => member.id)
    ).toEqual(["owner_active"])

    expect(
      filterMembers(members, {
        query: "",
        role: ALL_MEMBER_ROLES_FILTER,
        status: "inactive",
      }).map((member) => member.id)
    ).toEqual(["member_inactive"])

    expect(
      filterMembers(members, {
        query: "",
        role: "unknown",
        status: "pending",
      }).map((member) => member.id)
    ).toEqual(["unknown_pending"])
  })

  it("returns practical role and status options derived from dataset", () => {
    const members = [
      makeMember({ role: "member", status: "inactive" }),
      makeMember({ role: "owner", status: "active" }),
      makeMember({ role: null, status: "pending" }),
      makeMember({ role: "admin", status: "active" }),
    ]

    const options = getMemberDiscoveryOptions(members)

    expect(options.roleOptions).toEqual(["owner", "admin", "member", "unknown"])
    expect(options.statusOptions).toEqual(["active", "inactive", "pending"])
  })
})
