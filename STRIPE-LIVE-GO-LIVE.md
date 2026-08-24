# Stripe live go-live — A-Bags Handmade

Production checkout is intentionally fail-closed until both the Stripe account and webhook are confirmed for live mode.

## Required production state

1. `STRIPE_SECRET_KEY` must be a Stripe live secret/restricted key (`sk_live_...` or `rk_live_...`).
2. `STRIPE_WEBHOOK_SECRET` must be the signing secret of the **live-mode** webhook endpoint for:
   - `https://abagshandmade.pl/api/stripe/webhook`
3. The live webhook must subscribe to the events handled by the application:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
   - `charge.refunded`
4. Only after the live endpoint has been created and verified, set:
   - `STRIPE_LIVE_WEBHOOK_CONFIRMED=true`

Never commit Stripe keys or webhook signing secrets to the repository.

## Fail-closed behavior

On `abagshandmade.pl` and `www.abagshandmade.pl`:

- a missing/test/unknown Stripe key blocks checkout with `stripe_live_required`;
- a live Stripe key without a configured and explicitly confirmed live webhook blocks checkout with `stripe_live_webhook_required`;
- the owner `Status sklepu` view displays the Stripe key mode and whether the live webhook confirmation is present.

Local/non-production hosts may continue to use Stripe test mode for QA.

## Before enabling the confirmation flag

Complete one controlled live-mode verification of the Stripe configuration and confirm the webhook endpoint and signing secret belong to the live account. After the flag is enabled, perform a low-value production checkout and verify the complete chain: Checkout → payment event → signed webhook → D1 order state → transactional confirmation email. Refund handling must be verified before public launch: a Stripe refund should emit `charge.refunded`, update the matching D1 order through its PaymentIntent ID, and appear as a partial or full refund in the owner panel.
