'use client'

import { useEffect } from 'react'

const ACCENT_KEY = 'ledgerify:accent'
const DENSITY_KEY = 'ledgerify:density'

export function AppearancePreferenceBridge() {
  useEffect(() => {
    const root = document.documentElement
    const accent = localStorage.getItem(ACCENT_KEY)
    const density = localStorage.getItem(DENSITY_KEY)

    if (accent) {
      root.dataset.accent = accent
    }

    if (density) {
      root.dataset.density = density
    }
  }, [])

  return null
}

export const appearanceStorageKeys = {
  accent: ACCENT_KEY,
  density: DENSITY_KEY,
}
