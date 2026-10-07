# Auromode project agent guide

## Purpose and scope

Maintain the Auromode Auroville hospitality website: Stay, Work, Eat, Connect. These instructions apply throughout this repository. Follow the user's current request; preserve unrelated changes. This file is a coding-agent guide, not a running service or a deployment configuration.

Read the relevant implementation before changing it. Use `README.md` for setup, `package.json` for commands, and the files below for current behavior. Do not infer that an integration is live from the presence of code, environment variable names, or a migration file.

## Architecture and where to work

- Next.js App Router, TypeScript, React, Tailwind CSS and Framer Motion. Keep the existing stack and lockfile; avoid framework upgrades as part of unrelated work.
- `app/`: public pages and server API routes. Prefer server components; add `"use client"` only for browser state or interaction, as the first statement.
- `components/site-shell.tsx`, `app/globals.css`: shared navigation, sticky header, footer and visual styles.
- `lib/content.ts`, `lib/rooms.ts`: public content, room categories, capacities and image helpers.
- `components/office-rentals.tsx`, `app/amenities/offices/page.tsx`: office facilities, rental contacts and campus businesses. Keep the office details on their dedicated page; the Amenities card links there.
- `components/availability-search.tsx`, `components/booking-form.tsx`: home search and booking steps.
- `app/api/availability/`, `app/api/bookings/`, `lib/validation.ts`: availability, alternatives and server-side reservation validation.
- `lib/payment.ts`, `app/api/payments/`: Razorpay verification and captured-payment reconciliation.
- `components/admin-dashboard.tsx`, `components/room-manager.tsx`, `lib/admin-session.ts`: reception access, bookings and physical-room management.
- `lib/server.ts`: server-side database/provider access. `lib/supabase-browser.ts`: browser client protected by Supabase RLS.
- `supabase/schema.sql`: fresh-project bootstrap. `supabase/migrations/`: incremental changes for existing projects.
- `app/api/notifications/route.ts`: email/WhatsApp queue worker.
- `lib/languages.ts`, `components/language-picker.tsx`, `components/public-translation.tsx`, `app/api/translate/route.ts`: active translation implementation. `lib/locales.ts` is historical welcome-page copy, not the active full-site translator.

## Product and visual conventions

- Preserve the warm ivory, earthy green and gold palette, generous spacing, Manrope sans-serif headings and body text, rounded navigation/buttons and spacious two-column campus cards. Reuse existing components and CSS variables.
- Paragraph text uses 16px and headings are bold (700) at the user's request. Do not globally change typography without a related request.
- Keep the header sticky at the top. Verify navigation and language menus remain usable after scrolling on desktop and mobile.
- Use the existing Auromode logo, property photos and local flag assets. Maintain image source records when adding assets. Do not invent room photographs, reviews, amenities, prices or business claims.
- Match existing responsive layouts. Check a narrow viewport around 390px and desktop around 1440px for relevant UI changes.
- Use accessible in-page dialogs for destructive actions, not `window.confirm` or `alert`. Preserve keyboard dismissal, safe initial focus, pending states and visible errors.
- Use native-language names alongside flags. Preserve reduced-motion support and meaningful labels.

## Booking invariants

- Home search goes to `/availability`. Show live results before Book now, guest details and payment. Availability must work without Razorpay, Resend or WhatsApp configuration.
- Distinguish unavailable rooms from a failed database request. Never present a connection error as sold out or invent availability.
- Suggestions must use live inventory, preserve stay length and recheck on selection. Current alternatives include nearby dates within three days and multiple rooms of one category. Require at least one adult per room.
- Categories are `studio`, `twin`, `triple`, `family` (1, 2, 3, 4 beds respectively). The approved import baseline contains 34 physical rooms: 2 studio, 23 twin, 5 triple and 4 family. See `data/room-inventory.json` and `data/room-prices.csv`; live admin edits may change inventory later.
- Store money as integer INR paise; display rupees. Prices include taxes. Non-season rates are currently used for booking; do not invent seasonal date ranges.
- The server/database determines the final price. Compare the quoted amount again during reservation. Preserve India-time date validation, exclusive checkout dates, expiring holds and the database overlap constraint.
- Multi-room reservations must hold all rooms atomically, use one Razorpay order and retain linked per-room booking records. Sum their actual rates; do not duplicate the group total into each room's revenue.
- Never confirm from a client callback alone. Preserve signature verification, captured-payment checks, amount/currency/order validation and idempotency. Late, expired or cancelled reservations require payment review/refund handling.
- Preserve booking history when editing rooms. Deletion of a booked room must remain blocked; offer disabling it for new bookings. Keep gallery cover selection and the existing 12-image, 5 MB/file limits.

