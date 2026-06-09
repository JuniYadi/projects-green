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
    createOrganizationDialogTitle: string
    createOrganizationDialogDescription: string
    createOrganizationNameLabel: string
    createOrganizationCurrencyLabel: string
    createOrganizationCurrencyHint: string
    createOrganizationCancelLabel: string
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
    themeLabel: string
    themeMenuLabel: string
    themes: {
      light: string
      dark: string
      system: string
    }
    menu: {
      organizationMembers: string
      organizationSettings: string
      logout: string
    }
  }
}
