import type { Metadata } from "next";
import localFont from "next/font/local";
import { Instrument_Serif, Space_Grotesk } from "next/font/google";
import "./globals.css";
import CheckoutProvider from "@/components/checkout/CheckoutProvider";

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
  title: "Vonda — Compra en grupo",
  description: "Únete a grupos de compra y consigue el mejor precio juntos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} ${spaceGrotesk.variable} antialiased`}
      >
        <CheckoutProvider>{children}</CheckoutProvider>
      </body>
    </html>
  );
}
