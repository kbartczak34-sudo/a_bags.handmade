# Customizer production QA checklist

- [x] Base product image remains untouched.
- [x] Only assets belonging to the selected product are eligible for overlay rendering.
- [x] Product switch invalidates the previous manifest immediately through derived readiness state.
- [x] Missing variants leave the base product unchanged.
- [x] No invented personalization surcharges are displayed.
- [x] Dialog has Escape support.
- [x] Dialog traps keyboard focus.
- [x] Focus returns to the trigger on close.
- [x] Customizer uses a dedicated scroll-lock class.
- [x] Stripe/BLIK checkout code is not modified by this pass.
- [x] Cloudflare D1/R2 bindings are not modified by this pass.
