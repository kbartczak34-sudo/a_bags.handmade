"use client";

import { useEffect, useState } from "react";
import {
  defaultSiteContent,
  type SiteContentPayload,
} from "../lib/site-content-shared";

export type PublicContact = {
  email: string;
  whatsappNumber: string;
  facebookUrl: string;
  instagramUrl: string;
  instagramHandle: string;
};

const fallbackContact: PublicContact = {
  email: defaultSiteContent.contact.email,
  whatsappNumber: defaultSiteContent.contact.whatsappNumber,
  facebookUrl: defaultSiteContent.contact.facebookUrl,
  instagramUrl: defaultSiteContent.instagram.profileUrl,
  instagramHandle: defaultSiteContent.instagram.handle,
};

export function whatsappHref(number: string, message?: string) {
  const digits = number.replace(/\D/g, "") || fallbackContact.whatsappNumber;
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function usePublicContact() {
  const [contact, setContact] = useState<PublicContact>(fallbackContact);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/site-content", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("contact unavailable");
        return (await response.json()) as SiteContentPayload;
      })
      .then((payload) => {
        setContact({
          email: payload.content.contact.email,
          whatsappNumber: payload.content.contact.whatsappNumber,
          facebookUrl: payload.content.contact.facebookUrl,
          instagramUrl: payload.content.instagram.profileUrl,
          instagramHandle: payload.content.instagram.handle,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) setContact(fallbackContact);
      });

    return () => controller.abort();
  }, []);

  return contact;
}
