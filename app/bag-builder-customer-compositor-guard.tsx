"use client";

import { useEffect } from "react";

const VIEW_CONTROL_PROPERTIES: Record<string, string> = {
  position: "absolute",
  top: "8px",
  right: "8px",
  bottom: "auto",
  left: "auto",
  width: "max-content",
  "min-width": "0",
  "max-width": "calc(100% - 16px)",
  height: "35px",
  "min-height": "35px",
  "max-height": "35px",
  display: "flex",
  "flex-direction": "row",
  "flex-wrap": "nowrap",
  "align-items": "center",
  "justify-content": "flex-end",
  gap: "2px",
  padding: "2px",
  transform: "none",
  overflow: "hidden",
  "z-index": "150",
};

const VIEW_BUTTON_PROPERTIES: Record<string, string> = {
  flex: "0 0 auto",
  "min-width": "37px",
  width: "auto",
  height: "29px",
  "min-height": "29px",
  "max-height": "29px",
  padding: "0 6px",
  margin: "0",
};

const ZOOM_PROPERTIES: Record<string, string> = {
  position: "absolute",
  top: "auto",
  right: "8px",
  bottom: "8px",
  left: "auto",
  width: "184px",
  "min-width": "0",
  "max-width": "calc(100% - 16px)",
  height: "38px",
  "min-height": "38px",
  "max-height": "38px",
  display: "grid",
  "grid-template-columns": "28px minmax(48px,1fr) 28px 42px",
  "align-items": "center",
  gap: "3px",
  padding: "3px 4px",
  transform: "none",
  overflow: "hidden",
  "z-index": "150",
};

const ZOOM_BUTTON_PROPERTIES: Record<string, string> = {
  "min-width": "0",
  width: "100%",
  height: "28px",
  "min-height": "28px",
  "max-height": "28px",
  padding: "0 4px",
  margin: "0",
};

function setImportant(element: HTMLElement, properties: Record<string, string>) {
  Object.entries(properties).forEach(([property, value]) => {
    if (element.style.getPropertyValue(property) === value && element.style.getPropertyPriority(property) === "important") return;
    element.style.setProperty(property, value, "important");
  });
}

function clearProperties(element: HTMLElement | null, properties: Record<string, string>) {
  if (!element) return;
  Object.keys(properties).forEach((property) => element.style.removeProperty(property));
}

function isCustomerRealtime(dialog: HTMLElement, stage: HTMLElement) {
  return dialog.dataset.abagsPhotoTrue !== "active" && stage.dataset.abagsPhotoTrue !== "active";
}

function enforce(dialog: HTMLElement) {
  const stage = dialog.querySelector<HTMLElement>(".abags-bag-builder-stage");
  if (!stage || !isCustomerRealtime(dialog, stage) || stage.dataset.abagsFinal3d !== "ready") return;

  const viewControls = stage.querySelector<HTMLElement>(".abags-pro3d-view-controls");
  const zoom = stage.querySelector<HTMLElement>(".abags-pro3d-zoom");
  if (!viewControls || !zoom) return;

  setImportant(viewControls, VIEW_CONTROL_PROPERTIES);
  viewControls.querySelectorAll<HTMLElement>("button").forEach((button) => setImportant(button, VIEW_BUTTON_PROPERTIES));

  setImportant(zoom, ZOOM_PROPERTIES);
  zoom.querySelectorAll<HTMLElement>("button").forEach((button) => setImportant(button, ZOOM_BUTTON_PROPERTIES));
  const zoomRange = zoom.querySelector<HTMLInputElement>('input[type="range"]');
  if (zoomRange) {
    zoomRange.style.setProperty("min-width", "0", "important");
    zoomRange.style.setProperty("width", "100%", "important");
    zoomRange.style.setProperty("height", "28px", "important");
    zoomRange.style.setProperty("margin", "0", "important");
  }

  stage.dataset.abagsCustomerCompositorGuard = "v1";
}

function clearStage(stage: HTMLElement) {
  const viewControls = stage.querySelector<HTMLElement>(".abags-pro3d-view-controls");
  const zoom = stage.querySelector<HTMLElement>(".abags-pro3d-zoom");
  clearProperties(viewControls, VIEW_CONTROL_PROPERTIES);
  viewControls?.querySelectorAll<HTMLElement>("button").forEach((button) => clearProperties(button, VIEW_BUTTON_PROPERTIES));
  clearProperties(zoom, ZOOM_PROPERTIES);
  zoom?.querySelectorAll<HTMLElement>("button").forEach((button) => clearProperties(button, ZOOM_BUTTON_PROPERTIES));
  const zoomRange = zoom?.querySelector<HTMLInputElement>('input[type="range"]');
  if (zoomRange) {
    for (const property of ["min-width", "width", "height", "margin"]) zoomRange.style.removeProperty(property);
  }
  delete stage.dataset.abagsCustomerCompositorGuard;
}

export default function BagBuilderCustomerCompositorGuard() {
  useEffect(() => {
    let frame = 0;

    const apply = () => {
      frame = 0;
      if (window.matchMedia("(max-width: 980px)").matches) {
        document.querySelectorAll<HTMLElement>(".abags-vc-dialog.abags-reference-layout-v4").forEach(enforce);
      }
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        apply();
        window.requestAnimationFrame(apply);
      });
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-abags-final3d", "data-abags-photo-true"],
    });
    window.addEventListener("resize", schedule);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
      document.querySelectorAll<HTMLElement>(".abags-bag-builder-stage[data-abags-customer-compositor-guard]").forEach(clearStage);
    };
  }, []);

  return null;
}
