import { redirect } from "next/navigation"

/**
 * @deprecated This surface has been consolidated to /portal/whatsapp/devices.
 * Redirecting all traffic to the new portal location.
 */
export default function AdminDevicesPage() {
  redirect("/portal/whatsapp/devices")
}
