import type { driver as DriverFunction } from "driver.js"
import type { AppLocale } from "@/lib/i18n/config"

export type TourStepMessages = {
  title: string
  description: string
  nextBtnText: string
  prevBtnText: string
  doneBtnText: string
}

export type ConsoleTourMessages = {
  nextBtnText: string
  prevBtnText: string
  doneBtnText: string
  orgSelector: {
    title: string
    description: string
  }
  sidebarMenu: {
    title: string
    description: string
  }
  userProfile: {
    title: string
    description: string
  }
  aiHelper: {
    title: string
    description: string
  }
}

export const defaultTourMessages: Record<AppLocale, ConsoleTourMessages> = {
  id: {
    nextBtnText: "Lanjut",
    prevBtnText: "Kembali",
    doneBtnText: "Selesai",
    orgSelector: {
      title: "Detail & Switch Organisasi",
      description:
        "Kelola detail organisasi bisnismu atau beralih antar organisasi aktif di sini.",
    },
    sidebarMenu: {
      title: "Menu & Navigasi Layanan",
      description:
        "Akses seluruh fitur WhatsApp Automation, Pesan, Billing, dan integrasi lainnya.",
    },
    userProfile: {
      title: "Pengaturan Profil & Bahasa",
      description:
        "Atur profil akun, ubah tema tampilan, dan ganti bahasa aplikasi (EN / ID) di sini.",
    },
    aiHelper: {
      title: "Tanya P (AI Helper)",
      description:
        "Butuh bantuan instan seputar fitur ini? Klik 'Tanya P' untuk asisten AI interaktif.",
    },
  },
  en: {
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Done",
    orgSelector: {
      title: "Organization Details & Switcher",
      description:
        "Manage your active business organization or switch between organizations here.",
    },
    sidebarMenu: {
      title: "Navigation & Services",
      description:
        "Quick access to WhatsApp Automation, Messages, Billing, and integrations.",
    },
    userProfile: {
      title: "Profile & Language Settings",
      description:
        "Manage your account, change visual theme, and switch app language (EN / ID) here.",
    },
    aiHelper: {
      title: "Ask P (AI Helper)",
      description:
        "Need instant help with this page? Click 'Ask P' for contextual AI assistance.",
    },
  },
}

export const CONSOLE_TOUR_STORAGE_KEY = "pfnapp_console_tour_completed_v1"

type CueLoaders = {
  loadDriver: () => Promise<{ driver: typeof DriverFunction }>
  loadStyles: () => Promise<unknown>
}

const defaultTourLoaders: CueLoaders = {
  loadDriver: () => import("driver.js"),
  loadStyles: () => import("driver.js/dist/driver.css"),
}

export const runConsoleTour = async ({
  locale,
  messages = defaultTourMessages[locale] ?? defaultTourMessages.en,
  force = false,
  loaders = defaultTourLoaders,
}: {
  locale: AppLocale
  messages?: ConsoleTourMessages
  force?: boolean
  loaders?: CueLoaders
}) => {
  if (typeof window === "undefined") {
    return null
  }

  if (!force) {
    try {
      const alreadyCompleted = window.localStorage.getItem(
        CONSOLE_TOUR_STORAGE_KEY
      )
      if (alreadyCompleted) {
        return null
      }
    } catch {
      // ignore storage error
    }
  }

  await loaders.loadStyles()
  const { driver } = await loaders.loadDriver()

  const reducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches

  const markTourCompleted = () => {
    try {
      window.localStorage.setItem(CONSOLE_TOUR_STORAGE_KEY, "true")
    } catch {
      // ignore storage error
    }
  }

  const tourInstance = driver({
    animate: !reducedMotion,
    allowClose: true,
    showProgress: true,
    nextBtnText: messages.nextBtnText,
    prevBtnText: messages.prevBtnText,
    doneBtnText: messages.doneBtnText,
    onDestroyed: () => {
      markTourCompleted()
    },
    onCloseClick: () => {
      markTourCompleted()
      tourInstance.destroy()
    },
    steps: [
      {
        element: '[data-tour="org-selector"]',
        popover: {
          title: messages.orgSelector.title,
          description: messages.orgSelector.description,
          side: "right",
          align: "start",
        },
      },
      {
        element: '[data-tour="sidebar-menu"]',
        popover: {
          title: messages.sidebarMenu.title,
          description: messages.sidebarMenu.description,
          side: "right",
          align: "start",
        },
      },
      {
        element: '[data-tour="user-profile"]',
        popover: {
          title: messages.userProfile.title,
          description: messages.userProfile.description,
          side: "right",
          align: "end",
        },
      },
      {
        element: '[data-tour="ai-helper"]',
        popover: {
          title: messages.aiHelper.title,
          description: messages.aiHelper.description,
          side: "bottom",
          align: "end",
        },
      },
    ],
  })

  tourInstance.drive()

  return () => tourInstance.destroy()
}
