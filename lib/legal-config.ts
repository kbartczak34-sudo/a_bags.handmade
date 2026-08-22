import { standardShippingAmount } from "./catalog";
import { getRuntimeBindings } from "./runtime-env";

export type BusinessMode = "jdg" | "unregistered" | "unknown";
export type VatMode = "active_23" | "exempt" | "unknown";

export type PublicLegalConfig = {
  brand: string;
  businessMode: BusinessMode;
  vatMode: VatMode;
  vatLabel: string;
  shippingAmount: number;
  transactionalEmailReady: boolean;
  seller: {
    legalName: string;
    address: string;
    email: string;
    phone: string;
    nip: string;
    regon: string;
    returnsAddress: string;
  };
  manufacturer: {
    name: string;
    address: string;
    email: string;
  };
  launchReady: boolean;
  readinessIssues: string[];
};

const BRAND = "a_bags.handmade";
const DEFAULT_EMAIL = "a_bags.handmade@outlook.com";

function clean(value: string | undefined) {
  return (value ?? "").trim();
}

function readBusinessMode(value: string | undefined): BusinessMode {
  return value === "jdg" || value === "unregistered" ? value : "unknown";
}

function readVatMode(value: string | undefined): VatMode {
  return value === "active_23" || value === "exempt" ? value : "unknown";
}

function confirmed(value: string | undefined) {
  return clean(value).toLowerCase() === "true";
}

export function getPublicLegalConfig(): PublicLegalConfig {
  const env = getRuntimeBindings();

  const businessMode = readBusinessMode(clean(env.LEGAL_BUSINESS_MODE));
  const vatMode = readVatMode(clean(env.LEGAL_VAT_MODE));
  const transactionalEmailReady =
    Boolean(clean(env.RESEND_API_KEY)) &&
    Boolean(clean(env.ORDER_EMAIL_FROM)) &&
    Boolean(clean(env.STRIPE_WEBHOOK_SECRET));

  const seller = {
    legalName: clean(env.LEGAL_SELLER_NAME),
    address: clean(env.LEGAL_SELLER_ADDRESS),
    email: clean(env.LEGAL_SELLER_EMAIL) || DEFAULT_EMAIL,
    phone: clean(env.LEGAL_SELLER_PHONE),
    nip: clean(env.LEGAL_SELLER_NIP),
    regon: clean(env.LEGAL_SELLER_REGON),
    returnsAddress:
      clean(env.LEGAL_RETURNS_ADDRESS) || clean(env.LEGAL_SELLER_ADDRESS),
  };

  const manufacturer = {
    name: clean(env.LEGAL_MANUFACTURER_NAME) || seller.legalName,
    address: clean(env.LEGAL_MANUFACTURER_ADDRESS) || seller.address,
    email: clean(env.LEGAL_MANUFACTURER_EMAIL) || seller.email,
  };

  const readinessIssues: string[] = [];

  if (businessMode === "unknown") {
    readinessIssues.push(
      "Ustaw LEGAL_BUSINESS_MODE na 'jdg' albo 'unregistered'.",
    );
  }
  if (!seller.legalName) readinessIssues.push("Uzupełnij LEGAL_SELLER_NAME.");
  if (!seller.address) readinessIssues.push("Uzupełnij LEGAL_SELLER_ADDRESS.");
  if (!seller.email) readinessIssues.push("Uzupełnij LEGAL_SELLER_EMAIL.");
  if (!seller.phone) readinessIssues.push("Uzupełnij LEGAL_SELLER_PHONE.");
  if (!seller.returnsAddress) {
    readinessIssues.push("Uzupełnij LEGAL_RETURNS_ADDRESS.");
  }
  if (businessMode === "jdg" && !seller.nip) {
    readinessIssues.push("Dla JDG uzupełnij LEGAL_SELLER_NIP.");
  }
  if (vatMode === "unknown") {
    readinessIssues.push(
      "Ustaw LEGAL_VAT_MODE na 'active_23' albo 'exempt' po potwierdzeniu statusu podatkowego.",
    );
  }
  if (!manufacturer.name) {
    readinessIssues.push("Uzupełnij LEGAL_MANUFACTURER_NAME.");
  }
  if (!manufacturer.address) {
    readinessIssues.push("Uzupełnij LEGAL_MANUFACTURER_ADDRESS.");
  }
  if (!manufacturer.email) {
    readinessIssues.push("Uzupełnij LEGAL_MANUFACTURER_EMAIL.");
  }
  if (!transactionalEmailReady) {
    readinessIssues.push(
      "Skonfiguruj RESEND_API_KEY, ORDER_EMAIL_FROM i STRIPE_WEBHOOK_SECRET dla potwierdzeń zamówienia na trwałym nośniku.",
    );
  }

  if (!confirmed(env.LEGAL_PRODUCT_COMPLIANCE_CONFIRMED)) {
    readinessIssues.push(
      "Potwierdź dokumentację i zgodność produktów (GPSR/REACH oraz właściwe oznaczenia) przez LEGAL_PRODUCT_COMPLIANCE_CONFIRMED=true.",
    );
  }
  if (!confirmed(env.LEGAL_PACKAGING_COMPLIANCE_CONFIRMED)) {
    readinessIssues.push(
      "Potwierdź obowiązki BDO/opakowania/PPWR przez LEGAL_PACKAGING_COMPLIANCE_CONFIRMED=true.",
    );
  }
  if (!confirmed(env.LEGAL_FISCAL_COMPLIANCE_CONFIRMED)) {
    readinessIssues.push(
      "Potwierdź sposób dokumentowania sprzedaży, kasę fiskalną/KSeF i rozliczenia przez LEGAL_FISCAL_COMPLIANCE_CONFIRMED=true.",
    );
  }
  if (!confirmed(env.LEGAL_PRIVACY_COMPLIANCE_CONFIRMED)) {
    readinessIssues.push(
      "Potwierdź rzeczywisty rejestr dostawców, role RODO i dokumentację prywatności przez LEGAL_PRIVACY_COMPLIANCE_CONFIRMED=true.",
    );
  }

  const vatLabel =
    vatMode === "active_23"
      ? "cena brutto · zawiera VAT 23%"
      : vatMode === "exempt"
        ? "cena dla konsumenta · sprzedaż bez doliczania VAT"
        : "cena dla konsumenta · status VAT wymaga konfiguracji";

  return {
    brand: BRAND,
    businessMode,
    vatMode,
    vatLabel,
    shippingAmount: standardShippingAmount,
    transactionalEmailReady,
    seller,
    manufacturer,
    launchReady: readinessIssues.length === 0,
    readinessIssues,
  };
}
