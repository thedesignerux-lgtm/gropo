import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mensajes',
  robots: { index: false, follow: false },
}

export default function MensajesLayout({ children }: { children: React.ReactNode }) {
  return children
}
