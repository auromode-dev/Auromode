"use client";
import { useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { roomTypes } from "@/lib/content";
import { ensureAdminSession } from "@/lib/admin-session";
import { guestSchema, staySchema, nights } from "@/lib/validation";

export function ReceptionBooking({
  db,
  refresh,
}: {
  db: SupabaseClient;
  refresh: () => Promise<void>;
}) {
  const [stay, setStay] = useState({
    checkin: "",
    checkout: "",
    room: "twin",
    adults: 2,
    children: 0,
    quantity: 1,
  });
  const [quote, setQuote] = useState<{
    amount: number;
    names: string[];
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const version = useRef(0),
    requestId = useRef<string | null>(null);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  function change(key: string, value: string | number) {
    version.current++;
    setStay((s) => ({ ...s, [key]: value }));
    setQuote(null);
    setMessage("");
  }
  async function check() {
    const parsed = staySchema.safeParse(stay);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0].message);
      return;
    }
    const current = version.current;
    setBusy(true);
    setQuote(null);
    setMessage("");
    try {
      const access = await ensureAdminSession(db.auth);
      if (!access.authorized)
        throw Error(access.error || "Please sign in again.");
      const response = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stay),
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(
          result.error ||
            "Availability service is unavailable. Check the server connection and database configuration.",
        );
      const data = result.rooms;
      if (current !== version.current) return;
      if (!data || data.length < stay.quantity) {
        setMessage(
          "Not enough rooms are available for these dates. Try another category or dates.",
        );
        return;
      }
      const selected = data.slice(0, stay.quantity) as {
        name: string;
        nightly_rate: number;
      }[];
      setQuote({
        amount:
          selected.reduce((sum, r) => sum + r.nightly_rate, 0) *
          nights(stay.checkin, stay.checkout),
        names: selected.map((r) => r.name),
      });
    } catch (e) {
      if (current === version.current)
        setMessage(
          e instanceof Error ? e.message : "Could not check availability.",
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="reception-booking"
      translate="no"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy || !quote) return;
        const form = event.currentTarget;
        const values = new FormData(form);
        const guest = guestSchema.safeParse({
          ...Object.fromEntries(values),
          consent: values.get("consent") === "on",
          whatsappOptIn: values.get("whatsappOptIn") === "on",
        });
        const parsed = staySchema.safeParse(stay);
        if (!guest.success || !parsed.success) {
          setMessage(
            !guest.success
              ? guest.error.issues[0].message
              : "Please check the stay details.",
          );
          return;
        }
        setBusy(true);
        setMessage("");
        try {
          const access = await ensureAdminSession(db.auth);
          if (!access.authorized)
            throw Error(access.error || "Please sign in again.");
          requestId.current ||= crypto.randomUUID();
          const { data, error } = await db.rpc("reception_booking", {
            p_request_id: requestId.current,
            p_category: stay.room,
            p_checkin: stay.checkin,
            p_checkout: stay.checkout,
            p_adults: stay.adults,
            p_children: stay.children,
            p_quantity: stay.quantity,
            p_guest: { ...guest.data, expectedAmount: quote.amount },
          });
          if (error) {
            if (error.code === "PGRST202")
              throw Error(
                "Apply the 20261007_reception_bookings.sql migration before creating reception bookings.",
              );
            throw Error(
              "Booking could not be saved. Recheck availability and rates before retrying. If the connection failed, retry without changing the details.",
            );
          }
          if (!data?.id)
            throw Error(
              "No booking reference was returned. Retry with the same details.",
            );
          setMessage(
            `Booking ${data.reference || data.id}: ${data.status}. Payment is unpaid. View it in Bookings.`,
          );
          setQuote(null);
          requestId.current = null;
          form.reset();
          let notificationStatus =
            "Confirmation email is queued; delivery needs a configured notification worker.";
          try {
            const { data: sessionData } = await db.auth.getSession();
            const response = await fetch("/api/admin/booking-notifications", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + sessionData.session?.access_token,
              },
              body: JSON.stringify({ bookingId: data.id }),
              signal: AbortSignal.timeout(25000),
            });
            const result = await response.json();
            if (response.ok && result.failed === 0 && result.delivered > 0)
              notificationStatus =
                "Booking notifications accepted by the providers.";
          } catch {}
          setMessage(
            `Booking ${data.reference || data.id}: ${data.status}. Payment is unpaid. ${notificationStatus}`,
          );

          try {
            await refresh();
          } catch {
            setMessage(
              `Booking ${data.reference || data.id} saved. Refresh the dashboard to see it.`,
            );
          }
        } catch (e) {
          setMessage(
            e instanceof Error ? e.message : "Booking could not be saved.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <span className="eyebrow">DIRECT BOOKINGS</span>
      <h2>Book for a guest.</h2>
      <p>
        For phone, email and walk-in enquiries. Confirming blocks the rooms for
        the full stay, with payment recorded as unpaid. Cancel the booking to
        release the rooms.
      </p>
      <fieldset disabled={busy}>
        <div className="field-grid">
          <label className="field">
            Check-in
            <input
              type="date"
              value={stay.checkin}
              min={today}
              onChange={(e) => change("checkin", e.target.value)}
              required
            />
          </label>
          <label className="field">
            Check-out
            <input
              type="date"
              value={stay.checkout}
              min={stay.checkin || today}
              onChange={(e) => change("checkout", e.target.value)}
              required
            />
          </label>
          <label className="field">
            Room category
            <select
              value={stay.room}
              onChange={(e) => change("room", e.target.value)}
            >
              {roomTypes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          {(
            [
              ["quantity", "Rooms", 1, 10],
              ["adults", "Adults", 1, 10],
              ["children", "Children", 0, 3],
            ] as const
          ).map(([key, label, min, max]) => (
            <label className="field" key={key}>
              {label}
              <input
                type="number"
                min={min}
                max={max}
                value={stay[key]}
                onChange={(e) => change(key, Number(e.target.value))}
                required
              />
            </label>
          ))}
        </div>
        <button
          className="button button-outline"
          type="button"
          onClick={() => void check()}
        >
          {busy ? "Checking..." : "Check availability"}
        </button>
        {quote && (
          <>
            <div className="notice">
              <strong>
                {stay.quantity} room(s) available · INR{" "}
                {(quote.amount / 100).toLocaleString("en-IN")} total, including
                taxes.
              </strong>
              <p>
                {quote.names.join(", ")}. Rooms are assigned again when saved,
                at the checked total.
              </p>
            </div>
            <div className="field-grid">
              {(
                [
                  ["firstName", "First name", "text"],
                  ["lastName", "Last name", "text"],
                  ["email", "Email", "email"],
                  ["phone", "Phone", "tel"],
                ] as const
              ).map(([name, label, type]) => (
                <label className="field" key={name}>
                  {label}
                  <input
                    name={name}
                    type={type}
                    required
                    maxLength={
                      name === "email" ? 254 : name === "phone" ? 30 : 80
                    }
                  />
                </label>
              ))}
            </div>
            <label className="field">
              Guest requests / reception notes
              <textarea name="requests" maxLength={2000} />
            </label>
            <label className="reception-check">
              <input type="checkbox" name="consent" required /> The guest has
              authorized reception to record these details and make this
              booking.
            </label>
            <label className="reception-check">
              <input type="checkbox" name="whatsappOptIn" /> The guest agreed to
              receive WhatsApp booking updates.
            </label>
            <button className="button" type="submit">
              {busy ? "Saving booking..." : "Confirm booking and block rooms"}
            </button>
          </>
        )}
      </fieldset>
      {message && (
        <p className="notice" role="status" data-private>
          {message}
        </p>
      )}
    </form>
  );
}
