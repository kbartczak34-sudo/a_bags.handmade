import { getRuntimeBindings } from "./runtime-env";
import {
  defaultSiteContent,
  type BenefitItem,
  type SiteContent,
  type SiteContentPayload,
} from "./site-content-shared";

type StoredSiteContent = {
  content: SiteContent;
  heroImageKey: string | null;
  heroImageContentType: string | null;
  updatedAt: string;
};

const SITE_CONTENT_KEY = "site_content_v1";
const FALLBACK_HERO_IMAGE = "/images/limitowana-kolekcja.jpg";
const createSettingsSql = `
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  )
`;

let readyPromise: Promise<void> | null = null;

function getDb() {
  const db = getRuntimeBindings().DB;
  if (!db) throw new Error("Brak połączenia z ustawieniami strony.");
  return db;
}

export function getSiteContentBucket() {
  const bucket = getRuntimeBindings().BUCKET;
  if (!bucket) throw new Error("Brak magazynu zdjęć strony.");
  return bucket;
}

async function ensureSettingsReady() {
  readyPromise ??= getDb().prepare(createSettingsSql).run().then(() => undefined);
  try {
    await readyPromise;
  } catch (error) {
    readyPromise = null;
    throw error;
  }
}

function readText(
  value: unknown,
  fallback: string,
  maxLength: number,
): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  if (!normalized) return fallback;
  return normalized.slice(0, maxLength);
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readColor(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value.toLowerCase()
    : fallback;
}

function readEmail(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 180
    ? email
    : fallback;
}

function readWhatsAppNumber(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : fallback;
}

function readSocialUrl(
  value: unknown,
  fallback: string,
  allowedHosts: readonly string[],
) {
  if (typeof value !== "string" || value.length > 300) return fallback;
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || !allowedHosts.includes(hostname)) {
      return fallback;
    }
    return url.toString();
  } catch {
    return fallback;
  }
}

function readBenefit(value: unknown, fallback: BenefitItem): BenefitItem {
  const item = value && typeof value === "object" ? value as Partial<BenefitItem> : {};
  return {
    title: readText(item.title, fallback.title, 90),
    description: readText(item.description, fallback.description, 260),
  };
}

