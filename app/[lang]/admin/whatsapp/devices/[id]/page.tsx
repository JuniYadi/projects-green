import { redirect } from "next/navigation"

/**
 * @deprecated This surface has been consolidated to /portal/whatsapp/devices/[deviceId].
 * Redirecting all traffic to the new portal location.
 */
export default async function AdminDeviceDetailPage({
  params,
}: {
  params: Promise<{ id: string; lang: string }>
}) {
  const { id } = await params
  redirect(`/portal/whatsapp/devices/${id}`)
}
