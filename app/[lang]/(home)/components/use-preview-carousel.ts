"use client"

import { useEffect, useState } from "react"

export function usePreviewCarousel(slideCount: number) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    let timer: number | undefined

    const schedule = () => {
      window.clearTimeout(timer)
      if (paused || document.hidden || motion.matches) return
      timer = window.setTimeout(
        () => setActiveIndex((index) => (index + 1) % slideCount),
        5500
      )
    }

    schedule()
    document.addEventListener("visibilitychange", schedule)
    motion.addEventListener("change", schedule)

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener("visibilitychange", schedule)
      motion.removeEventListener("change", schedule)
    }
  }, [activeIndex, paused, slideCount])

  return { activeIndex, setActiveIndex, setPaused }
}
