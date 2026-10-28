import { Suspense } from "react";
import { ContactForm } from "@/components/contact-form";
import Link from "next/link";
export const metadata = {
  title: "Contact & Directions",
  alternates: { canonical: "/contact" },
};
export default function Contact() {
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">EVERY GOOD STAY STARTS WITH A HELLO</span>
        <h1>
          Let’s <em>connect.</em>
        </h1>
        <p>
          A question, a plan, or just a little curiosity. We’re here for you.
        </p>
      </div>
      <section className="section two-column" style={{ paddingTop: 30 }}>
        <div>
          <div className="contact-card">
            <h3>Come find us.</h3>
            <p>
              Auromode, Auroshilpam
              <br />
              Auroville 605101
              <br />
              Tamil Nadu, India
            </p>
            <p>
              <a href="tel:+914132622224">+91 413 262 22 24</a>
              <br />
              <a href="tel:+917871562343">+91 78715 62343</a>
              <br />
              <a href="mailto:avapart@gmail.com">avapart@gmail.com</a>
              <br />
              <a href="mailto:avparts@auroville.org.in">avparts@auroville.org.in</a>
            </p>
            <a className="text-link" href="https://wa.me/917871562343">
              Chat on WhatsApp ↗
            </a>
            <p className="form-note">
              Reception: Monday–Saturday
              <br />
              9:30 AM–5:00 PM
            </p>
          </div>
          <div className="contact-card">
            <h3>Requesting a cancellation</h3>
            <p>
              Submitting a request does not automatically cancel your booking or
              issue a refund. Reception will confirm the cancellation and any
              applicable charges or refund by email.
            </p>
            <Link
              className="text-link"
              href="/contact?type=cancellation#contact-form"
            >
              Request cancellation
            </Link>
            <Link className="text-link" href="/cancellation-policy">
              Reservations &amp; Cancellation Policy
            </Link>
          </div>
          <iframe
            className="contact-map"
            title="Auromode location"
            loading="lazy"
            src="https://maps.google.com/maps?q=Auromode%20Auroville&t=&z=15&ie=UTF8&iwloc=&output=embed"
          />
        </div>
        <Suspense>
          <ContactForm />
        </Suspense>
      </section>
    </>
  );
}
