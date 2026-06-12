export const createAuthMock = ({
  withAuth,
  getUser,
  getOrganization,
}: {
  withAuth: (...args: unknown[]) => Promise<unknown>
  getUser: (userId: string) => Promise<unknown>
  getOrganization: (organizationId: string) => Promise<unknown>
}) => {
  return {
    withAuth,
    getWorkOS: () => ({
      userManagement: {
        getUser,
      },
      organizations: {
        getOrganization,
      },
    }),
  }
}
