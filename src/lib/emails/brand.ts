// ─── brand.ts ───────────────────────────────────────────────────────────────
// Componentes de marca reutilizables por TODAS las plantillas de email de Gropo.
//
// Rediseño completo (sep-2026): header con tagline, tarjetas de producto,
// badges de estado, bloques de alerta, botón CTA, trust badges, footer con
// logo + links + social + copyright.
//
// El HTML usa tablas para máxima compatibilidad con clientes de correo
// (Gmail, Outlook, Apple Mail, Yahoo, etc.). No se usa CSS externo ni SVG.
// ────────────────────────────────────────────────────────────────────────────

import { SITE_URL, CONTACT_EMAIL } from '../site'

// ─── CONSTANTES ────────────────────────────────────────────────────────────

export const EMAIL_LOGO_URL = `${SITE_URL}/logo.png`

export const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`

// Colores del design system
export const C = {
  primary:     '#024947',  // verde oscuro (logo, CTAs, headings)
  primaryLight:'#E5F0EF',  // fondo de badges de estado
  successGreen:'#0B7B44',  // texto de precio/ahorro positivo
  successBg:   '#E8F5E9',  // fondo de bloques de éxito
  successBdr:  '#B7E1C7',  // borde de bloques de éxito
  errorOrange: '#D4380D',  // texto de error
  errorBg:     '#FFF3F0',  // fondo de bloques de error
  errorBdr:    '#FFDCD4',  // borde de bloques de error
  warningBg:   '#FFF8F0',  // fondo de bloques de aviso
  warningBdr:  '#FFE2C2',  // borde de bloques de aviso
  dark:        '#111111',  // headings
  body:        '#333333',  // texto principal
  secondary:   '#555555',  // texto secundario
  muted:       '#888888',  // texto terciario
  light:       '#999999',  // texto muy sutil
  cardBg:      '#F8F8F8',  // fondo de tarjetas
  outerBg:     '#F5F5F5',  // fondo exterior del email
  white:       '#FFFFFF',
  border:      '#EAEAEA',  // bordes sutiles
  orange:      '#E8630A',  // acento naranja (logo dot)
} as const

// Ancho máximo del email
const MAX_W = 600

// ─── WRAPPER EXTERIOR ──────────────────────────────────────────────────────

/** Abre el wrapper exterior del email (body + table centering) */
export function emailOpen(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <style>
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; }
      .email-pad { padding-left: 16px !important; padding-right: 16px !important; }
      .hero-title { font-size: 26px !important; }
      .two-col td { display: block !important; width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; }
      .two-col td + td { padding-top: 12px !important; }
      .product-img { width: 100% !important; max-width: 200px !important; }
      .product-info { padding-left: 0 !important; padding-top: 14px !important; }
      .trust-badges td { display: block !important; width: 100% !important; text-align: left !important; padding: 8px 0 !important; }
      .footer-row td { display: block !important; width: 100% !important; text-align: center !important; padding: 4px 0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${C.outerBg};font-family:${FONT};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.outerBg};">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" class="email-container" width="${MAX_W}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${MAX_W}px;background:${C.white};border-radius:16px;overflow:hidden;">`
}

