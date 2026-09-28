"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import { roomTypes } from "@/lib/content";
import { staySchema, nights } from "@/lib/validation";
type Availability = {
  mode: "live" | "enquiry";
  rooms?: {
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
    room: query.get("room") || "standard",
    checkin: query.get("checkin") || "",
    checkout: query.get("checkout") || "",
    adults: query.get("adults") || "2",
    children: "0",
  });
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [emailLink, setEmailLink] = useState("");
  const room = roomTypes.find((r) => r.id === stay.room) || roomTypes[0];
  const length =
    stay.checkin && stay.checkout ? nights(stay.checkin, stay.checkout) : 0;
  const update = (key: string, value: string) => {
    setStay((s) => ({ ...s, [key]: value }));
    setAvailability(null);
    setMessage("");
    setEmailLink("");
  };
  async function check() {
    setMessage("");
    const valid = staySchema.safeParse(stay);
    if (!valid.success) {
      setMessage(valid.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stay),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setAvailability(data);
      if (data.mode === "live" && !data.rooms?.length)
        setMessage(
          "No rooms are available for this selection. Try different dates or contact reception.",
        );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not check availability.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const guest = {
      ...data,
      ...stay,
      consent: true,
      whatsappOptIn: data.whatsappOptIn === "on",
      expectedAmount: availability?.rooms?.[0]?.nightly_rate
        ? availability.rooms[0].nightly_rate * length
        : undefined,
    };
    if (availability?.mode === "enquiry") {
      const body = `Stay enquiry\n\n${data.firstName} ${data.lastName}\n${data.email}\n${data.phone}\nRoom: ${room.name}\nCheck-in: ${stay.checkin}\nCheck-out: ${stay.checkout}\nAdults: ${stay.adults}; children: ${stay.children}\nRequests: ${data.requests || "None"}\n\nPlease confirm availability, the full rate, and cancellation terms.`;
      setEmailLink(
        "mailto:avapart@gmail.com?subject=" +
          encodeURIComponent("Stay enquiry — " + stay.checkin) +
          "&body=" +
          encodeURIComponent(body),
      );
      setMessage(
        "Your enquiry is ready. Open your email app below and send it to reception. Your room is not reserved yet.",
      );
      return;
    }
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
        <span className={!availability ? "current" : ""}>
          <b>1</b>Your stay
        </span>
        <span className={availability && !done ? "current" : ""}>
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
              <h2>Make yourself at home.</h2>
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
                onClick={check}
                className="button"
                disabled={busy}
              >
                {busy ? "Just a moment…" : "Check availability"}
                <ArrowUpRight size={16} />
              </button>
              {availability &&
                (availability.mode === "enquiry" ||
                  !!availability.rooms?.length) && (
                  <form onSubmit={submit} style={{ marginTop: 35 }}>
                    <div className="notice">
                      {availability.mode === "enquiry"
                        ? "Let’s plan your stay together. Reception will confirm availability, rates, and booking terms by email."
                        : `A room is available. Total: ₹${((availability.rooms![0].nightly_rate * length) / 100).toLocaleString("en-IN")}, including applicable taxes.`}
                    </div>
                    {availability.mode === "live" && (
                      <p className="notice">
                        <strong>Cancellation terms</strong>
                        <br />
                        {availability.rooms?.[0]?.cancellation_terms}
                      </p>
                    )}
                    <h2>Your details</h2>
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
                        I agree to share my details with Auromode to arrange my
                        stay.
                        {availability.mode === "live" &&
                          " I have reviewed the cancellation terms provided by reception."}
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
                    <button className="button" disabled={busy}>
                      {availability.mode === "enquiry"
                        ? "Prepare email enquiry"
                        : "Continue to secure payment"}
                      <ArrowUpRight size={16} />
                    </button>
                  </form>
                )}
            </>
          )}
          {message && (
            <div className="notice" role="status">
              {done && <Check size={20} />}
              <p>{message}</p>
              {emailLink && (
                <a className="text-link" href={emailLink}>
                  Open email and send enquiry <ArrowUpRight size={16} />
                </a>
              )}
            </div>
          )}
        </div>
        <aside className="booking-aside">
          <img src={room.image} alt={`${room.name} inspiration`} />
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
