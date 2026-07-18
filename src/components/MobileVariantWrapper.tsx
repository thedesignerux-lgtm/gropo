'use client'

import { useEffect } from 'react'

interface Props {
  variant: '2d' | '2c'
  children: React.ReactNode
}

/**
 * Persists the A/B variant in a cookie so the user sees the same layout
 * across page loads. The variant is assigned server-side (page.tsx) and
 * this wrapper just saves it client-side on mount.
 */
export default function MobileVariantWrapper({ variant, children }: Props) {
  useEffect(() => {
    // Set cookie for 90 days
    document.cookie = `vonda_mobile_variant=${variant};path=/;max-age=${90 * 86400};SameSite=Lax`
  }, [variant])

  return <>{children}</>
}
