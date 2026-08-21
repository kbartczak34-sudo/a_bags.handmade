import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
});

const sans = Manrope({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});

const siteUrl = "https://abagshandmade.pl";
const description =
  "Ręcznie plecione torebki tworzone w Polsce. Odkryj limitowane modele a_bags.handmade.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "a_bags.handmade",
    template: "%s | a_bags.handmade",
  },
  description,
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "pl_PL",
    url: siteUrl,
    siteName: "a_bags.handmade",
    title: "a_bags.handmade",
    description,
  },
  twitter: {
    card: "summary",
    title: "a_bags.handmade",
    description,
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body className={`${display.variable} ${sans.variable}`}>{children}</body>
    </html>
  );
}
