import { Suspense } from "react";
import { ContactForm } from "@/components/contact-form";
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
              <a href="mailto:avapart@gmail.com">avapart@gmail.com</a>
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
