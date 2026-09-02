import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import AccessibilityClient from "./accessibility-client";
import LegalComplianceEnhancer from "./legal-compliance-enhancer";
import PaymentMethodEnhancer from "./payment-method-enhancer";
import PrivacyConsentBanner from "./privacy-consent-banner";
import ProductComplianceEnhancer from "./product-compliance-enhancer";
import ProductPreviewEnhancer from "./product-preview-enhancer";
import StitchGallery from "./stitch-gallery";
import VatDisplayEnhancer from "./vat-display-enhancer";
import "./globals.css";
import "./footer-overrides.css";
import "./legal-compliance.css";
import "./production-polish.css";

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

const socialLinks = [
  {
    label: "WhatsApp",
    href: "https://wa.me/48504510200",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.5 3.5A11.8 11.8 0 0 0 12.1 0C5.6 0 .3 5.3.3 11.8c0 2.1.6 4.1 1.6 5.9L.2 24l6.4-1.7a11.8 11.8 0 0 0 5.5 1.4h.1c6.5 0 11.8-5.3 11.8-11.8 0-3.2-1.2-6.1-3.5-8.4ZM12.2 21.7a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.8 1 1-3.7-.2-.4a9.8 9.8 0 1 1 8.4 4.7Zm5.4-7.4c-.3-.1-1.8-.9-2.1-1-.3-.1-.5-.1-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-1.7-.9-2.9-1.6-4.1-3.6-.3-.5.3-.5.9-1.7.1-.2 0-.4 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1.1 1.1-1.1 2.7s1.1 3.1 1.3 3.3c.2.2 2.3 3.5 5.5 4.9.8.3 1.4.5 1.9.6.8.2 1.5.2 2 .1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4Z" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/share/1EjHy8cmKG/",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13.6 24v-10h3.4l.5-3.9h-3.9V7.6c0-1.1.3-1.9 1.9-1.9h2.1V2.2c-.4 0-1.6-.2-3-.2-3 0-5.1 1.8-5.1 5.2v2.9H6v3.9h3.5v10h4.1Z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/a_bags.handmade/",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7.2 2h9.6A5.2 5.2 0 0 1 22 7.2v9.6a5.2 5.2 0 0 1-5.2 5.2H7.2A5.2 5.2 0 0 1 2 16.8V7.2A5.2 5.2 0 0 1 7.2 2Zm0 2A3.2 3.2 0 0 0 4 7.2v9.6A3.2 3.2 0 0 0 7.2 20h9.6a3.2 3.2 0 0 0 3.2-3.2V7.2A3.2 3.2 0 0 0 16.8 4H7.2Zm10.1 1.5a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
      </svg>
    ),
  },
] as const;

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
        {children}
        <nav className="social-quick-links" aria-label="a_bags.handmade w social media">
          {socialLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Otwórz ${link.label}`}
              title={link.label}
            >
              {link.icon}
              <span>{link.label}</span>
            </a>
          ))}
        </nav>
        <style>{`
          .social-quick-links {
            display: none;
          }
          body:has(#kontakt) .social-quick-links {
            position: fixed;
            right: max(16px, env(safe-area-inset-right));
            bottom: max(22px, env(safe-area-inset-bottom));
            z-index: 45;
            display: flex;
            gap: 9px;
            padding: 8px;
            border: 1px solid color-mix(in srgb, #5a4245 12%, transparent);
            border-radius: 999px;
            background: color-mix(in srgb, #fffaf8 90%, transparent);
            box-shadow: 0 16px 44px rgba(90, 66, 69, 0.16);
            backdrop-filter: blur(16px);
          }
          .social-quick-links a {
            width: 46px;
            height: 46px;
            display: grid;
            place-items: center;
            border-radius: 50%;
            color: #5a4245;
            background: #fbf6f2;
            text-decoration: none;
            transition: transform 180ms ease, background 180ms ease, color 180ms ease;
          }
          .social-quick-links a:hover {
            transform: translateY(-2px);
            color: #fffaf8;
            background: #b87880;
          }
          .social-quick-links a:focus-visible {
            outline: 3px solid rgba(184, 120, 128, 0.36);
            outline-offset: 3px;
          }
          .social-quick-links svg {
            width: 22px;
            height: 22px;
            fill: currentColor;
          }
          .social-quick-links span {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
          }
          @media (max-width: 520px) {
            body:has(#kontakt) .social-quick-links {
              right: max(10px, env(safe-area-inset-right));
              bottom: max(12px, env(safe-area-inset-bottom));
              gap: 5px;
              padding: 6px;
            }
            .social-quick-links a {
              width: 42px;
              height: 42px;
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .social-quick-links a {
              transition: none;
            }
          }
        `}</style>
        <AccessibilityClient />
      </body>
    </html>
  );
}
