import type { MetadataRoute } from "next";

const base = "https://abagshandmade.pl";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "/",
    "/regulamin",
    "/polityka-prywatnosci",
    "/cookies",
    "/zwroty-i-reklamacje",
    "/bezpieczenstwo-produktow",
  ];

  return routes.map((route, index) => ({
    url: `${base}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : index === 1 ? 0.6 : 0.5,
  }));
}
