"use client";

import { useEffect } from "react";

const FAMILY_SELECTOR = '[data-photo-true-family-group="true"]';
const MOUNT_SELECTOR = ':scope > .abags-photo-models-mount';
const OPTIONS_SELECTOR = ':scope > .abags-builder-options';

function collapseLegacyOptions(options: HTMLElement) {
  options.dataset.photoTrueLegacyFamilyOptions = "collapsed";
  options.hidden = true;
  options.setAttribute("aria-hidden", "true");
  options.style.setProperty("display", "none", "important");
  options.style.setProperty("visibility", "hidden", "important");
  options.style.setProperty("position", "static", "important");
  options.style.setProperty("width", "0", "important");
  options.style.setProperty("height", "0", "important");
  options.style.setProperty("min-height", "0", "important");
  options.style.setProperty("max-height", "0", "important");
  options.style.setProperty("margin", "0", "important");
  options.style.setProperty("padding", "0", "important");
  options.style.setProperty("gap", "0", "important");
  options.style.setProperty("overflow", "hidden", "important");
}

function restoreLegacyOptions(options: HTMLElement) {
  delete options.dataset.photoTrueLegacyFamilyOptions;
  options.hidden = false;
  options.removeAttribute("aria-hidden");
  for (const property of ["display", "visibility", "position", "width", "height", "min-height", "max-height", "margin", "padding", "gap", "overflow"]) {
    options.style.removeProperty(property);
  }
}

function enforcePhotoTrueFamilyFlow() {
  const dialog = document.querySelector<HTMLElement>('.abags-vc-dialog.abags-reference-layout-v4[data-abags-photo-true="active"]');
  const family = dialog?.querySelector<HTMLElement>(FAMILY_SELECTOR) ?? null;
  const mount = family?.querySelector<HTMLElement>(MOUNT_SELECTOR) ?? null;
  const options = family?.querySelector<HTMLElement>(OPTIONS_SELECTOR) ?? null;
  if (!family || !mount || !options) return;

  // The Photo-True model grid is the customer-facing Fason control. Keep it immediately
  // before the hidden legacy family bridge so fieldset/legend layout cannot reserve a gap.
  if (mount.nextElementSibling !== options) family.insertBefore(mount, options);
  collapseLegacyOptions(options);
  family.dataset.photoTrueFlow = "locked";
}

export default function BagBuilderPhotoTrueFlowGuard() {
  useEffect(() => {
    let frame = 0;
    const requestSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        enforcePhotoTrueFamilyFlow();
      });
    };

    requestSync();
    const observer = new MutationObserver(requestSync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-abags-photo-true", "data-photo-true-family-group", "class"],
    });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      document.querySelectorAll<HTMLElement>('[data-photo-true-legacy-family-options="collapsed"]').forEach(restoreLegacyOptions);
      document.querySelectorAll<HTMLElement>(FAMILY_SELECTOR).forEach((family) => delete family.dataset.photoTrueFlow);
    };
  }, []);

  return null;
}
