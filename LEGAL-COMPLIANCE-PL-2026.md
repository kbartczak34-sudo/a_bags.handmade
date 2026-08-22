# A-Bags Handmade — Legal & Compliance PL 2026

Status: implementation branch `legal-compliance-pl-2026`

This document tracks the non-code and configuration work required before enabling B2C sales in Poland. The application intentionally fails closed at `/api/checkout` until the core legal identity, VAT mode and durable order-confirmation channel are configured.

## 1. Required Cloudflare runtime values

Set the following Worker secrets/variables with verified real-world data. Do not commit a private home address, phone number or API keys to Git.

```text
LEGAL_BUSINESS_MODE=jdg | unregistered
LEGAL_SELLER_NAME=<legal name of the seller>
LEGAL_SELLER_ADDRESS=<postal business/contact address disclosed to consumers>
LEGAL_SELLER_EMAIL=a_bags.handmade@outlook.com
LEGAL_SELLER_PHONE=<consumer contact phone>
LEGAL_SELLER_NIP=<required for JDG; verify tax status before publishing>
LEGAL_SELLER_REGON=<optional where applicable>
LEGAL_RETURNS_ADDRESS=<postal address for returns/complaints; falls back to seller address>

LEGAL_VAT_MODE=active_23 | exempt

LEGAL_MANUFACTURER_NAME=<GPSR manufacturer name; may equal seller>
LEGAL_MANUFACTURER_ADDRESS=<GPSR postal address>
LEGAL_MANUFACTURER_EMAIL=<GPSR electronic address>

RESEND_API_KEY=<secret>
ORDER_EMAIL_FROM=<verified sender, e.g. a_bags.handmade <zamowienia@abagshandmade.pl>>
STRIPE_WEBHOOK_SECRET=<secret>
STRIPE_SECRET_KEY=<secret>
```

### VAT warning

Do not select `active_23` merely because the application previously displayed 23% VAT. Confirm the real seller's VAT status first. With `active_23`, values stored in the product editor are treated as net amounts and the storefront calculates 23% VAT. With `exempt`, the stored price is treated as the final consumer price and VAT is not added.

## 2. Public legal pages implemented

- `/regulamin`
- `/polityka-prywatnosci`
- `/cookies`
- `/zwroty-i-reklamacje`
- `/bezpieczenstwo-produktow`

The storefront compliance enhancer adds links to these documents, a required acknowledgement of the terms/withdrawal information in checkout, review-verification disclosure, product safety/manufacturer information and privacy controls for Instagram embeds.

## 3. Product safety / GPSR — work outside the codebase

Before a model is sold, create and retain a product file containing at least:

- model name and internal ID;
- product/lot/serial traceability convention (recommended pattern: `AB-MODEL-YYYY-NNN`);
- photos/drawings of the final product;
- list of real materials and components;
- suppliers and available declarations/specifications for materials;
- analysis of reasonably foreseeable hazards;
- assessment of handles, straps, fasteners, decorative parts and possible sharp/detachable elements;
- safe-use and care instructions;
- warnings actually justified by the assessment;
- record of corrective actions, complaints and safety incidents.

Do not add CE marking to an ordinary handbag unless a separate applicable EU product regime actually requires CE for the specific product.

## 4. Packaging / BDO / PPWR

Before shipping the first commercial order:

1. Determine whether the seller is an entity introducing packaged products and requires BDO registration.
2. Identify packaging materials used for fulfilment (box, paper, filler, tape, bags, labels, etc.).
3. Establish a method for recording packaging mass and completing applicable reporting/producer-responsibility duties.
4. Obtain packaging specifications/declarations from suppliers appropriate to the PPWR requirements applicable from 12 August 2026 and later transition dates.
5. Keep supplier evidence with the compliance records.

This cannot be completed by application code because it depends on the physical packaging and the legal entity placing it on the market.

## 5. Consumer-law operations

