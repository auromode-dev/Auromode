# Auromode Auroville

Next.js 15, TypeScript, Tailwind CSS 4, Framer Motion, Supabase/PostgreSQL, and Razorpay. A responsive hospitality website with local photography and fonts, an enquiry-first preview, and integration code for live reservations.

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:3000. No credentials are needed to browse the site. Without live services, the booking flow prepares an email enquiry; it never claims a room has been reserved or a payment taken.

```sh
npm run typecheck
npm test
npm run build
npm start
```

`npx tsx tests/browser.ts` runs the browser checks against a running production server on port 3000 using installed Microsoft Edge. Screenshots are written to `artifacts/`.

## Implemented

- Editorial home page, manual hero photo carousel, campus cards, subtle motion, responsive navigation, and reduced-motion support.
- About, guesthouse, amenities, Hive Coworking, Tanto Restaurant, To Be Two, Auroville exploration, contact, and booking pages.
- French and Tamil welcome pages at `/fr` and `/ta`, with translated navigation and essential campus, stay, and contact information. Detailed pages, checkout, admin, and transactional messages remain English; the localized pages disclose this.
- Validated availability and booking endpoints; tax-inclusive INR prices are supplied by real room inventory, not the client.
- PostgreSQL exclusion constraints prevent overlapping reservations. A transaction lock serializes reservations, and pending holds expire after 15 minutes. Check-out dates are exclusive, so same-day turnover is allowed.
- Razorpay order creation, HMAC callback verification, captured-payment reconciliation, signed webhooks, and late-payment review. Availability quotes are checked again transactionally before creating an order.
- Supabase Auth admin sign-in. RLS checks `app_metadata.role = admin` for every database operation. Client-side UI checks are not the authorization boundary.
- Booking status management, payment tracking, room inventory/pricing/availability, admin-only image uploads, guest history, enquiries, revenue, daily check-ins/check-outs, and occupancy.
- Supabase Realtime booking updates.
- Transactional notification outbox, leased workers, email delivery through Resend, optional WhatsApp template delivery, and next-day check-in reminders.
- Canonical metadata, Open Graph image, sitemap, robots rules, and Hotel schema.

## Connect Supabase

1. Copy `.env.example` to `.env.local`. Set the project URL, anon key, and server-only service role key.
2. Run `supabase/schema.sql` once in a fresh Supabase project. It sets up tables, constraints, policies, RPCs, Realtime, and the room-image storage bucket. It is a bootstrap script, not a rerunnable migration runner.
3. Create the reception user in Supabase Auth. Set their **app metadata**, not user metadata, to `{"role":"admin"}` using the Supabase Admin API or trusted dashboard tooling. Never provide the service key to the browser.
4. Sign in at `/admin`. Add one row per physical room, approved nightly rates in rupees, capacity, images, and actual cancellation terms. Rates must include all applicable taxes.
5. Uploaded room images and rates appear on the guesthouse page. Disabling a room removes it from new availability; existing reservations remain intact.

No production inventory, rates, users, reviews, or impact statistics are fabricated or seeded.

## Connect Razorpay

Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`. Start with test-mode keys. Enable automatic capture in your Razorpay account. Configure the `payment.captured` webhook at:

```
https://your-domain/api/payments/webhook
```

The server fetches the payment from Razorpay, checks captured status, order, amount and currency, then reconciles the database. Repeated delivery is idempotent. Payments arriving after a hold expires or a booking is cancelled enter `payment_review` with `refund_required`; they are not silently allocated to an occupied room.

**Refunds are not automatically issued.** The admin must refund through Razorpay and reconcile the payment record. Cancelling a paid booking flags it for a refund. Do not promise an automatic refund from the dashboard.

## Notifications

Set `RESEND_API_KEY`, a verified `NOTIFICATION_FROM_EMAIL`, `ADMIN_NOTIFICATION_EMAIL`, and a long random `CRON_SECRET`. Schedule an authenticated GET request every minute to `/api/notifications`:

```
Authorization: Bearer YOUR_CRON_SECRET
```

Use Vercel Cron on a suitable plan or another trusted scheduler. No scheduler is enabled in this repository. The worker checks for next-day arrivals in India time, claims at most 10 jobs with a five-minute lease, tracks individual deliveries, and retries failed jobs. Email submissions use Resend idempotency keys. Monitor provider delivery/bounce logs; API acceptance is not proof of inbox delivery.

For WhatsApp, set the API token, business phone-number ID, supported Graph API version, and an approved English template name. The template must accept five body parameters in order: guest first name, booking reference, event, check-in, check-out. Set the admin WhatsApp destination. Guest WhatsApp updates require the optional opt-in checkbox. Without WhatsApp credentials, email delivery still works. WhatsApp retries are at-least-once: a worker failure immediately after provider acceptance can produce a duplicate.

Confirmed-booking emails include payment status and amount; these are booking acknowledgements, not tax invoices. Check-in reminders include reception hours and contact instructions. New bookings and cancellations notify reception. Configuration changes do not retroactively resend completed outbox entries.

## Deployment

Import the repository into Vercel as a Next.js project, configure the environment variables, and set `NEXT_PUBLIC_SITE_URL` to the production origin. Redeploy after changing public Supabase environment variables. Connect the production domain, apply the database schema, configure provider webhooks and the notification scheduler, and perform a real test-mode reservation before switching to live keys.

## Before a public launch

- The site now uses property photographs downloaded from the official Auromode website; sources are recorded in `public/images/sources.json`. Confirm that these photographs are approved for the new site and map each photo to the correct live room category in `lib/content.ts`. The requested Standard/Deluxe/Family/Long Stay taxonomy differs from the existing website’s Studio/Standard/Triple/2 Bedrooms taxonomy and needs property approval. Font licenses are included under `public/fonts`.
- Approve the story copy, amenities, accessibility details, room capacities, restaurant hours/menu, store collections, cancellation terms, privacy notice, and tax-inclusive rates with the property team.
- Supply authentic reviews and verified impact statistics if those sections are wanted. Neither is invented here.
- Expand French/Tamil translations to all detailed pages and checkout; have the existing translations reviewed by native speakers.
- Add production abuse protection/rate limits or CAPTCHA to public enquiry, availability, and reservation endpoints before exposing them to traffic.
- Test simultaneous reservations, RLS with non-admin accounts, payment capture/webhook retries, expired holds, refunds, image storage, notifications, and scheduler behavior against configured services. Those live integration checks cannot run without project credentials.
- Reception schedules are published as supplied. Google Maps embeds are third-party network content and can be blocked by privacy settings.

## Technical references

- [Supabase Next.js guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Razorpay Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/)
- [Resend idempotency](https://resend.com/changelog/idempotency-keys)
- [Meta WhatsApp template messages](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/template/)

The dependency lockfile pins tested versions. A PostCSS override keeps Next.js 15's transitive dependency on the patched release.
