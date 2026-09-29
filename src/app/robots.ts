import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/auth/',
          '/login',
          '/perfil',
          '/mis-grupos',
          '/notificaciones',
          '/mensajes',
          '/crear-peticion',
          '/peticion',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