/** Cierra el wrapper exterior */
export function emailClose(): string {
  return `      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── HEADER ────────────────────────────────────────────────────────────────

/**
 * Header: logo GROPO (izquierda) + tagline (derecha).
 * Fallback alt estilado por si la imagen está bloqueada.
 */
export function emailHeader(): string {
  const logoW = Math.round((40 * 498) / 200)
  return `<tr><td class="email-pad" style="padding:28px 28px 0 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="left" style="vertical-align:middle;">
        <a href="${SITE_URL}" style="text-decoration:none;">
          <img src="${EMAIL_LOGO_URL}" width="${logoW}" height="40" alt="Gropo" style="display:block;width:${logoW}px;height:40px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;font-family:${FONT};font-size:20px;font-weight:700;color:${C.primary};">
        </a>
      </td>
      <td align="right" style="vertical-align:middle;font-family:${FONT};font-size:13px;color:${C.primary};line-height:1.4;font-weight:600;">
        Compra juntos.<br>Llega más lejos.
      </td>
    </tr>
  </table>
</td></tr>`
}

// ─── SECTION LABEL ─────────────────────────────────────────────────────────

/** Etiqueta de sección en mayúsculas: "TE HAS UNIDO AL GRUPO", etc. */
export function emailSectionLabel(text: string): string {
  return `<tr><td class="email-pad" style="padding:24px 28px 0 28px;">
  <p style="margin:0;font-family:${FONT};font-size:12px;font-weight:700;color:${C.primary};letter-spacing:0.5px;text-transform:uppercase;">${text}</p>
</td></tr>`
}

// ─── HERO: SALUDO + STATUS BADGE ───────────────────────────────────────────

export interface StatusBadgeConfig {
  /** Emoji o carácter para el icono */
  icon: string
  /** Color de fondo del icono */
  iconBg: string
  /** Color del icono/texto del icono */
  iconColor: string
  /** Título del badge */
  title: string
  /** Subtítulo del badge */
  subtitle: string
  /** Color del título */
  titleColor?: string
}

/**
 * Bloque héroe: saludo a la izquierda + badge de estado a la derecha.
 * El saludo es HTML libre (puede contener <strong>, etc.).
 */
export function emailHero(saludoHtml: string, badge?: StatusBadgeConfig): string {
  const badgeHtml = badge ? `
      <td width="160" align="right" style="vertical-align:top;padding-left:12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:${C.primaryLight};border-radius:12px;">
          <tr><td style="padding:14px 16px;text-align:center;">
            <div style="width:36px;height:36px;background:${badge.iconBg};border-radius:50%;margin:0 auto 8px auto;line-height:36px;text-align:center;font-size:18px;color:${badge.iconColor};">${badge.icon}</div>
            <p style="margin:0 0 2px 0;font-family:${FONT};font-size:13px;font-weight:700;color:${badge.titleColor ?? C.primary};line-height:1.3;">${badge.title}</p>
            <p style="margin:0;font-family:${FONT};font-size:11px;color:${C.secondary};line-height:1.3;">${badge.subtitle}</p>
          </td></tr>
        </table>
      </td>` : ''

  return `<tr><td class="email-pad" style="padding:8px 28px 0 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="vertical-align:top;">${saludoHtml}</td>${badgeHtml}
    </tr>
  </table>
</td></tr>`
}

/** Genera el HTML del saludo con nombre en verde */
export function emailSaludo(nombre: string | undefined, bodyHtml: string): string {
  const greeting = nombre
    ? `Hola <span style="color:${C.primary};font-weight:700;">${nombre}</span>,`
    : 'Hola,'
  return `<p style="margin:0 0 4px 0;font-family:${FONT};font-size:28px;font-weight:800;color:${C.dark};line-height:1.2;" class="hero-title">${greeting}</p>
        ${bodyHtml}`
}

// ─── PRODUCT CARD ──────────────────────────────────────────────────────────

export interface ProductCardData {
  imageUrl?: string
  brandName?: string
  productName: string
  attributes?: string[]  // hasta 3 atributos cortos
}

/**
 * Tarjeta de producto con imagen, marca, nombre y atributos.
 * Si no hay imagen, se muestra solo la info textual.
 */
export function emailProductCard(data: ProductCardData): string {
  const { imageUrl, brandName, productName, attributes } = data

  const imgCell = imageUrl
    ? `<td class="product-img" width="180" style="vertical-align:top;padding:0;">
        <div style="background:${C.cardBg};border-radius:8px;overflow:hidden;text-align:center;max-width:180px;">
          <img src="${imageUrl}" width="180" alt="${productName}" style="display:block;width:100%;max-width:180px;height:auto;border:0;outline:none;">
        </div>
      </td>`
    : ''

  const brandHtml = brandName
    ? `<p style="margin:0 0 4px 0;font-family:${FONT};font-size:12px;font-weight:700;color:${C.muted};letter-spacing:0.5px;text-transform:uppercase;">${brandName}</p>`
    : ''

  const attrsHtml = attributes && attributes.length > 0
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
        <tr>${attributes.map((attr, i) => `
          <td style="vertical-align:top;padding-right:${i < attributes.length - 1 ? '12' : '0'}px;${i > 0 ? 'border-left:1px solid #E0E0E0;padding-left:12px;' : ''}">
            <p style="margin:0;font-family:${FONT};font-size:11px;color:${C.secondary};line-height:1.3;">${attr}</p>
          </td>`).join('')}
        </tr>
      </table>`
    : ''

  return `<tr><td class="email-pad" style="padding:16px 28px 0 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.border};border-radius:12px;overflow:hidden;">
    <tr>
      ${imgCell}
      <td class="product-info" style="vertical-align:top;padding:16px 18px;${imageUrl ? 'padding-left:16px;' : ''}">
        ${brandHtml}
        <p style="margin:0;font-family:${FONT};font-size:17px;font-weight:700;color:${C.dark};line-height:1.3;">${productName}</p>
        ${attrsHtml}
      </td>
    </tr>
  </table>
</td></tr>`
}

