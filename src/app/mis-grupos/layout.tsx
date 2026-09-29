import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mis grupos',
  robots: { index: false, follow: false },
}

export default function MisGruposLayout({ children }: { children: React.ReactNode }) {
  return children
}
