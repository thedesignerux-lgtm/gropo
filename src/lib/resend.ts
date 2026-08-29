// Cliente Resend — SOLO servidor. Nunca importar desde un Client Component.
import { Resend } from 'resend'
import { joinConfirmationEmail } from './emails/joinConfirmation'
import { paymentInstructionsEmail } from './emails/paymentInstructions'
import { petitionMatchedEmail } from './emails/petitionMatched'
import { purchaseConfirmationEmail } from './emails/purchaseConfirmation'

// Remitente: por defecto el sandbox de Resend (entrega solo al email de la
// cuenta sin dominio verificado). Para producción, define RESEND_FROM con una
// dirección de un dominio verificado, p.ej. "Gropo <no-reply@vonda.es>".
const FROM = process.env.RESEND_FROM ?? 'Gropo <no-reply@vonda.es>'

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

export interface SendPaymentParams {
  to: string
  nombre?: string
  productName: string
  quantity: number
  finalPrice: number
  total: number
  paymentInfo?: string | null
  concepto: string
  deadline: string
}

export async function sendPaymentInstructions(params: SendPaymentParams) {
  const { to, nombre, productName, quantity, finalPrice, total, paymentInfo, concepto, deadline } = params
  const { subject, html, text } = paymentInstructionsEmail({
    nombre, productName, quantity, finalPrice, total, paymentInfo, concepto, deadline,
  })

  const resend = getResend()
  return resend.emails.send({ from: FROM, to, subject, html, text })
}

export interface SendPetitionMatchedParams {
  to: string
  nombre?: string
  productName: string
  groupUrl: string
}

export async function sendPetitionMatched(params: SendPetitionMatchedParams) {
  const { to, nombre, productName, groupUrl } = params
  const { subject, html, text } = petitionMatchedEmail({ nombre, productName, groupUrl })

  const resend = getResend()
  return resend.emails.send({ from: FROM, to, subject, html, text })
}

export interface SendPurchaseConfirmationParams {
  to: string
  nombre?: string
  productName: string
  quantity: number
  finalPrice: number
  total: number
}

export async function sendPurchaseConfirmation(params: SendPurchaseConfirmationParams) {
  const { to, nombre, productName, quantity, finalPrice, total } = params
  const { subject, html, text } = purchaseConfirmationEmail({ nombre, productName, quantity, finalPrice, total })

  const resend = getResend()
  return resend.emails.send({ from: FROM, to, subject, html, text })
}

// Alerta interna de operaciones (p.ej. fallos del cron de cierre). Email plano,
// sin plantilla: lo lee el equipo, no un cliente. Reutiliza cliente y remitente.
export async function sendAdminAlert(subject: string, text: string) {
  const to = process.env.ADMIN_EMAIL
  if (!to) throw new Error('ADMIN_EMAIL no configurada en el servidor')

  const resend = getResend()
  return resend.emails.send({ from: FROM, to, subject, text })
}
