import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components"
import { Geist, JetBrains_Mono } from "next/font/google"
import { cookies } from "next/headers"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { localeCookieName } from "@/lib/i18n/config"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const locale = resolveLocaleOrDefault(cookieStore.get(localeCookieName)?.value)

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn("antialiased", fontSans.variable, jetbrainsMono.variable)}
    >
      <body suppressHydrationWarning>
        <AuthKitProvider>
          <ThemeProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </ThemeProvider>
        </AuthKitProvider>
      </body>
    </html>
  )
}
