// Cliente Resend — SOLO servidor. Nunca importar desde un Client Component.
import { Resend } from 'resend'
import { joinConfirmationEmail } from './emails/joinConfirmation'

// Remitente: por defecto el sandbox de Resend (entrega solo al email de la
// cuenta sin dominio verificado). Para producción, define RESEND_FROM con una
// dirección de un dominio verificado, p.ej. "Lunivo <no-reply@lunivo.com>".
const FROM = process.env.RESEND_FROM ?? 'Lunivo <onboarding@resend.dev>'

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY no configurada en el servidor')
  return new Resend(apiKey)
}

export interface SendJoinParams {
  to: string
  nombre?: string
  productName: string
  currentPrice: number
  closesAt: string
}

export async function sendJoinConfirmation(params: SendJoinParams) {
  const { to, nombre, productName, currentPrice, closesAt } = params
  const { subject, html, text } = joinConfirmationEmail({ nombre, productName, currentPrice, closesAt })

  const resend = getResend()
  return resend.emails.send({ from: FROM, to, subject, html, text })
}
