interface ConsoleWhatsAppLayoutProps {
  children: React.ReactNode
}

export default function ConsoleWhatsAppLayout({
  children,
}: ConsoleWhatsAppLayoutProps) {
  return (
    <main className="flex w-full min-w-0 flex-1 min-h-0 flex-col gap-6 p-6 pt-0">
      {children}
    </main>
  )
}
