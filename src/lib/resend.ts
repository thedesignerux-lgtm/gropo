// Cliente Resend — SOLO servidor. Nunca importar desde un Client Component.
import { Resend } from 'resend'
import { joinConfirmationEmail } from './emails/joinConfirmation'
import { paymentInstructionsEmail } from './emails/paymentInstructions'
import { petitionMatchedEmail } from './emails/petitionMatched'
import { purchaseConfirmationEmail } from './emails/purchaseConfirmation'
import { selectedPriceReachedEmail } from './emails/selectedPriceReached'
import { closedNotReachedEmail } from './emails/closedNotReached'
import { authorizationFailedEmail } from './emails/authorizationFailed'
import { shipmentConfirmedEmail } from './emails/shipmentConfirmed'
import { weekendOpportunitiesEmail, type WeekendOpportunity } from './emails/weekendOpportunities'

// Remitente. Debe ser SIEMPRE una dirección de un dominio verificado en Resend
// (hoy: gropo.es, y el heredado vonda.es); con cualquier otro, Resend rechaza el
// envío. El valor por defecto es el de la marca ACTUAL: el 12-sep-2026 los emails
// de cierre salieron firmados por vonda.es porque este default seguía siendo el
// de la marca antigua y RESEND_FROM no estaba definida en Vercel.
const FROM = process.env.RESEND_FROM ?? 'Gropo <no-reply@gropo.es>'

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

export interface SendSelectedPriceReachedParams {
  to: string
  nombre?: string
  productName: string
  targetPrice: number
  currentPrice: number
  totalUnits: number
  closesAt: string
  groupUrl: string
}

export async function sendSelectedPriceReached(params: SendSelectedPriceReachedParams) {
  const { to, ...rest } = params
  const { subject, html, text } = selectedPriceReachedEmail(rest)

  const resend = getResend()
  return resend.emails.send({ from: FROM, to, subject, html, text })
}

export interface SendClosedNotReachedParams {
  to: string
  nombre?: string
  productName: string
  chosenPrice: number | null
  finalPrice: number | null
}

export async function sendClosedNotReached(params: SendClosedNotReachedParams) {
  const { to, ...rest } = params
  const { subject, html, text } = closedNotReachedEmail(rest)

  const resend = getResend()
  return resend.emails.send({ from: FROM, to, subject, html, text })
}

export interface SendAuthorizationFailedParams {
  to: string
  nombre?: string
  productName: string
  finalPrice: number
  groupUrl: string
}

export async function sendAuthorizationFailed(params: SendAuthorizationFailedParams) {
  const { to, ...rest } = params
  const { subject, html, text } = authorizationFailedEmail(rest)

  const resend = getResend()
  return resend.emails.send({ from: FROM, to, subject, html, text })
}

export interface SendShipmentConfirmedParams {
  to: string
  nombre?: string
  productName: string
  trackingCode?: string | null
  carrier?: string | null
  trackingUrl?: string | null
}

export async function sendShipmentConfirmed(params: SendShipmentConfirmedParams) {
  const { to, ...rest } = params
  const { subject, html, text } = shipmentConfirmedEmail(rest)

  const resend = getResend()
  return resend.emails.send({ from: FROM, to, subject, html, text })
}

export interface SendWeekendOpportunitiesParams {
  to: string
  nombre?: string
  opportunities: WeekendOpportunity[]
}

export async function sendWeekendOpportunities(params: SendWeekendOpportunitiesParams) {
  const { to, nombre, opportunities } = params
  const { subject, html, text } = weekendOpportunitiesEmail({ nombre, opportunities })

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
