import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/panel", "/panel/", "/site-admin", "/site-admin/", "/api/admin/"],
      },
    ],
    sitemap: "https://abagshandmade.pl/sitemap.xml",
    host: "https://abagshandmade.pl",
  };
}
