export const getWorkOSRedirectUri = () => {
  return (
    process.env.WORKOS_REDIRECT_URI?.trim() ||
    process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI?.trim() ||
    undefined
  )
}
