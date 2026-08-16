export type BenefitItem = {
  title: string;
  description: string;
};

export type SiteContent = {
  announcement: {
    visible: boolean;
    primary: string;
    secondary: string;
  };
  brand: {
    name: string;
    descriptor: string;
  };
  navigation: {
    collection: string;
    story: string;
    reviews: string;
    contact: string;
    cart: string;
  };
  hero: {
    badge: string;
    title: string;
    accent: string;
    lead: string;
    primaryCta: string;
    secondaryCta: string;
    noteOne: string;
    noteTwo: string;
    noteThree: string;
    imageAlt: string;
    imageLabel: string;
    imageSublabel: string;
    imageCaption: string;
  };
  collection: {
    eyebrow: string;
    title: string;
    noteLabel: string;
    noteText: string;
    emptyTitle: string;
    emptyText: string;
  };
  story: {
    visible: boolean;
    eyebrow: string;
    title: string;
    description: string;
    cta: string;
  };
  benefits: {
    visible: boolean;
    eyebrow: string;
    title: string;
    items: BenefitItem[];
  };
  reviews: {
    visible: boolean;
    eyebrow: string;
    title: string;
    emptyText: string;
    emptyBrand: string;
    emptyLabel: string;
    formEyebrow: string;
    formTitle: string;
    formDescription: string;
  };
  instagram: {
    visible: boolean;
    eyebrow: string;
    title: string;
    handle: string;
    profileUrl: string;
    feedNote: string;
  };
  contact: {
    email: string;
  };
  footer: {
    tagline: string;
    shopLabel: string;
    socialLabel: string;
    collectionLink: string;
    storyLink: string;
    reviewsLink: string;
    instagramLink: string;
    emailLink: string;
    copyright: string;
    statusText: string;
  };
  theme: {
    ink: string;
    paper: string;
    cream: string;
    accent: string;
    accentDark: string;
    accentLight: string;
  };
};

export type SiteContentPayload = {
  content: SiteContent;
  heroImageUrl: string;
};

export const defaultSiteContent: SiteContent = {
  announcement: {
    visible: true,
    primary: "Darmowa dostawa od 300 zł",
    secondary: "Każda torebka tworzona ręcznie",
  },
  brand: {
    name: "a_bags",
    descriptor: "handmade",
  },
  navigation: {
    collection: "Bestsellery",
    story: "O marce",
    reviews: "Opinie",
    contact: "Kontakt",
    cart: "Koszyk",
  },
  hero: {
    badge: "✦ Rękodzieło w kobiecym wydaniu",
    title: "Ręcznie plecione",
    accent: "torebki premium.",
    lead:
      "Tworzone z pasją dla kobiet, które kochają wyjątkowy styl, subtelność i jakość. Każdy model powstaje ręcznie, oczko po oczku.",
    primaryCta: "Zobacz bestsellery",
    secondaryCta: "Poznaj historię marki",
    noteOne: "Polskie rękodzieło",
    noteTwo: "Limitowane modele",
    noteThree: "Bezpieczna płatność",
    imageAlt:
      "Różowa ręcznie pleciona torebka a_bags.handmade z kwiatową kokardą",
    imageLabel: "Limitowana kolekcja",
    imageSublabel: "ręcznie pleciona",
    imageCaption: "handmade · made with care",
  },
  collection: {
    eyebrow: "Bestsellery",
    title: "Najczęściej wybierane modele",
    noteLabel: "Małe serie",
    noteText:
      "Każdy model powstaje ręcznie w ograniczonej liczbie egzemplarzy. Wybierz torebkę, która najlepiej pasuje do Ciebie.",
    emptyTitle: "Kolekcja jest w przygotowaniu",
    emptyText:
      "Nowe ręcznie plecione modele pojawią się tutaj już wkrótce.",
  },
  story: {
    visible: true,
    eyebrow: "O marce",
    title: "Nie z taśmy. Z rąk i serca.",
    description:
      "a_bags.handmade to mała polska marka, w której sznurek, kolor i detal spotykają się w niepowtarzalnych torebkach. Każdy egzemplarz powstaje ręcznie — dlatego nie ma dwóch idealnie takich samych.",
    cta: "Porozmawiajmy o Twojej nowej torebce →",
  },
  benefits: {
    visible: true,
    eyebrow: "Dlaczego a_bags?",
    title: "Piękno, które czuć w detalach.",
    items: [
      {
        title: "100% handmade",
        description:
          "Każde oczko powstaje ręcznie w pracowni a_bags.handmade.",
      },
      {
        title: "Limitowane serie",
        description:
          "Małe kolekcje sprawiają, że każda torebka jest wyjątkowa.",
      },
      {
        title: "Pakowane z troską",
        description:
          "Starannie przygotowane — także jako prezent dla bliskiej osoby.",
      },
    ],
  },
  reviews: {
    visible: true,
    eyebrow: "Opinie klientek",
    title: "Wasze słowa będą tu najpiękniejszą ozdobą.",
    emptyText:
      "Pierwsze prawdziwe opinie klientek pojawią się tutaj już wkrótce.",
    emptyBrand: "a_bags.handmade",
    emptyLabel: "miejsce na Wasze słowa",
    formEyebrow: "Twoje doświadczenie",
    formTitle: "Zostaw swoją opinię",
    formDescription:
      "Napisz kilka słów o swojej torebce. Po akceptacji opinia pojawi się w tej sekcji.",
  },
  instagram: {
    visible: true,
    eyebrow: "Z pracowni na Instagram",
    title: "Zajrzyj za kulisy pracowni.",
    handle: "@a_bags.handmade",
    profileUrl: "https://www.instagram.com/a_bags.handmade/",
    feedNote: "Najnowsze publikacje z profilu aktualizują się automatycznie.",
  },
  contact: {
    email: "a_bags.handmade@outlook.com",
  },
  footer: {
    tagline: "Ręcznie plecione torebki, tworzone powoli i z uważnością.",
    shopLabel: "Sklep",
    socialLabel: "Znajdź nas",
    collectionLink: "Bestsellery",
    storyLink: "O marce",
    reviewsLink: "Opinie",
    instagramLink: "Instagram",
    emailLink: "E-mail",
    copyright: "Copyright 2026 a_bags.handmade",
    statusText: "Full-Stack/all-in-one Developer:\nKlaudia Weronika Bartczak\nAll rights reserved",
  },
  theme: {
    ink: "#5a4245",
    paper: "#fbf6f2",
    cream: "#fffaf8",
    accent: "#d6a3a7",
    accentDark: "#b87880",
    accentLight: "#f4dddf",
  },
};
