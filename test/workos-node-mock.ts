import { mock } from "bun:test"

class MockException extends Error {
  constructor(payload: any) {
    super(typeof payload === "string" ? payload : payload.message)
    Object.assign(this, payload)
  }
}

export const workosNodeMock = {
  getWorkOS: () => ({
    userManagement: {
      listOrganizationMemberships: mock(async () => ({
        autoPagination: async () => [],
      })),
      getOrganizationMembership: mock(async () => null),
      listInvitations: mock(async () => ({ autoPagination: async () => [] })),
      sendInvitation: mock(async () => ({})),
      getInvitation: mock(async () => ({})),
      revokeInvitation: mock(async () => ({})),
      resendInvitation: mock(async () => ({})),
      updateOrganizationMembership: mock(async () => ({})),
      deleteOrganizationMembership: mock(async () => ({})),
      createOrganizationMembership: mock(async () => ({})),
      createMagicAuth: mock(async () => ({})),
      authenticateWithMagicAuth: mock(async () => ({})),
      authenticateWithEmailVerification: mock(async () => ({})),
      createUser: mock(async () => ({})),
      authenticateWithPassword: mock(async () => ({})),
    },
    organizations: {
      createOrganization: mock(async () => ({})),
      deleteOrganization: mock(async () => ({})),
      getOrganization: mock(async () => ({})),
      updateOrganization: mock(async () => ({})),
    },
    authorization: {
      listOrganizationRoles: mock(async () => ({
        autoPagination: async () => [],
      })),
    },
  }),
  createWorkOS: () => workosNodeMock.getWorkOS(),
  WorkOS: class WorkOS {},
  WorkOSNode: class WorkOSNode {},
  BadRequestException: class BadRequestException extends MockException {
    name = "BadRequestException"
  },
  ConflictException: class ConflictException extends MockException {
    name = "ConflictException"
  },
  NotFoundException: class NotFoundException extends MockException {
    name = "NotFoundException"
  },
  UnauthorizedException: class UnauthorizedException extends MockException {
    name = "UnauthorizedException"
  },
  UnprocessableEntityException: class UnprocessableEntityException extends MockException {
    name = "UnprocessableEntityException"
  },
  AuthenticationException: class AuthenticationException extends MockException {
    name = "AuthenticationException"
  },
}