Before launch, document the internal handling process for:

- 14-day withdrawal requests where the statutory right applies;
- personalised/non-prefabricated products — use the exception only where the item is genuinely made to the consumer's individual specification;
- returns received and refunds;
- complaints for lack of conformity with the contract;
- 14-day complaint-response deadline;
- preserving the version of terms/information applicable to a given order;
- price-reduction history before using promotional communications.

## 6. Reviews

The current public review form is not linked to an order ID. The UI therefore labels submitted reviews as purchases that are **not verified**. Do not market these as "verified customer reviews" until a verified-order token/link mechanism is implemented.

Future preferred flow:

`paid order -> one-time review token -> review -> verified purchase badge`

## 7. Privacy / processors

Create/retain the appropriate controller/processor records and contractual documentation for the providers actually used, including as applicable:

- Stripe;
- Cloudflare;
- Resend / transactional email provider;
- courier / fulfilment provider;
- accounting/tax provider;
- any analytics or advertising service introduced later.

Do not add optional analytics/marketing trackers without updating the privacy/cookie documentation and consent mechanism.

## 8. Transactional order confirmation

Paid Stripe events call `sendOrderConfirmationEmail`. The email contains seller identity, order number, amount, payment status, withdrawal summary, return address and links to legal documents. Resend is called with an idempotency key based on the Stripe Checkout Session ID.

Checkout remains blocked while `RESEND_API_KEY`, `ORDER_EMAIL_FROM` or `STRIPE_WEBHOOK_SECRET` are absent.

## 9. Accessibility

Regardless of whether the seller qualifies for the microenterprise exception under the Polish Accessibility Act, target WCAG 2.2 AA as a quality baseline. Test at minimum:

- keyboard-only purchase path;
- focus visibility and focus trapping in modals;
- accessible names and errors;
- contrast;
- 200–400% zoom/reflow;
- screen-reader checkout flow;
- legal-document readability;
- privacy controls without pointer use.

## 10. Fiscal/tax items to confirm with accounting

Before launch confirm the exact seller-specific treatment of:

- business registration vs. unregistered activity;
- VAT exemption/registration and the date from which it applies;
- cash-register exemption or obligation for the actual payment/delivery model;
- invoices and KSeF obligations applicable to B2B invoices;
- income-tax records;
- BDO/packaging reporting.

The code must reflect the confirmed tax position; it must not be used to choose the tax position.

## 11. Source-code licensing

The repository currently contains a GNU GPL v3 `LICENSE`. GPL permits commercial use, but distribution of covered software has copyleft/source obligations. Before presenting the codebase as exclusive proprietary IP, verify:

- who owns copyright in every material part of the code;
- whether GPL v3 was intentionally selected for this entire repository;
- whether any copies have already been conveyed under GPL;
- licences of all third-party dependencies/assets;
- whether the future commercial strategy requires retaining GPL, dual licensing or another lawful licensing arrangement.

Do not simply delete or replace the licence until ownership and prior licensing history have been established.

## 12. Go-live gate

`GO` requires all of the following:

- [ ] seller legal identity configured and verified;
- [ ] business mode confirmed;
- [ ] VAT mode confirmed;
- [ ] manufacturer/GPSR identity configured;
- [ ] return/complaint address configured;
- [ ] Stripe live key and signed webhook configured;
- [ ] transactional email configured and tested;
- [ ] legal pages reviewed with actual seller data;
- [ ] test order confirms the same price/delivery in storefront and Stripe;
- [ ] withdrawal/complaint operational process ready;
- [ ] GPSR risk file prepared for every product model offered;
- [ ] BDO/packaging position confirmed;
- [ ] privacy processor records/contracts checked;
- [ ] accessibility smoke test passed;
- [ ] build, lint and automated tests pass;
- [ ] production test payment and refund path pass.

Until these items are satisfied, production checkout should remain fail-closed.
