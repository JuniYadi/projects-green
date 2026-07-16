export default function HomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div style={{ fontFamily: "var(--font-display)" }}>{children}</div>
}
