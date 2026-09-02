# Visual Customizer 2.0 — production hardening

This pass keeps the deployed product visuals and checkout behavior intact while tightening runtime correctness and accessibility.

- Product-specific layer manifests are associated with the product that produced them, so stale layers cannot appear after a rapid model change.
- The customizer no longer needs a `react-hooks/set-state-in-effect` lint exception.
- The modal uses its own `abags-vc-open` scroll lock instead of the shared `modal-open` class used by other storefront UI.
- Keyboard focus is moved into the dialog, trapped while it is open, and restored to the triggering control when it closes.
- Escape closes the customizer.
- Stripe/BLIK checkout and Cloudflare bindings are unchanged.