export function normalizeSiteContent(value: unknown): SiteContent {
  const source = value && typeof value === "object" ? value as Partial<SiteContent> : {};
  const announcement = source.announcement ?? {} as SiteContent["announcement"];
  const brand = source.brand ?? {} as SiteContent["brand"];
  const navigation = source.navigation ?? {} as SiteContent["navigation"];
  const hero = source.hero ?? {} as SiteContent["hero"];
  const collection = source.collection ?? {} as SiteContent["collection"];
  const story = source.story ?? {} as SiteContent["story"];
  const benefits = source.benefits ?? {} as SiteContent["benefits"];
  const reviews = source.reviews ?? {} as SiteContent["reviews"];
  const instagram = source.instagram ?? {} as SiteContent["instagram"];
  const contact = source.contact ?? {} as SiteContent["contact"];
  const footer = source.footer ?? {} as SiteContent["footer"];
  const theme = source.theme ?? {} as SiteContent["theme"];
  const defaultBenefits = defaultSiteContent.benefits.items;
  const sourceBenefits = Array.isArray(benefits.items) ? benefits.items : [];

  const normalized: SiteContent = {
    announcement: {
      visible: readBoolean(announcement.visible, defaultSiteContent.announcement.visible),
      primary: readText(announcement.primary, defaultSiteContent.announcement.primary, 140),
      secondary: readText(announcement.secondary, defaultSiteContent.announcement.secondary, 140),
    },
    brand: {
      name: readText(brand.name, defaultSiteContent.brand.name, 40),
      descriptor: readText(brand.descriptor, defaultSiteContent.brand.descriptor, 40),
    },
    navigation: {
      collection: readText(navigation.collection, defaultSiteContent.navigation.collection, 40),
      story: readText(navigation.story, defaultSiteContent.navigation.story, 40),
      reviews: readText(navigation.reviews, defaultSiteContent.navigation.reviews, 40),
      contact: readText(navigation.contact, defaultSiteContent.navigation.contact, 40),
      cart: readText(navigation.cart, defaultSiteContent.navigation.cart, 40),
    },
    hero: {
      badge: readText(hero.badge, defaultSiteContent.hero.badge, 120),
      title: readText(hero.title, defaultSiteContent.hero.title, 110),
      accent: readText(hero.accent, defaultSiteContent.hero.accent, 110),
      lead: readText(hero.lead, defaultSiteContent.hero.lead, 500),
      primaryCta: readText(hero.primaryCta, defaultSiteContent.hero.primaryCta, 70),
      secondaryCta: readText(hero.secondaryCta, defaultSiteContent.hero.secondaryCta, 70),
      noteOne: readText(hero.noteOne, defaultSiteContent.hero.noteOne, 70),
      noteTwo: readText(hero.noteTwo, defaultSiteContent.hero.noteTwo, 70),
      noteThree: readText(hero.noteThree, defaultSiteContent.hero.noteThree, 70),
      imageAlt: readText(hero.imageAlt, defaultSiteContent.hero.imageAlt, 220),
      imageLabel: readText(hero.imageLabel, defaultSiteContent.hero.imageLabel, 70),
      imageSublabel: readText(hero.imageSublabel, defaultSiteContent.hero.imageSublabel, 70),
      imageCaption: readText(hero.imageCaption, defaultSiteContent.hero.imageCaption, 90),
    },
    collection: {
      eyebrow: readText(collection.eyebrow, defaultSiteContent.collection.eyebrow, 70),
      title: readText(collection.title, defaultSiteContent.collection.title, 140),
      noteLabel: readText(collection.noteLabel, defaultSiteContent.collection.noteLabel, 80),
      noteText: readText(collection.noteText, defaultSiteContent.collection.noteText, 360),
      emptyTitle: readText(collection.emptyTitle, defaultSiteContent.collection.emptyTitle, 120),
      emptyText: readText(collection.emptyText, defaultSiteContent.collection.emptyText, 260),
    },
    story: {
      visible: readBoolean(story.visible, defaultSiteContent.story.visible),
      eyebrow: readText(story.eyebrow, defaultSiteContent.story.eyebrow, 70),
      title: readText(story.title, defaultSiteContent.story.title, 140),
      description: readText(story.description, defaultSiteContent.story.description, 900),
      cta: readText(story.cta, defaultSiteContent.story.cta, 120),
    },
    benefits: {
      visible: readBoolean(benefits.visible, defaultSiteContent.benefits.visible),
      eyebrow: readText(benefits.eyebrow, defaultSiteContent.benefits.eyebrow, 70),
      title: readText(benefits.title, defaultSiteContent.benefits.title, 140),
      items: defaultBenefits.map((fallback, index) =>
        readBenefit(sourceBenefits[index], fallback),
      ),
    },
    reviews: {
      visible: readBoolean(reviews.visible, defaultSiteContent.reviews.visible),
      eyebrow: readText(reviews.eyebrow, defaultSiteContent.reviews.eyebrow, 70),
      title: readText(reviews.title, defaultSiteContent.reviews.title, 160),
      emptyText: readText(reviews.emptyText, defaultSiteContent.reviews.emptyText, 300),
      emptyBrand: readText(reviews.emptyBrand, defaultSiteContent.reviews.emptyBrand, 80),
      emptyLabel: readText(reviews.emptyLabel, defaultSiteContent.reviews.emptyLabel, 100),
      formEyebrow: readText(reviews.formEyebrow, defaultSiteContent.reviews.formEyebrow, 70),
      formTitle: readText(reviews.formTitle, defaultSiteContent.reviews.formTitle, 100),
      formDescription: readText(reviews.formDescription, defaultSiteContent.reviews.formDescription, 360),
    },
    instagram: {
      visible: readBoolean(instagram.visible, defaultSiteContent.instagram.visible),
      eyebrow: readText(instagram.eyebrow, defaultSiteContent.instagram.eyebrow, 70),
      title: readText(instagram.title, defaultSiteContent.instagram.title, 140),
      handle: readText(instagram.handle, defaultSiteContent.instagram.handle, 80),
      profileUrl: readSocialUrl(
        instagram.profileUrl,
        defaultSiteContent.instagram.profileUrl,
        ["instagram.com", "www.instagram.com"],
      ),
      feedNote: readText(instagram.feedNote, defaultSiteContent.instagram.feedNote, 240),
    },
    contact: {
      email: readEmail(contact.email, defaultSiteContent.contact.email),
      whatsappNumber: readWhatsAppNumber(
        contact.whatsappNumber,
        defaultSiteContent.contact.whatsappNumber,
      ),
      facebookUrl: readSocialUrl(
        contact.facebookUrl,
        defaultSiteContent.contact.facebookUrl,
        ["facebook.com", "www.facebook.com", "m.facebook.com"],
      ),
    },
    footer: {
      tagline: readText(footer.tagline, defaultSiteContent.footer.tagline, 260),
      shopLabel: readText(footer.shopLabel, defaultSiteContent.footer.shopLabel, 50),
      socialLabel: readText(footer.socialLabel, defaultSiteContent.footer.socialLabel, 50),
      collectionLink: readText(footer.collectionLink, defaultSiteContent.footer.collectionLink, 50),
      storyLink: readText(footer.storyLink, defaultSiteContent.footer.storyLink, 50),
      reviewsLink: readText(footer.reviewsLink, defaultSiteContent.footer.reviewsLink, 50),
      instagramLink: readText(footer.instagramLink, defaultSiteContent.footer.instagramLink, 50),
      emailLink: readText(footer.emailLink, defaultSiteContent.footer.emailLink, 50),
      copyright: readText(footer.copyright, defaultSiteContent.footer.copyright, 100),
      statusText: readText(footer.statusText, defaultSiteContent.footer.statusText, 160),
    },
    theme: {
      ink: readColor(theme.ink, defaultSiteContent.theme.ink),
      paper: readColor(theme.paper, defaultSiteContent.theme.paper),
      cream: readColor(theme.cream, defaultSiteContent.theme.cream),
      accent: readColor(theme.accent, defaultSiteContent.theme.accent),
      accentDark: readColor(theme.accentDark, defaultSiteContent.theme.accentDark),
      accentLight: readColor(theme.accentLight, defaultSiteContent.theme.accentLight),
    },
  };

  // Zastępujemy wyłącznie wcześniejsze teksty szablonowe. Treści zmienione
  // przez właścicielkę w panelu pozostają zawsze bez zmian.
  if (normalized.collection.noteLabel === "Aktualna kolekcja") {
    normalized.collection.noteLabel = defaultSiteContent.collection.noteLabel;
  }
  if (
    normalized.collection.noteText ===
    "Produkty, ceny i zdjęcia możesz teraz zmieniać samodzielnie w prywatnym panelu właścicielki."
  ) {
    normalized.collection.noteText = defaultSiteContent.collection.noteText;
  }
  if (
    normalized.story.description ===
    "a_bags.handmade to mała marka Agaty, w której sznurek, kolor i detal spotykają się w niepowtarzalnych torebkach. Każdy egzemplarz powstaje ręcznie — dlatego nie ma dwóch idealnie takich samych."
  ) {
    normalized.story.description = defaultSiteContent.story.description;
  }
  if (
    normalized.benefits.items[0]?.description ===
    "Każde oczko powstaje ręcznie w pracowni Agaty."
  ) {
    normalized.benefits.items[0].description =
      defaultSiteContent.benefits.items[0].description;
  }
  if (normalized.instagram.eyebrow === "Instagram inspiration") {
    normalized.instagram.eyebrow = defaultSiteContent.instagram.eyebrow;
  }
  if (
    normalized.footer.statusText === "Projekt w trakcie uzupełniania treści"
  ) {
    normalized.footer.statusText = defaultSiteContent.footer.statusText;
  }

  return normalized;
}

