# Auromode Auroville

Next.js 15, TypeScript, Tailwind CSS 4, Framer Motion, Supabase/PostgreSQL, and Razorpay. A responsive hospitality website with local photography and fonts, live room availability, and integration code for live reservations.

## Coding agent guide

Project-specific coding instructions are in [AGENTS.md](AGENTS.md). Read this guide before changing booking logic, database migrations, admin access, translation or shared UI.

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:3000. No credentials are needed to browse the site. Availability checks require Supabase and run independently of Razorpay or Resend. The site displays available rooms and rates, or no availability, directly from the database. Connection problems show an error rather than an email fallback. Checkout is offered only when Razorpay is configured.

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
- Ten-language flag selector and stored translations across public pages. Admin and transactional communications remain English; private form values and booking references are excluded.
- Validated availability and booking endpoints; tax-inclusive INR prices are supplied by real room inventory, not the client.
- PostgreSQL exclusion constraints prevent overlapping reservations. A transaction lock serializes reservations, and pending holds expire after 15 minutes. Check-out dates are exclusive, so same-day turnover is allowed.
- Razorpay order creation, HMAC callback verification, captured-payment reconciliation, signed webhooks, and late-payment review. Availability quotes are checked again transactionally before creating an order.
- Supabase Auth admin sign-in. RLS checks `app_metadata.role = admin` for every database operation. Client-side UI checks are not the authorization boundary.
- Booking status management, payment tracking, room inventory/pricing/availability, admin-only image uploads, guest history, enquiries, revenue, daily check-ins/check-outs, and occupancy.
- Supabase Realtime booking updates.
- Transactional notification outbox, leased workers, email delivery through Resend, optional WhatsApp template delivery, and next-day check-in reminders.
- Canonical metadata, Open Graph image, sitemap, robots rules, and Hotel schema.

## Connect Supabase

1. Copy `.env.example` to `.env.local`. Set the project URL (`https://YOUR_PROJECT_REF.supabase.co`), anon key, and server-only service role key. Next.js does not load `.env.example`. Keep real credentials in the ignored `.env.local` file and restart the development server after changing them.
2. Run `supabase/schema.sql` once in a fresh Supabase project. It sets up tables, constraints, policies, RPCs, Realtime, and the room-image storage bucket. It is a bootstrap script, not a rerunnable migration runner.
3. Create the reception user in Supabase Auth. Set their **app metadata**, not user metadata, to `{"role":"admin"}` using the Supabase Admin API or trusted dashboard tooling. Never provide the service key to the browser.
4. Sign in at `/admin`. The dashboard verifies the account role and refreshes stale access-token claims before loading data or saving changes. If a permission error remains, sign out and sign in again, then verify the admin RLS policies. Add one row per physical room, approved nightly rates in rupees, capacity, images, and actual cancellation terms. Rates must include all applicable taxes.
5. Uploaded room images and rates appear on the guesthouse page. Disabling a room removes it from new availability; existing reservations remain intact.

The approved 34-room inventory and tax-inclusive season/non-season prices are recorded in `data/room-prices.csv`. The bootstrap includes this inventory. Existing projects must run `supabase/migrations/20260929_room_inventory.sql` in the SQL Editor (do not rerun the bootstrap). January-March uses season prices and April-December uses normal prices. Each occupied night uses its own date, excluding checkout. Apply supabase/migrations/20261028_seasonal_prices.sql in Supabase SQL Editor before deploying this version; it updates availability and reservation pricing without changing existing bookings or inventory. Duplicate rows 28 and 29 from the supplied table appear only once. The previous Studio 101 entry is preserved but disabled. No users, reviews, or impact statistics are seeded. Run `node --use-system-ca scripts/check-availability.cjs` to check the configured room counts and the live availability RPC without creating bookings or sending emails.

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

Confirmed-booking emails include payment status and amount; these are booking acknowledgements, not tax invoices. Check-in reminders include reception hours and contact instructions. New bookings and cancellations notify reception. WhatsApp confirmation events notify both reception and opted-in guests when configured. Configuration changes do not retroactively resend completed outbox entries.

## Deployment

Import the repository into Vercel as a Next.js project, configure the environment variables, and set `NEXT_PUBLIC_SITE_URL` to the production origin. Redeploy after changing public Supabase environment variables. Connect the production domain, apply the database schema, configure provider webhooks and the notification scheduler, and perform a real test-mode reservation before switching to live keys.

