/**
 * Componente para inyectar structured data (JSON-LD) en el <head>.
 * Se usa como server component — sin 'use client'.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