function defaultRecord(): StoredSiteContent {
  return {
    content: defaultSiteContent,
    heroImageKey: null,
    heroImageContentType: null,
    updatedAt: "default",
  };
}

async function readStoredContent(): Promise<StoredSiteContent> {
  await ensureSettingsReady();
  const row = await getDb()
    .prepare("SELECT value FROM app_settings WHERE key = ? LIMIT 1")
    .bind(SITE_CONTENT_KEY)
    .first<{ value: string }>();
  if (!row) return defaultRecord();

  try {
    const parsed = JSON.parse(row.value) as Partial<StoredSiteContent>;
    return {
      content: normalizeSiteContent(parsed.content),
      heroImageKey:
        typeof parsed.heroImageKey === "string" ? parsed.heroImageKey : null,
      heroImageContentType:
        typeof parsed.heroImageContentType === "string"
          ? parsed.heroImageContentType
          : null,
      updatedAt:
        typeof parsed.updatedAt === "string" ? parsed.updatedAt : "stored",
    };
  } catch {
    return defaultRecord();
  }
}

function toPayload(record: StoredSiteContent): SiteContentPayload {
  return {
    content: record.content,
    heroImageUrl: record.heroImageKey
      ? `/api/site-image?v=${encodeURIComponent(record.updatedAt)}`
      : FALLBACK_HERO_IMAGE,
  };
}

export async function getSiteContentPayload() {
  return toPayload(await readStoredContent());
}

export async function getSiteImageRecord() {
  const record = await readStoredContent();
  return {
    key: record.heroImageKey,
    contentType: record.heroImageContentType,
  };
}

export async function saveSiteContent(
  value: unknown,
  heroImage:
    | { key: string; contentType: string }
    | null
    | undefined,
) {
  const current = await readStoredContent();
  const updatedAt = new Date().toISOString();
  const next: StoredSiteContent = {
    content: normalizeSiteContent(value),
    heroImageKey:
      heroImage === undefined
        ? current.heroImageKey
        : heroImage?.key ?? null,
    heroImageContentType:
      heroImage === undefined
        ? current.heroImageContentType
        : heroImage?.contentType ?? null,
    updatedAt,
  };

  await getDb()
    .prepare(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .bind(SITE_CONTENT_KEY, JSON.stringify(next))
    .run();

  return {
    payload: toPayload(next),
    oldHeroImageKey: current.heroImageKey,
  };
}