// ─── TWO-COLUMN DATA BLOCK ────────────────────────────────────────────────

export interface DataColumn {
  icon?: string    // emoji/char for icon
  iconBg?: string  // background color for icon circle
  label: string
  value: string
  subtext?: string
  subtextColor?: string
}

/**
 * Bloque de dos columnas con datos (precio + cierre, etc.)
 */
export function emailTwoColumns(left: DataColumn, right: DataColumn): string {
  function renderCol(col: DataColumn): string {
    const iconHtml = col.icon
      ? `<div style="display:inline-block;width:32px;height:32px;background:${col.iconBg ?? C.primaryLight};border-radius:8px;text-align:center;line-height:32px;font-size:16px;margin-bottom:8px;">${col.icon}</div>`
      : ''
    const subtextHtml = col.subtext
      ? `<p style="margin:4px 0 0 0;font-family:${FONT};font-size:12px;font-weight:600;color:${col.subtextColor ?? C.successGreen};line-height:1.3;">${col.subtext}</p>`
      : ''
    return `${iconHtml}
      <p style="margin:0 0 2px 0;font-family:${FONT};font-size:12px;color:${C.muted};line-height:1.3;">${col.label}</p>
      <p style="margin:0;font-family:${FONT};font-size:22px;font-weight:700;color:${C.dark};line-height:1.2;">${col.value}</p>
      ${subtextHtml}`
  }

  return `<tr><td class="email-pad" style="padding:16px 28px 0 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cardBg};border-radius:12px;" class="two-col">
    <tr>
      <td width="50%" style="padding:18px 16px;vertical-align:top;">
        ${renderCol(left)}
      </td>
      <td width="1" style="width:1px;background:#E0E0E0;font-size:0;line-height:0;">&nbsp;</td>
      <td width="50%" style="padding:18px 16px;vertical-align:top;">
        ${renderCol(right)}
      </td>
    </tr>
  </table>
</td></tr>`
}

// ─── ALERT / INFO BLOCKS ──────────────────────────────────────────────────

export type AlertType = 'success' | 'error' | 'warning' | 'info'

/**
 * Bloque de alerta con icono, título y cuerpo.
 * success = verde (pago realizado, devolución garantizada)
 * error = rojo (pago no realizado)
 * warning = naranja
 * info = verde claro neutro
 */
export function emailAlertBlock(type: AlertType, title: string, body: string): string {
  const styles: Record<AlertType, { bg: string; bdr: string; titleColor: string; icon: string }> = {
    success: { bg: C.successBg, bdr: C.successBdr, titleColor: C.successGreen, icon: '✓' },
    error:   { bg: C.errorBg,  bdr: C.errorBdr,  titleColor: C.errorOrange, icon: '!' },
    warning: { bg: C.warningBg, bdr: C.warningBdr, titleColor: '#B45309', icon: '⚠' },
    info:    { bg: C.primaryLight, bdr: '#C5DEDD', titleColor: C.primary, icon: 'i' },
  }
  const s = styles[type]

  return `<tr><td class="email-pad" style="padding:16px 28px 0 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${s.bg};border:1px solid ${s.bdr};border-radius:12px;">
    <tr>
      <td width="40" style="padding:16px 0 16px 16px;vertical-align:top;">
        <div style="width:32px;height:32px;background:${s.titleColor};border-radius:50%;text-align:center;line-height:32px;font-size:16px;font-weight:700;color:${C.white};">${s.icon}</div>
      </td>
      <td style="padding:16px 18px 16px 12px;vertical-align:top;">
        <p style="margin:0 0 4px 0;font-family:${FONT};font-size:15px;font-weight:700;color:${s.titleColor};line-height:1.3;">${title}</p>
        <p style="margin:0;font-family:${FONT};font-size:14px;color:${C.body};line-height:1.5;">${body}</p>
      </td>
    </tr>
  </table>
</td></tr>`
}

// ─── MOTIVATIONAL / INFO BLOCK ─────────────────────────────────────────────

