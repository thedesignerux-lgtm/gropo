import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/site'
import JsonLd from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'Centro de ayuda',
  description:
    'Preguntas frecuentes sobre Gropo: cómo funcionan los grupos de compra, retenciones, pagos, envíos y garantías. Todo lo que necesitas saber sobre la compra colectiva.',
  alternates: { canonical: `${SITE_URL}/ayuda` },
}

// Las FAQs duplicadas aquí para el structured data (la page.tsx es 'use client')
const FAQS = [
  { q: '¿Me cobráis al unirme a un grupo?', a: 'No. Al asegurar tu precio hacemos una retención en tu tarjeta, no un cobro. Solo se procesa el pago si el grupo alcanza su objetivo al cerrar. Si no lo alcanza, la retención se libera y no se te cobra nada.' },
  { q: '¿Qué significa "asegurar el precio"?', a: 'Reservas tu plaza en el grupo al precio actual. Si entran más personas y el precio baja, pagas el precio más bajo. Nunca pagas más del máximo que aceptaste al unirte.' },
  { q: '¿Qué pasa si el grupo no llega al objetivo?', a: 'No pasa nada malo: se libera tu retención automáticamente y no se realiza ningún cargo. Es la garantía de Gropo — si no hay grupo, no hay pago.' },
  { q: '¿Cuándo cierra un grupo?', a: 'Los grupos cierran cada domingo a las 22:00 (hora peninsular española). En ese momento se fija el precio final único para todos los participantes.' },
  { q: '¿Es seguro el pago?', a: 'Sí. Los pagos se gestionan a través de Stripe, líder mundial en pagos. Gropo no almacena los datos de tu tarjeta.' },
]

export default function AyudaLayout({ children }: { children: React.ReactNode }) {
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.a,
      },
    })),
  }

  return (
    <>
      <JsonLd data={faqLd} />
      {children}
    </>
  )
}
