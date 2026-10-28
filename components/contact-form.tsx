"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
export function ContactForm() {
  const params = useSearchParams();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const cancellationFromUrl = params.get("type") === "cancellation";
  const [cancellation, setCancellation] = useState(cancellationFromUrl);
  useEffect(() => {
    setCancellation(cancellationFromUrl);
    setStatus("");
    setFallback("");
  }, [cancellationFromUrl]);
  return (
    <form
      id="contact-form"
      method="post"
      action="/api/contact"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setStatus("");
        const form = e.currentTarget;
        const values = Object.fromEntries(new FormData(form));
        const subject = cancellation
          ? `Cancellation request - ${values.bookingReference}`
          : String(values.subject);
        const emailFallback =
          "mailto:avapart@gmail.com?subject=" +
          encodeURIComponent(subject) +
          "&body=" +
          encodeURIComponent(
            `${values.name}\n${values.email}\n${values.phone}\n\n${values.message}`,
          );
        try {
          const response = await fetch("/api/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values),
          });
          const result = await response.json();
          if (!response.ok) {
            setStatus(result.error || "Unable to send your enquiry.");
            setFallback(emailFallback);
          } else {
            setStatus(
              cancellation
                ? "Your cancellation request has been received. Reception will confirm the outcome by email. Your booking has not been automatically cancelled."
                : result.emailPending
                  ? "Thank you. Your enquiry has been received. The acknowledgement email is pending; reception will be in touch."
                  : "Thank you. Your enquiry has been received and an acknowledgement email has been requested. Reception will be in touch.",
            );
            setFallback("");
            form.reset();
          }
        } catch {
          setStatus(
            cancellation
              ? "We could not connect. Please email avapart@gmail.com."
              : "We could not connect. Please email or call reception.",
          );
          setFallback(emailFallback);
        } finally {
          setBusy(false);
        }
      }}
    >
      <span className="eyebrow">DROP US A NOTE</span>
      <h2 style={{ fontSize: 38, marginBottom: 25 }}>What’s on your mind?</h2>
      <fieldset disabled={busy || !ready} className="contact-fields">
        <label className="field">
          Request type
          <select
            name="requestType"
            value={cancellation ? "cancellation" : "enquiry"}
            onChange={(event) => {
              setCancellation(event.target.value === "cancellation");
              setStatus("");
              setFallback("");
            }}
          >
            <option value="enquiry">General enquiry</option>
            <option value="cancellation">Cancellation request</option>
          </select>
        </label>
        {cancellation && (
          <>
            <p className="form-note">
              Include your booking reference, the name on the reservation and
              your stay dates. Reception will review your request under the
              cancellation policy.
            </p>
            <label className="field">
              Booking reference
              <input
                name="bookingReference"
                required
                maxLength={100}
                translate="no"
                data-private
              />
            </label>
            <a className="inline-link" href="/cancellation-policy">
              Reservations &amp; Cancellation Policy
            </a>
          </>
        )}
        <label className="field">
          Your name
          <input name="name" autoComplete="name" required maxLength={120} />
        </label>
        <div className="field-grid">
          <label className="field">
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>
          <label className="field">
            Phone
            <input name="phone" type="tel" autoComplete="tel" maxLength={30} />
          </label>
        </div>
        {!cancellation ? (
          <label className="field">
            Subject
            <input
              name="subject"
              defaultValue={params.get("subject") || ""}
              required
              maxLength={160}
            />
          </label>
        ) : (
          <input name="subject" type="hidden" value="Cancellation request" />
        )}
        <label className="field">
          Your message
          <textarea name="message" required maxLength={4000} />
        </label>
        <p className="form-note">
          We’ll use these details only to respond to your enquiry and arrange
          the services you request.
        </p>
        <button className="button" disabled={busy}>
          {busy
            ? "Sending…"
            : cancellation
              ? "Send cancellation request"
              : "Send your enquiry"}
          <ArrowUpRight size={17} />
        </button>
      </fieldset>
      {status && (
        <div className="notice" role="status">
          {status}
          {fallback && (
            <p>
              <a className="inline-link" href={fallback}>
                Open your email app with this enquiry
              </a>
            </p>
          )}
        </div>
      )}
    </form>
  );
}