## Before a public launch

- The site now uses property photographs downloaded from the official Auromode website; sources are recorded in `public/images/sources.json`. Confirm that these photographs are approved for the new site and map each photo to the correct live room category in `lib/content.ts`. The requested Standard/Deluxe/Family/Long Stay taxonomy differs from the existing website’s Studio/Standard/Triple/2 Bedrooms taxonomy and needs property approval. Font licenses are included under `public/fonts`.
- Approve the story copy, amenities, accessibility details, room capacities, restaurant hours/menu, store collections, cancellation terms, privacy notice, and tax-inclusive rates with the property team.
- Supply authentic reviews and verified impact statistics if those sections are wanted. Neither is invented here.
- Check translated public content and booking terms when English copy changes; the stored translations have not received an independent native-speaker review.
- Add production abuse protection/rate limits or CAPTCHA to public enquiry, availability, and reservation endpoints before exposing them to traffic.
- Test simultaneous reservations, RLS with non-admin accounts, payment capture/webhook retries, expired holds, refunds, image storage, notifications, and scheduler behavior against configured services. Those live integration checks cannot run without project credentials.
- Reception schedules are published as supplied. Google Maps embeds are third-party network content and can be blocked by privacy settings.

## Technical references

- [Supabase Next.js guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Razorpay Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/)
- [Resend idempotency](https://resend.com/changelog/idempotency-keys)
- [Meta WhatsApp template messages](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/template/)

The dependency lockfile pins tested versions. A PostCSS override keeps Next.js 15's transitive dependency on the patched release.

## Room management

Categories: Studio Suite (1 bed, rooms 22 and 34), Twin Room (2 beds, 23 rooms), Triple Room (3 beds, rooms 1, 3, 4, 11, 12), Family Suite (4 beds, rooms 2, 7, 18, 27).

In `/admin` ? Rooms, edit both tax-inclusive nightly prices in rupees. Season prices apply January-March; normal prices apply April-December. Room editing opens in a side panel. Use the separate Direct booking tab for reception reservations. Upload up to 12 JPEG/PNG/WebP images (5 MB each), add HTTPS image URLs, remove gallery entries, or choose a cover. The guesthouse gallery reflects saved images. Deleting a room requires confirmation and is blocked when booking history exists; turn off Open for bookings instead. Removing a gallery entry does not delete shared storage assets.

The inventory migration is transactional and rerunnable, preserves booking references and custom galleries, and updates the approved rates when rerun. Back up later rate edits before rerunning this initial import.

## Availability and multiple rooms

The home search opens `/availability`. Results are shown before a separate Book now step for guest details and payment. If the chosen option is unavailable, live suggestions check other room categories (including multiple rooms of the same category) and dates up to three days earlier/later, preserving the stay length. Suggestions are rechecked when selected; at least one adult is required in each room.

Existing Supabase projects must run `supabase/migrations/20260930_multi_room_bookings.sql` to enable multi-room checkout. The fresh-project bootstrap includes it. Multi-room reservations use one Razorpay order and separate linked booking records for each physical room. Each record stores its own share of the price, so revenue is not double-counted. Holds are created atomically; captured payments confirm the whole group. Late payments or a cancelled room put the group into payment review. Room-level notifications and cancellation/refund administration remain per booking record; use the shared group reference to identify related rooms. Refunds still require reception action in Razorpay.

Razorpay keys are required to pay. Book now can open the details step without them, but payment is disabled with an explanation. Tests use isolated PostgreSQL (PGlite) and mocked provider/browser requests; no live payment is taken by automated tests.

## Stored translations (10 languages)

English, Tamil, French, Hindi, German, Spanish, Italian, Dutch, Russian and Simplified Chinese are available in the flag selector. Native-language names and local flags are preserved. The browser loads only the selected language dictionary from `lib/translations/<code>.json`; no translation provider, API key, subscription or database migration is needed. Normal website hosting still applies.

The current page is translated without resetting form values or changing routes. Preference is saved in the browser; `?lang=fr` selects a language on shared links. Legacy language paths redirect to the translated homepage. `lib/stored-translations.ts` performs exact phrase lookup and bounded numeric-template substitution. Uncatalogued text stays English; new room descriptions or cancellation terms are never guessed or sent to a provider. If a language chunk cannot load, the page restores English and shows a notice.

Maintain all nine JSON files together whenever public English copy changes. Keys are whitespace-normalized English phrases. Preserve named placeholders such as `{count}`, `{total}` and `{nights}` exactly; their translated order can differ. Keep business names, addresses and actual prices unchanged. Use complete text nodes for numeric sentences instead of English plural suffix fragments. Check phrasing in context, especially capacities, consent, payment status and enquiry acknowledgements. These are AI-authored translations, not independently certified translations.

The translator covers catalogued public text, labels, image descriptions and placeholders (including textarea placeholders). Form values, textarea contents, editable areas, private output, admin pages and booking references stay untouched. Use `translate="no"` or `data-private` for private/deliberately untranslated output. It edits text-node values without replacing React elements, and restores English when switched off. Third-party payment windows, email/WhatsApp messages and browser-native validation are outside its scope.

This remains runtime display translation, not server-rendered multilingual SEO. Canonical URLs and metadata stay English. The bounded `/api/translate` endpoint remains for compatibility and uses the same local dictionaries, but the public browser component does not call it. `lib/locales.ts` is historical welcome-page copy.

Run `npx.cmd tsx --test tests/translation.test.ts` for catalog and API checks, and `npx.cmd tsx tests/translation-browser.ts` with the local server on port 3000 for public-content coverage, nine-language switching, privacy, booking controls and mobile/desktop checks. No translation quota is consumed.

Flags: https://flagcdn.com/ (local SVG copies in `public/flags`).

## Google reviews section

The home page includes `components/google-reviews.tsx`. Set `GOOGLE_REVIEWS_URL` to the public Google Maps profile/reviews link and `GOOGLE_WRITE_REVIEW_URL` to the link from Business Profile > Ask for reviews. Store these in `.env.local` and deployment settings; restart/redeploy after changing them. Without these URLs, the section links to a clearly labeled Google Maps search for Auromode and explains how to leave a review.

No reviews, rating or count are hardcoded. The component accepts a review feed for a future approved Business Profile integration, but no API fetching, OAuth, synchronization or notifications are connected yet.

## Reception bookings

Run `supabase/migrations/20261007_reception_bookings.sql` in the existing project SQL Editor after the multi-room migration. This migration is prepared locally; it is not applied automatically. In Admin > Rooms, the reception booking form replaces room creation; Edit still opens the room editor. Check dates/category/quantity, then enter guest details and confirm. The database rechecks inventory and the tax-inclusive total, reserves all rooms atomically, and confirms them as unpaid without Razorpay. These reservations block public availability until cancelled; no checkout-hold expiry applies. Each room is cancelled individually through Bookings. A request ID prevents duplicate bookings on retries. Existing notification events queue new-booking and confirmation messages; delivery still requires the configured worker/providers and guest WhatsApp opt-in. No offline payment is recorded by this form.

### Groups and monthly stays
Run `supabase/migrations/20261008_ten_guest_bookings.sql` after the reception migration to enable up to 10 total guests and 10 rooms per reservation. Per-room capacities and at least one adult per room still apply. Reception availability now uses the server `/api/availability` endpoint; server Supabase configuration must be valid. Monthly-stay enquiries on Guesthouse direct guests to reception for rates and terms.

### Booking references and direct-booking emails
Apply `supabase/migrations/20261009_booking_references.sql` after the ten-guest migration. References use `avapart_YYYYMMDD_R<room-number>_<unique-sequence>` based on check-in and are immutable; UUID primary keys remain internal. Existing records receive references without requeueing confirmation emails. Direct booking save calls an admin-authenticated endpoint to process the booking/group notification queue immediately. Failed jobs still require the scheduled `/api/notifications` worker for retry. Resend acceptance is not delivery confirmation.

### Contact-form email acknowledgements
Apply `supabase/migrations/20261010_contact_emails.sql` before deploying the contact-email changes. New enquiries are saved and immediately attempt a guest acknowledgement and admin notification independently. The acknowledgement does not confirm a reservation. Per-recipient flags and Resend idempotency keys support retries; configure the authenticated `/api/notifications` scheduler for failures. Existing enquiries are not mailed retroactively. API acceptance is not inbox delivery.
