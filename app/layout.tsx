import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import AccessibilityClient from "./accessibility-client";
import ExactLiveCustomizer from "./exact-live-customizer";
import LegalComplianceEnhancer from "./legal-compliance-enhancer";
import PaymentMethodEnhancer from "./payment-method-enhancer";
import PersonalizationEntry from "./personalization-entry";
import PrivacyConsentBanner from "./privacy-consent-banner";
import ProductComplianceEnhancer from "./product-compliance-enhancer";
import ProductPreviewEnhancer from "./product-preview-enhancer";
import StitchGallery from "./stitch-gallery";
import StorefrontExperience from "./storefront-experience";
import SocialQuickLinks from "./social-quick-links";
import VatDisplayEnhancer from "./vat-display-enhancer";
import "./globals.css";
import "./footer-overrides.css";
import "./legal-compliance.css";
import "./production-polish.css";
import "./storefront-experience.css";
import "./personalization-entry.css";
import "./visual-customizer-polish.css";
import "./exact-live-customizer.css";
import "./bag-builder-engine.css";
import "./photoreal-bag-builder.css";
import "./bag-builder-v6.css";
import "./atelier-bag-renderer-v7.css";
import "./bag-builder-v8-2d.css";
import "./bag-builder-webgl3d.css";
import "./bag-builder-real3d.css";
import "./bag-builder-3d-enhancer.css";
import "./bag-builder-pro3d.css";
import "./bag-builder-canvas3d.css";
import "./bag-builder-material-pass.css";
import "./bag-builder-construction-pass.css";
import "./bag-builder-commerce.css";
import "./bag-builder-admin.css";
import "./customizer-admin.css";
import "./bag-builder-reference-ui.css";
import "./bag-builder-reference-ui-fixes.css";
import "./bag-builder-reference-experience.css";
import "./bag-builder-atelier3d.css";

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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#2b2023" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "a_bags.handmade",
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
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "a_bags",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
    apple: [{ url: "/favicon.svg", type: "image/svg+xml" }],
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
        <PrivacyConsentBanner />
        <LegalComplianceEnhancer />
        <PaymentMethodEnhancer />
        <ProductPreviewEnhancer />
        <ProductComplianceEnhancer />
        <VatDisplayEnhancer />
        <StitchGallery />
        <StorefrontExperience />
        <PersonalizationEntry />
        <ExactLiveCustomizer />
        {children}
        <SocialQuickLinks />
        <AccessibilityClient />
      </body>
    </html>
  );
}
