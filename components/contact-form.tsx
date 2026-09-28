"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
export function ContactForm() {
  const params = useSearchParams();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setStatus("");
        const form = e.currentTarget;
        const values = Object.fromEntries(new FormData(form));
        try {
          const response = await fetch("/api/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values),
          });
          const result = await response.json();
          if (!response.ok) {
            setStatus(result.error || "Unable to send your enquiry.");
            setFallback(
              "mailto:avapart@gmail.com?subject=" +
                encodeURIComponent(String(values.subject)) +
                "&body=" +
                encodeURIComponent(
                  `${values.name}\n${values.email}\n${values.phone}\n\n${values.message}`,
                ),
            );
          } else {
            setStatus(
              "Thank you. Your enquiry has been received. Reception will be in touch.",
            );
            setFallback("");
            form.reset();
          }
        } catch {
          setStatus("We could not connect. Please email or call reception.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <span className="eyebrow">DROP US A NOTE</span>
      <h2 style={{ fontSize: 38, marginBottom: 25 }}>What’s on your mind?</h2>
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
      <label className="field">
        Subject
        <input
          name="subject"
          defaultValue={params.get("subject") || ""}
          required
          maxLength={160}
        />
      </label>
      <label className="field">
        Your message
        <textarea name="message" required maxLength={4000} />
      </label>
      <p className="form-note">
        We’ll use these details only to respond to your enquiry and arrange the
        services you request.
      </p>
      <button className="button" disabled={busy}>
        {busy ? "Sending…" : "Send your enquiry"}
        <ArrowUpRight size={17} />
      </button>
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
