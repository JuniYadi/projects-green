export type IndonesianLocaleCueMessages = {
  title: string
  description: string
}

type LocaleCueDriver = {
  drive: () => void
  destroy: () => void
}

type DriverModule = {
  driver: (options: {
    animate: boolean
    allowClose: boolean
    showButtons: ["close"]
    steps: Array<{
      element: Element
      popover: IndonesianLocaleCueMessages
    }>
  }) => LocaleCueDriver
}

type CueLoaders = {
  loadDriver: () => Promise<DriverModule>
  loadStyles: () => Promise<unknown>
}

const defaultCueLoaders: CueLoaders = {
  loadDriver: () => import("driver.js"),
  loadStyles: () => import("driver.js/dist/driver.css"),
}

export const runIndonesianLocaleCue = async ({
  target,
  messages,
  reducedMotion,
  loaders = defaultCueLoaders,
}: {
  target: Element | null
  messages: IndonesianLocaleCueMessages
  reducedMotion: boolean
  loaders?: CueLoaders
}) => {
  if (!target?.isConnected) {
    return null
  }

  await loaders.loadStyles()
  const { driver } = await loaders.loadDriver()

  if (!target.isConnected) {
    return null
  }

  const cue = driver({
    animate: !reducedMotion,
    allowClose: true,
    showButtons: ["close"],
    steps: [
      {
        element: target,
        popover: messages,
      },
    ],
  })
  cue.drive()

  return () => cue.destroy()
}