/**
 * Bloque informativo con icono, título y cuerpo (estilo "Juntos llegamos más lejos").
 */
export function emailInfoBlock(icon: string, title: string, body: string): string {
  return `<tr><td class="email-pad" style="padding:16px 28px 0 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cardBg};border-radius:12px;">
    <tr>
      <td width="48" style="padding:16px 0 16px 16px;vertical-align:top;">
        <div style="width:40px;height:40px;background:${C.primaryLight};border-radius:10px;text-align:center;line-height:40px;font-size:20px;">${icon}</div>
      </td>
      <td style="padding:16px 18px 16px 12px;vertical-align:top;">
        <p style="margin:0 0 4px 0;font-family:${FONT};font-size:15px;font-weight:700;color:${C.dark};line-height:1.4;">${title}</p>
        <p style="margin:0;font-family:${FONT};font-size:14px;color:${C.secondary};line-height:1.5;">${body}</p>
      </td>
    </tr>
  </table>
</td></tr>`
}

// ─── PHONE CTA BLOCK ───────────────────────────────────────────────────────

/**
 * Bloque con "ilustración" de teléfono + CTA secundario ("¿Quieres ver más detalles?").
 * Reemplaza al antiguo emailTrackBlock.
 */
export function emailPhoneBlock(title: string, body: string, ctaText?: string, ctaUrl?: string): string {
  const ctaHtml = ctaText && ctaUrl
    ? `<p style="margin:10px 0 0 0;"><a href="${ctaUrl}" style="font-family:${FONT};font-size:14px;font-weight:700;color:${C.primary};text-decoration:underline;">${ctaText} →</a></p>`
    : ''

  return `<tr><td class="email-pad" style="padding:16px 28px 0 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cardBg};border-radius:12px;">
    <tr>
      <td width="60" style="padding:16px 0 16px 16px;vertical-align:top;">
        <div style="width:48px;height:48px;background:${C.primaryLight};border-radius:12px;text-align:center;line-height:48px;font-size:24px;">📱</div>
      </td>
      <td style="padding:16px 18px 16px 12px;vertical-align:top;">
        <p style="margin:0 0 4px 0;font-family:${FONT};font-size:15px;font-weight:700;color:${C.dark};line-height:1.4;">${title}</p>
        <p style="margin:0;font-family:${FONT};font-size:13px;color:${C.secondary};line-height:1.5;">${body}</p>
        ${ctaHtml}
      </td>
    </tr>
  </table>
</td></tr>`
}

// ─── CTA BUTTON ────────────────────────────────────────────────────────────

/**
 * Botón CTA full-width. Color de fondo verde oscuro, texto blanco.
 * helperText = texto debajo del botón (opcional).
 */
export function emailCTAButton(text: string, url: string, helperText?: string): string {
  const helper = helperText
    ? `<p style="margin:10px 0 0 0;font-family:${FONT};font-size:13px;color:${C.muted};line-height:1.4;text-align:center;">${helperText}</p>`
    : ''

  return `<tr><td class="email-pad" style="padding:20px 28px 0 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center">
      <a href="${url}" style="display:block;width:100%;background:${C.primary};color:${C.white};font-family:${FONT};font-size:16px;font-weight:700;text-decoration:none;padding:14px 24px;border-radius:12px;text-align:center;box-sizing:border-box;">
        ${text}&nbsp;&nbsp;→
      </a>
    </td></tr>
  </table>
  ${helper}
</td></tr>`
}

/**
 * Botón CTA inline (no full-width), para secciones más pequeñas.
 */
export function emailCTAInline(text: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;background:${C.primary};color:${C.white};font-family:${FONT};font-size:14px;font-weight:700;text-decoration:none;padding:11px 20px;border-radius:10px;">${text}&nbsp;→</a>`
}

// ─── SECONDARY LINK ROW ───────────────────────────────────────────────────

/**
 * Fila con icono + texto + link a la derecha (e.g., "Descubre otros grupos").
 */
