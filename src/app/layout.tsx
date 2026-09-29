import type { Metadata } from "next";
import localFont from "next/font/local";
import { Instrument_Serif, Space_Grotesk } from "next/font/google";
import "./globals.css";
import CheckoutProvider from "@/components/checkout/CheckoutProvider";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, CONTACT_EMAIL } from "@/lib/site";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Gropo — Compra colectiva · Mejores precios comprando juntos',
    template: '%s — Gropo',
  },
  description:
    'Gropo es el marketplace de compra colectiva. Únete a grupos de compra, junta demanda con otros compradores y consigue los mejores precios por volumen. Cuantos más sois, menos pagáis.',
  keywords: [
    'compra colectiva',
    'comprar en grupo',
    'comprar juntos',
    'comprar más barato',
    'descuentos por volumen',
    'marketplace',
    'grupo de compra',
    'mejor precio',
    'Gropo',
  ],
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    siteName: 'Gropo',
    title: 'Gropo — Compra colectiva · Mejores precios comprando juntos',
    description:
      'Únete a grupos de compra y consigue el mejor precio juntos. Cuantos más sois, menos pagáis.',
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gropo — Compra colectiva',
    description:
      'Marketplace de compra colectiva. Junta demanda y consigue mejores precios por volumen.',
  },
  alternates: {
    canonical: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Gropo',
    url: SITE_URL,
    logo: `${SITE_URL}/logo-gropo.svg`,
    contactPoint: {
      '@type': 'ContactPoint',
      email: CONTACT_EMAIL,
      contactType: 'customer service',
      availableLanguage: 'Spanish',
    },
    description:
      'Marketplace de compra colectiva. Agrupamos la demanda de consumidores para conseguir mejores precios mediante volumen.',
  }

  const websiteLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Gropo',
    url: SITE_URL,
    description:
      'Marketplace de compra colectiva — mejores precios comprando juntos.',
    inLanguage: 'es',
  }

  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} ${spaceGrotesk.variable} antialiased`}
      >
        <JsonLd data={organizationLd} />
        <JsonLd data={websiteLd} />
        <CheckoutProvider>{children}</CheckoutProvider>
      </body>
    </html>
  );
}
