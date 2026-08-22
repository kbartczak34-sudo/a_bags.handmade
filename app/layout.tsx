import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import PaymentMethodEnhancer from "./payment-method-enhancer";
import ProductPreviewEnhancer from "./product-preview-enhancer";
import VatDisplayEnhancer from "./vat-display-enhancer";
import "./globals.css";
import "./footer-overrides.css";

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
});

const sans = Manrope({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "a_bags.handmade",
  description:
    "Ręcznie plecione torebki tworzone w Polsce. Odkryj limitowane modele a_bags.handmade.",
  manifest: "/manifest.webmanifest",
  other: {
    "codex-preview": "development",
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
      <body className={`${display.variable} ${sans.variable}`}>
        <PaymentMethodEnhancer />
        <ProductPreviewEnhancer />
        <VatDisplayEnhancer />
        {children}
      </body>
    </html>
  );
}