export function emailSecondaryRow(icon: string, title: string, subtitle: string, linkText: string, linkUrl: string): string {
  return `<tr><td class="email-pad" style="padding:16px 28px 0 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cardBg};border-radius:12px;">
    <tr>
      <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle;">
        <div style="width:36px;height:36px;background:${C.primaryLight};border-radius:8px;text-align:center;line-height:36px;font-size:18px;">${icon}</div>
      </td>
      <td style="padding:14px 12px;vertical-align:middle;">
        <p style="margin:0;font-family:${FONT};font-size:14px;font-weight:700;color:${C.dark};line-height:1.3;">${title}</p>
        <p style="margin:2px 0 0 0;font-family:${FONT};font-size:12px;color:${C.muted};line-height:1.3;">${subtitle}</p>
      </td>
      <td align="right" style="padding:14px 14px 14px 0;vertical-align:middle;">
        <a href="${linkUrl}" style="font-family:${FONT};font-size:13px;font-weight:700;color:${C.primary};text-decoration:underline;">${linkText}&nbsp;→</a>
      </td>
    </tr>
  </table>
</td></tr>`
}

// ─── SHARE BLOCK ───────────────────────────────────────────────────────────

/**
 * Bloque de compartir vía WhatsApp. Solo se muestra cuando tiene sentido
 * (emails donde más participantes benefician al grupo).
 */
export function emailShareBlock(productName: string, groupUrl: string): string {
  const waText = encodeURIComponent(
    `He encontrado ${productName} a mejor precio en Gropo. ¡Únete al grupo y cuantos más seamos, mejor precio! ${groupUrl}`
  )
  const waUrl = `https://wa.me/?text=${waText}`

  return `<tr><td class="email-pad" style="padding:16px 28px 0 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.primaryLight};border-radius:12px;">
    <tr>
      <td style="padding:14px 18px;">
        <p style="margin:0 0 6px 0;font-family:${FONT};font-size:13px;font-weight:700;color:${C.primary};line-height:1.3;">Comparte con tus amigos</p>
        <p style="margin:0 0 10px 0;font-family:${FONT};font-size:12px;color:${C.secondary};line-height:1.4;">Cuantos más seáis en el grupo, mejor precio para todos.</p>
        <a href="${waUrl}" style="display:inline-block;background:#25D366;color:${C.white};font-family:${FONT};font-size:13px;font-weight:700;text-decoration:none;padding:8px 16px;border-radius:8px;">Compartir por WhatsApp</a>
      </td>
    </tr>
  </table>
</td></tr>`
}

// ─── SIMPLE TEXT BLOCK ─────────────────────────────────────────────────────

/** Un párrafo suelto con padding estándar */
export function emailTextBlock(html: string): string {
  return `<tr><td class="email-pad" style="padding:14px 28px 0 28px;">
  <p style="margin:0;font-family:${FONT};font-size:14px;color:${C.secondary};line-height:1.5;">${html}</p>
</td></tr>`
}

// ─── TRUST BADGES ──────────────────────────────────────────────────────────

export interface TrustBadge {
  icon: string
  title: string
  subtitle: string
}

/** Presets de trust badges */
export const TRUST = {
  mejoresPrecios: { icon: '🏷', title: 'Mejores precios', subtitle: 'Comprando juntos' } as TrustBadge,
  pagoSeguro:     { icon: '🛡', title: 'Pago 100% seguro', subtitle: 'con Stripe' } as TrustBadge,
  compraSegura:   { icon: '🛡', title: 'Compra segura', subtitle: 'con Stripe' } as TrustBadge,
  envio:          { icon: '🚚', title: 'Envío a tu casa', subtitle: 'por el vendedor' } as TrustBadge,
  compraMejor:    { icon: '🌿', title: 'Compra mejor.', subtitle: 'Un consumo más responsable.' } as TrustBadge,
  responsable:    { icon: '🌿', title: 'Un consumo más responsable', subtitle: 'Menos impacto, más valor' } as TrustBadge,
  sinCargos:      { icon: '🏷', title: 'Sin cargos', subtitle: 'hasta el precio final' } as TrustBadge,
}

/**
 * Fila de 3 trust badges horizontales.
 */
export function emailTrustBadges(badges: [TrustBadge, TrustBadge, TrustBadge]): string {
  return `<tr><td class="email-pad" style="padding:20px 28px 0 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${C.border};padding-top:18px;" class="trust-badges">
    <tr>
      ${badges.map(b => `<td width="33%" style="vertical-align:top;text-align:center;padding:0 4px;">
        <p style="margin:0 0 2px 0;font-size:18px;line-height:1;">${b.icon}</p>
        <p style="margin:0 0 2px 0;font-family:${FONT};font-size:12px;font-weight:700;color:${C.dark};line-height:1.3;">${b.title}</p>
        <p style="margin:0;font-family:${FONT};font-size:11px;color:${C.muted};line-height:1.3;">${b.subtitle}</p>
      </td>`).join('')}
    </tr>
  </table>
</td></tr>`
}

