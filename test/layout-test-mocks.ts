export const createNavigationMock = ({
  pathname,
  redirect,
}: {
  pathname: string
  redirect: (path: string) => void
}) => {
  return {
    redirect,
    usePathname: () => pathname,
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({
      replace: () => {},
      push: () => {},
      refresh: () => {},
    }),
  }
}

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
