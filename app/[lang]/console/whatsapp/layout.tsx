interface ConsoleWhatsAppLayoutProps {
  children: React.ReactNode
}

export default function ConsoleWhatsAppLayout({
  children,
}: ConsoleWhatsAppLayoutProps) {
  return (
    <main className="w-full min-w-0 flex flex-1 flex-col gap-6 p-6 pt-0">
      {children}
    </main>
  )
}
