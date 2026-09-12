// Host canónico de Gropo, en un solo sitio.
//
// SIEMPRE con `www`: el ápice responde 308 y hay integraciones que no siguen
// redirecciones. `vonda.es` es un alias del mismo proyecto de Vercel — funciona,
// pero es la marca anterior y no debe aparecer en nada que vea o comparta un
// usuario. El 12-sep-2026 los enlaces de compartir y los emails de Pulse
// seguían apuntando ahí porque cada uno tenía su propia copia de la URL.
export const SITE_URL = 'https://www.gropo.es';

// Buzón de contacto. `vonda.es` publica un MX nulo (RFC 7505): rechaza todo el
// correo entrante, así que el enlace de contacto anterior no llegaba a nadie.
export const CONTACT_EMAIL = 'hola@gropo.es';
