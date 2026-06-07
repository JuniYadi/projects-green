import { redirect } from "next/navigation"

/**
 * @deprecated This surface has been consolidated to /portal/whatsapp/devices/[deviceId].
 * Redirecting all traffic to the new portal location.
 */
export default function AdminDeviceDetailPage({
  params,
}: {
  params: Promise<{ id: string; lang: string }>
}) {
  // We can't await params in a redirect page without making it async,
  // but redirect() works synchronously. We redirect to the portal devices
  // list; individual device detail will be accessed from there.
  redirect("/portal/whatsapp/devices")
}
