import type { Metadata } from "next"
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components"
import { JetBrains_Mono, Space_Mono, Roboto } from "next/font/google"
import { cookies } from "next/headers"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { QueryProvider } from "@/components/query-provider"
import { localeCookieName } from "@/lib/i18n/config"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: {
    default: "PFNApp — Full-Stack Cloud Platform",
    template: "%s | PFNApp",
  },
  description:
    "PFNApp gives developers one place to deploy applications, run services, and manage cloud infrastructure.",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
}

const jetbrainsMonoHeading = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-heading",
})

const roboto = Roboto({ subsets: ["latin"], variable: "--font-sans" })

const fontDisplay = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-display",
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
  const locale = resolveLocaleOrDefault(
    cookieStore.get(localeCookieName)?.value
  )

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontDisplay.variable,
        jetbrainsMono.variable,
        "font-sans",
        roboto.variable,
        jetbrainsMonoHeading.variable
      )}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var _n;Object.defineProperty(window,'next',{configurable:true,enumerable:true,get:function(){return _n},set:function(v){if(v&&typeof v==='object'){try{delete v.version}catch(e){}}_n=v}})}catch(e){}",
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <AuthKitProvider>
          <QueryProvider>
            <ThemeProvider>
              <TooltipProvider>
                {children}
                <Toaster />
              </TooltipProvider>
            </ThemeProvider>
          </QueryProvider>
        </AuthKitProvider>
      </body>
    </html>
  )
}