// ─── FOOTER ────────────────────────────────────────────────────────────────

/**
 * Footer completo: logo + links + social + copyright.
 */
export function emailFooter(): string {
  const links = [
    { text: 'Ayuda', url: `${SITE_URL}/ayuda` },
    { text: 'Contacto', url: `mailto:${CONTACT_EMAIL}` },
    { text: 'Condiciones', url: `${SITE_URL}/condiciones` },
    { text: 'Privacidad', url: `${SITE_URL}/privacidad` },
  ]
  const linksHtml = links.map(l =>
    `<a href="${l.url}" style="color:${C.muted};text-decoration:none;font-size:12px;">${l.text}</a>`
  ).join('&nbsp;&nbsp;|&nbsp;&nbsp;')

  const logoW = Math.round((32 * 498) / 200)

  return `<tr><td style="padding:24px 28px 20px 28px;border-top:1px solid ${C.border};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="footer-row">
    <tr>
      <td style="vertical-align:middle;">
        <a href="${SITE_URL}" style="text-decoration:none;">
          <img src="${EMAIL_LOGO_URL}" width="${logoW}" height="32" alt="Gropo" style="display:block;width:${logoW}px;height:32px;border:0;">
        </a>
      </td>
      <td align="right" style="vertical-align:middle;font-family:${FONT};">
        ${linksHtml}
      </td>
    </tr>
  </table>
  <p style="margin:14px 0 0 0;font-family:${FONT};font-size:11px;color:${C.light};line-height:1.4;text-align:center;">© ${new Date().getFullYear()} Gropo. Compra juntos. Llega más lejos.</p>
</td></tr>`
}

// ─── SPACER ────────────────────────────────────────────────────────────────

export function emailSpacer(height = 8): string {
  return `<tr><td style="padding:0;height:${height}px;font-size:0;line-height:0;">&nbsp;</td></tr>`
}

// ─── PRICE HELPERS ─────────────────────────────────────────────────────────

export function fmtPrice(n: number): string {
  return (n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'
}

export function fmtCloses(iso: string): string {
  const d = new Date(iso)
  const fecha = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid',
  }).format(d)
  const hora = new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Madrid',
  }).format(d)
  return `${fecha} a las ${hora}`
}

// ─── BACKWARD COMPAT ───────────────────────────────────────────────────────

/**
 * @deprecated — use emailHeader() + emailFooter() + emailPhoneBlock() instead.
 * Kept temporarily for any callers that still import it.
 */
export function emailBrandHeader(height = 40): string {
  const width = Math.round((height * 498) / 200)
  return `<img src="${EMAIL_LOGO_URL}" width="${width}" height="${height}" alt="Gropo" style="display:block;width:${width}px;height:${height}px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;font-family:${FONT};font-size:20px;font-weight:700;color:${C.primary};">`
}

/**
 * @deprecated — use emailPhoneBlock() + emailCTAButton() instead.
 * Kept temporarily for any callers that still import it.
 */
export function emailTrackBlock(padX = 32): { html: string; text: string } {
  const url = `${SITE_URL}/mis-grupos`
  const text = `¿Quieres ver cómo va tu pedido?\nEntra en ${url} con el mismo email al que te hemos enviado este mensaje y verás tu grupo, el precio y el estado de tu pago. No hace falta contraseña.`
  const html = `<tr><td style="padding:16px ${padX}px 0 ${padX}px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cardBg};border-radius:12px;">
      <tr><td style="padding:16px 18px;font-family:${FONT};">
        <p style="margin:0 0 6px 0;font-size:15px;font-weight:700;color:${C.dark};line-height:1.4;">¿Quieres ver cómo va tu pedido?</p>
        <p style="margin:0 0 12px 0;font-size:14px;color:${C.secondary};line-height:1.5;">Entra con el mismo email al que te hemos enviado este mensaje. No hace falta contraseña.</p>
        <a href="${url}" style="display:inline-block;background:${C.primary};color:${C.white};font-family:${FONT};font-size:14px;font-weight:700;text-decoration:none;padding:11px 20px;border-radius:10px;">Ver mi pedido</a>
      </td></tr>
    </table>
  </td></tr>`
  return { html, text }
}