## Database, secrets and external services

- Preserve RLS and admin authorization through `app_metadata.role = admin`. Refresh stale admin claims via the existing helper; never fix permission errors by disabling RLS or putting a service-role key in browser code.
- Real secrets belong in ignored `.env.local` or deployment settings. `.env.example` should contain placeholders, including in comments. Never print full environment files, tokens, passwords or guest records while diagnosing configuration; report presence/absence or sanitized errors.
- Write a dated migration for schema changes and keep the fresh bootstrap consistent. Preserve IDs and foreign keys. Never rerun the bootstrap against an existing database or rerun an inventory import casually: imports may overwrite later prices.
- A Supabase service-role API key does not provide SQL DDL access. When direct database access is unavailable, finish and verify the migration, then give the user the exact SQL Editor step. Report prepared versus applied migrations accurately.
- Use local fixtures, PGlite and mocked providers for tests. Do not create live bookings, send notifications, charge/refund payments or deploy merely to test a change. Perform external writes only within the user's authorized scope.
- Notifications require a scheduler calling the authenticated worker. Inspect current event routing before promising which recipients receive an event. Guest WhatsApp messages require opt-in. The current worker sends email before WhatsApp, so email failures can delay WhatsApp. API acceptance is not proof of delivery.
- Keep translation credentials server-side. Preserve English fallback, request bounds and caching. Never translate form values, private output, admin data or booking references; use `translate="no"` or `data-private` for sensitive output.
- Public translation is a runtime display feature, not multilingual SEO. Per-process caches/rate limits are not distributed guarantees. Third-party payment windows and transactional messages have separate language behavior.

## Development and verification

On this Windows workspace, use `npm.cmd` and `npx.cmd` if PowerShell blocks `.ps1` shims. Use UTF-8 when editing Tamil, Hindi, currency symbols or other Unicode; avoid shell pipelines that corrupt characters or introduce a BOM into SQL.

```powershell
npm.cmd run dev
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

- Reuse the user's running local server when available. Do not run a production build concurrently with a dev server writing the same `.next` directory; use a separate checkout or coordinate stopping it.
- Run type checking for TypeScript changes. Run the relevant tests for business logic; extend tests for payment, capacity, concurrency, privacy or authorization changes. Do not add tests that merely restate trivial copy/CSS edits.
- Browser scripts use installed Microsoft Edge and a server at `http://localhost:3000`. Run the relevant script with `npx.cmd tsx tests/<name>.ts`:
  - General pages: `browser.ts`.
  - Booking results and alternatives: `availability-browser.ts`, `suggestions-browser.ts`.
  - Admin room editing/deletion: `admin-browser.ts`.
  - Room photos: `room-photos-browser.ts`.
  - Translation, private fields and language switching: `translation-browser.ts`.
- SQL reservation/payment regressions use PGlite in `tests/multi-room.test.ts`; provider-failure cleanup is covered by `tests/multi-room-checkout.test.ts`.
- Read-only live inventory diagnostics are in `scripts/check-availability.cjs` and `scripts/verify-room-inventory.cjs`. The latter compares against the original approved import, so differences may be legitimate later admin changes. Do not overwrite them just to make a check pass.
- Report what changed, which checks actually ran and any remaining configuration or migration step. Do not claim live integration success based only on mocks or passing local tests.

## Keeping this guide useful

Update this file when the project architecture or business rules change. Keep setup walkthroughs in `README.md` and avoid copying credentials, temporary debug output or session-specific claims into agent instructions.

## Reception bookings

- `components/reception-booking.tsx` replaces physical-room creation in the Rooms tab; preserve room editing.
- `20261007_reception_bookings.sql` adds an admin-only atomic RPC. Reception reservations are confirmed/unpaid, block online availability, and use idempotent request IDs. Never mark them paid without a separate payment reconciliation workflow.
- `tests/reception-booking.test.ts` covers authorization, reservation atomicity, retries, capacity, rate changes and cancellation release.

- Group reservations now support up to 10 total guests and 10 rooms, subject to inventory and one adult per room; apply `20261008_ten_guest_bookings.sql`. Per-room adult limits remain four. Reception availability uses the shared server availability endpoint.

- Human booking references are generated by `20261009_booking_references.sql`; UUIDs remain primary/foreign keys. `lib/notifications.ts` is the shared worker; `/api/admin/booking-notifications` requires admin authorization and processes only the selected reception booking/group. Preserve queue locking, idempotency and scheduled retries.

- Contact enquiry emails use `lib/contact-notifications.ts` and `20261010_contact_emails.sql`. New enquiries attempt both recipients independently; the authenticated notification scheduler retries pending emails. Enquiry acknowledgements must never imply a room reservation.
