export type AppMessages = {
  navOrganization: {
    label: string
    organizationUnknown: string
    organizationMeta: string
    noActiveOrganizationMeta: string
    activeLabel: string
    switchOrganizationLabel: string
    switchingLabel: string
    switchOrganizationError: string
    loadingOrganizationsLabel: string
    noOrganizationsLabel: string
    createOrganizationLabel: string
    createOrganizationPlaceholder: string
    createOrganizationActionLabel: string
    creatingOrganizationLabel: string
    organizationNameRequired: string
    createOrganizationError: string
    organizationMembersLabel: string
    organizationSettingsLabel: string
  }
  navUser: {
    label: string
    organizationLabel: string
    organizationUnknown: string
    roleLabel: string
    pendingInvitationsLabel: string
    switchOrganizationLabel: string
    switchingLabel: string
    switchOrganizationError: string
    loadingOrganizationsLabel: string
    noOrganizationsLabel: string
    sessionSecurityLabel: string
    signedInViaLabel: string
    lastSignInLabel: string
    notAvailableLabel: string
    manageSignInLabel: string
    languageLabel: string
    languageMenuLabel: string
    languages: {
      en: string
      id: string
    }
    menu: {
      organizationMembers: string
      organizationSettings: string
      logout: string
    }
  }
}
