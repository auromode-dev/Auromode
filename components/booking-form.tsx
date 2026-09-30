"use client";
import Image from "next/image";
import { normalizeRoomCategory } from "@/lib/rooms";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import { roomTypes } from "@/lib/content";
import { staySchema, nights } from "@/lib/validation";
type Suggestion = {
  room: string;
  quantity: number;
  checkin: string;
  checkout: string;
  nightly_rate: number;
};
type Availability = {
  mode: "live";
  checkoutEnabled: boolean;
  rooms: {
    id: string;
    nightly_rate: number;
    cancellation_terms: string;
    name: string;
  }[];
};
type PaymentResult = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}
export function BookingForm() {
  const query = useSearchParams();
  const [stay, setStay] = useState({
    room: normalizeRoomCategory(
      query.get("room"),
      Number(query.get("adults") || 2),
    ),
    checkin: query.get("checkin") || "",
    checkout: query.get("checkout") || "",
    adults: query.get("adults") || (query.get("room") === "studio" ? "1" : "2"),
    children: "0",
    quantity: "1",
  });
  const [step, setStep] = useState<"availability" | "details">("availability");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionMessage, setSuggestionMessage] = useState("");
  const [findingSuggestions, setFindingSuggestions] = useState(false);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const detailsHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (step === "details") detailsHeading.current?.focus();
  }, [step]);
  const requestVersion = useRef(0);
  const initialSearch = useRef(false);
  const room = roomTypes.find((r) => r.id === stay.room) || roomTypes[0];
  const length =
    stay.checkin && stay.checkout ? nights(stay.checkin, stay.checkout) : 0;
  const quantity = Number(stay.quantity);
  const hasRooms = !!availability && availability.rooms.length >= quantity;
  const nightlyRate =
    availability?.rooms
      .slice(0, quantity)
      .reduce((sum, r) => sum + r.nightly_rate, 0) || 0;
  const update = (key: string, value: string) => {
    requestVersion.current++;
    setBusy(false);
    setStay((s) => ({ ...s, [key]: value }));
    setStep("availability");
    setSuggestions([]);
    setSuggestionMessage("");
    setFindingSuggestions(false);
    setAvailability(null);
    setMessage("");
  };
  async function check(nextStay = stay) {
    const version = ++requestVersion.current;
    setStep("availability");
    setSuggestions([]);
    setSuggestionMessage("");
    setFindingSuggestions(false);
    setAvailability(null);
    setMessage("");
    const valid = staySchema.safeParse(nextStay);
    if (!valid.success) {
      setMessage(valid.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextStay),
      });
      const data = await r.json();
      if (version !== requestVersion.current) return;
      if (!r.ok)
        throw new Error(
          data.error || "We could not check availability. Please try again.",
        );
      setAvailability(data);
      if (data.rooms.length < Number(nextStay.quantity)) {
        setMessage("Your selected room option is unavailable for these dates.");
        setFindingSuggestions(true);
        try {
          const response = await fetch("/api/availability/suggestions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(nextStay),
          });
          if (!response.ok)
            throw new Error(
              "Suggestions could not be checked. Try changing your dates.",
            );
          const alternatives = await response.json();
          if (version !== requestVersion.current) return;
          setSuggestions(alternatives.suggestions);
          if (!alternatives.suggestions.length)
            setSuggestionMessage(
              "No alternatives found within three days of your dates. Try another date range.",
            );
        } catch (error) {
          if (version === requestVersion.current)
            setSuggestionMessage(
              error instanceof Error
                ? error.message
                : "Could not check alternatives.",
            );
        } finally {
          if (version === requestVersion.current) setFindingSuggestions(false);
        }
      }
    } catch (e) {
      if (version !== requestVersion.current) return;
      setStep("availability");
      setSuggestions([]);
      setSuggestionMessage("");
      setFindingSuggestions(false);
      setAvailability(null);
      setMessage(
        e instanceof Error ? e.message : "Could not check availability.",
      );
    } finally {
      if (version === requestVersion.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (!initialSearch.current) {
      initialSearch.current = true;
      if (stay.checkin && stay.checkout) void check();
    }
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const guest = {
      ...data,
      ...stay,
      consent: true,
      whatsappOptIn: data.whatsappOptIn === "on",
      expectedAmount: nightlyRate * length,
    };
    if (!hasRooms || !availability?.checkoutEnabled) return;
    setBusy(true);
    try {
      if (!window.Razorpay)
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.onload = () => resolve();
          s.onerror = () =>
            reject(
              new Error("Unable to load secure checkout. Please try again."),
            );
          document.body.appendChild(s);
        });
      const r = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(guest),
      });
      const order = await r.json();
      if (!r.ok) throw new Error(order.error);
      const checkout = new window.Razorpay({
        key: order.key,
        amount: order.amount,
        currency: "INR",
        name: "Auromode Auroville",
        description: `${room.name} · ${length} nights`,
        order_id: order.orderId,
        prefill: {
          name: `${data.firstName} ${data.lastName}`,
          email: data.email,
          contact: data.phone,
        },
        theme: { color: "#344a3b" },
        modal: {
          ondismiss: () => {
            setBusy(false);
            setMessage(
              "Checkout closed. Your temporary room hold will expire automatically.",
            );
          },
        },
        handler: async (payment: PaymentResult) => {
          try {
            const response = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payment),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            if (result.status === "confirmed") {
              setDone(true);
              setMessage(
                "Your stay is confirmed. Booking reference: " + result.id,
              );
            } else
              setMessage(
                "Payment received. Reception needs to review your room allocation. Please contact us with reference " +
                  result.id,
              );
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : "Confirmation pending. Please contact reception before paying again.",
            );
          } finally {
            setBusy(false);
          }
        },
      });
      checkout.open();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to start your booking.",
      );
      setBusy(false);
    }
  }
  return (
    <>
      <div className="booking-steps">
        <span className={step === "availability" && !done ? "current" : ""}>
          <b>1</b>Availability
        </span>
        <span className={step === "details" && !done ? "current" : ""}>
          <b>2</b>Your details
        </span>
        <span className={done ? "current" : ""}>
          <b>3</b>Confirmation
        </span>
      </div>
      <div className="booking-layout">
        <div className="booking-form">
          {!done && (
            <>
              {step === "availability" && (
                <>
                  <h2>Find your available stay.</h2>
                  <div className="field-grid">
                    <label className="field">
                      Check-in
                      <input
                        type="date"
                        value={stay.checkin}
                        onChange={(e) => update("checkin", e.target.value)}
                        required
                      />
                    </label>
                    <label className="field">
                      Check-out
                      <input
                        type="date"
                        value={stay.checkout}
                        onChange={(e) => update("checkout", e.target.value)}
                        required
                      />
                    </label>
                    <label className="field full-width">
                      Room type
                      <select
                        value={stay.room}
                        onChange={(e) => update("room", e.target.value)}
                      >
                        {roomTypes.map((r) => (
                          <option value={r.id} key={r.id}>
                            {r.name} · up to {r.capacity} guests
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      Number of rooms
                      <select
                        value={stay.quantity}
                        onChange={(e) => update("quantity", e.target.value)}
                      >
                        {[1, 2, 3, 4].map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      Adults
                      <select
                        value={stay.adults}
                        onChange={(e) => update("adults", e.target.value)}
                      >
                        {[1, 2, 3, 4].map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      Children
                      <select
                        value={stay.children}
                        onChange={(e) => update("children", e.target.value)}
                      >
                        {[0, 1, 2, 3].map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => void check()}
                    className="button"
                    disabled={busy}
                  >
                    {busy ? "Just a moment…" : "Check availability"}
                    <ArrowUpRight size={16} />
                  </button>
                </>
              )}
              {step === "details" && (
                <button
                  type="button"
                  className="text-link"
                  disabled={busy}
                  onClick={() => setStep("availability")}
                >
                  Back to availability
                </button>
              )}
              {availability && hasRooms && (
                <form onSubmit={submit} style={{ marginTop: 35 }}>
                  <div className="notice" role="status">
                    <strong>
                      {availability.rooms.length === 1
                        ? "1 room available"
                        : availability.rooms.length + " rooms available"}{" "}
                      for your dates.
                    </strong>
                    <p>
                      From ₹{(nightlyRate / 100).toLocaleString("en-IN")} per
                      night · ₹
                      {((nightlyRate * length) / 100).toLocaleString("en-IN")}{" "}
                      total for {length} night{length === 1 ? "" : "s"},
                      including taxes.
                    </p>
                    <p>
                      Availability is checked live. Your room is reserved only
                      after booking confirmation.
                    </p>
                  </div>
                  <p className="notice">
                    <strong>
                      {quantity} room(s) for{" "}
                      {Number(stay.adults) + Number(stay.children)} guests
                    </strong>
                    <br />
                    Cancellation terms:{" "}
                    {[
                      ...new Set(
                        availability.rooms
                          .slice(0, quantity)
                          .map((r) => r.cancellation_terms),
                      ),
                    ].join(" / ")}
                  </p>
                  {step === "availability" && (
                    <button
                      type="button"
                      className="button"
                      onClick={() => {
                        setStep("details");
                        setMessage("");
                      }}
                    >
                      Book now <ArrowUpRight size={16} />
                    </button>
                  )}
                  {step === "details" && !availability.checkoutEnabled && (
                    <p className="notice">
                      Online payment is currently unavailable. Availability and
                      prices above are live; no reservation has been made.
                    </p>
                  )}
                  {step === "details" && (
                    <>
                      <h2 ref={detailsHeading} tabIndex={-1}>
                        Your details
                      </h2>
                      <div className="field-grid">
                        <label className="field">
                          First name
                          <input
                            name="firstName"
                            required
                            maxLength={80}
                            autoComplete="given-name"
                          />
                        </label>
                        <label className="field">
                          Last name
                          <input
                            name="lastName"
                            required
                            maxLength={80}
                            autoComplete="family-name"
                          />
                        </label>
                        <label className="field">
                          Email
                          <input
                            name="email"
                            type="email"
                            required
                            maxLength={254}
                            autoComplete="email"
                          />
                        </label>
                        <label className="field">
                          Phone
                          <input
                            name="phone"
                            type="tel"
                            required
                            minLength={7}
                            maxLength={30}
                            autoComplete="tel"
                          />
                        </label>
                      </div>
                      <label className="field">
                        Anything we should know?
                        <textarea
                          name="requests"
                          placeholder="Arrival time, accessibility needs, or special requests…"
                          maxLength={2000}
                        />
                      </label>
                      <label
                        style={{
                          fontSize: 11,
                          display: "flex",
                          gap: 10,
                          alignItems: "flex-start",
                          marginBottom: 20,
                        }}
                      >
                        <input
                          type="checkbox"
                          required
                          style={{ marginTop: 5 }}
                        />
                        <span>
                          I agree to share my details with Auromode to arrange
                          my stay.
                          {
                            " I have reviewed the cancellation terms shown above."
                          }
                        </span>
                      </label>
                      <label
                        style={{
                          display: "flex",
                          gap: 10,
                          fontSize: 11,
                          marginBottom: 20,
                        }}
                      >
                        <input type="checkbox" name="whatsappOptIn" />
                        Send me booking updates on WhatsApp (optional).
                      </label>
                      <button
                        className="button"
                        disabled={busy || !availability.checkoutEnabled}
                      >
                        Continue to secure payment
                        <ArrowUpRight size={16} />
                      </button>
                    </>
                  )}
                </form>
              )}
            </>
          )}
          {step === "availability" &&
            (findingSuggestions ||
              suggestionMessage ||
              suggestions.length > 0) && (
              <section
                className="stay-alternatives"
                aria-label="Alternative stays"
              >
                <h2>Other ways to stay.</h2>
                {findingSuggestions && (
                  <p role="status">
                    Checking nearby dates and room combinations...
                  </p>
                )}
                {suggestionMessage && <p role="status">{suggestionMessage}</p>}
                {suggestions.map((option, i) => (
                  <article className="notice" key={i}>
                    <strong>
                      {option.quantity} &times;{" "}
                      {roomTypes.find((r) => r.id === option.room)?.name}
                    </strong>
                    <p>
                      {option.checkin === stay.checkin
                        ? "Your selected dates"
                        : "Nearby dates"}
                      : {option.checkin} to {option.checkout}
                    </p>
                    <p>
                      For all {Number(stay.adults) + Number(stay.children)}{" "}
                      guests. INR{" "}
                      {((option.nightly_rate * length) / 100).toLocaleString(
                        "en-IN",
                      )}{" "}
                      total for {length} nights, including taxes.
                    </p>
                    <button
                      type="button"
                      className="text-link"
                      disabled={busy}
                      onClick={() => {
                        const next = {
                          ...stay,
                          room: option.room as typeof stay.room,
                          quantity: String(option.quantity),
                          checkin: option.checkin,
                          checkout: option.checkout,
                        };
                        setStay(next);
                        void check(next);
                      }}
                    >
                      Check this option <ArrowUpRight size={16} />
                    </button>
                  </article>
                ))}
              </section>
            )}
          {message && (
            <div className="notice" role="status">
              {done && <Check size={20} />}
              <p translate={done || /reference|payment received/i.test(message) ? "no" : undefined}>{message}</p>
            </div>
          )}
        </div>
        <aside className="booking-aside">
          <Image width={900} height={600} src={room.image} alt={room.name} />
          <div>
            <span className="eyebrow">YOUR AUROMODE STAY</span>
            <h3>{room.name}</h3>
            <p>{room.description}</p>
            {length > 0 && (
              <p>
                <strong>
                  {length} night{length !== 1 ? "s" : ""}
                </strong>{" "}
                · {Number(stay.adults) + Number(stay.children)} guest(s)
              </p>
            )}
            <p>
              <ShieldCheck
                size={16}
                style={{
                  display: "inline",
                  verticalAlign: "middle",
                  marginRight: 7,
                }}
              />
              A personal welcome, from the very beginning.
            </p>
            <hr
              style={{
                border: 0,
                borderTop: "1px solid #d6d8cc",
                margin: "20px 0",
              }}
            />
            <p>
              Need a hand planning?
              <br />
              <a className="inline-link" href="https://wa.me/917871562343">
                Chat with reception
              </a>
              <br />
              <a href="tel:+914132622224">+91 413 262 22 24</a>
            </p>
            <p className="form-note">Monday–Saturday · 9:30 AM–5:00 PM</p>
          </div>
        </aside>
      </div>
    </>
  );
}
