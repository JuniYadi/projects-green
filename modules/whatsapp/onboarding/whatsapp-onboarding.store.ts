import { create } from "zustand"

export interface WhatsAppOnboardingStoreState {
  isGraduated: boolean
  progressPercent: number
  setIsGraduated: (isGraduated: boolean) => void
  setProgressPercent: (progressPercent: number) => void
  syncFromStorage: () => void
}

const GRADUATED_STORAGE_KEY = "whatsapp_onboarding_graduated"

export const useWhatsAppOnboardingStore = create<WhatsAppOnboardingStoreState>(
  (set) => ({
    isGraduated: false,
    progressPercent: 0,
    setIsGraduated: (isGraduated: boolean) => {
      set({ isGraduated })
      if (typeof window !== "undefined") {
        try {
          if (isGraduated) {
            sessionStorage.setItem(GRADUATED_STORAGE_KEY, "true")
          } else {
            sessionStorage.removeItem(GRADUATED_STORAGE_KEY)
          }
        } catch {}
      }
    },
    setProgressPercent: (progressPercent: number) => set({ progressPercent }),
    syncFromStorage: () => {
      if (typeof window === "undefined") return
      try {
        const manual = localStorage.getItem(GRADUATED_STORAGE_KEY)
        const statusCached = sessionStorage.getItem(GRADUATED_STORAGE_KEY)
        const isGraduated = manual === "true" || statusCached === "true"
        set({ isGraduated })
      } catch {}
    },
  })
)
