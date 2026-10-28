import Link from "next/link";

export const metadata = {
  title: "Reservations & Cancellation Policy",
  description:
    "How to book, change or request cancellation of your Auromode stay.",
  alternates: { canonical: "/cancellation-policy" },
};

export default function CancellationPolicy() {
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">AUROMODE APARTMENTS</span>
        <h1>Reservations &amp; Cancellation Policy</h1>
      </div>
      <article className="policy-content">
        <section>
          <h2>Making a reservation</h2>
          <p>
            Book an apartment, studio or room through our website, or contact
            reception by email or phone.
          </p>
          <Link className="button" href="/availability">
            Book your stay
          </Link>
          <p>
            <a href="mailto:avapart@gmail.com">avapart@gmail.com</a>
            <br />
            <a href="mailto:avparts@auroville.org.in">avparts@auroville.org.in</a>
            <br />
            <a href="tel:+914132622224">+91 413 262 22 24</a>
            <br />
            <a href="tel:+917871562343">+91 78715 62343</a>
          </p>
        </section>
        <section>
          <h2>Reservation confirmation</h2>
          <p>
            After receiving your advance payment, we will send a confirmation
            email with your reservation dates and details. Website bookings are
            confirmed after payment is received and verified.
          </p>
          <p>
            Please present your identification and confirmation email at
            reception when you check in.
          </p>
        </section>
        <section>
          <h2>Cancellation charges</h2>
          <ul>
            <li>
              15 or more days before check-in: 10% of the invoice amount is
              charged, including banking and administration fees.
            </li>
            <li>
              3 to fewer than 15 days before check-in: 50% of the invoice amount
              is charged, including banking and administration fees.
            </li>
            <li>
              Less than 3 days before arrival, or in case of a no-show: the
              advance payment is non-refundable.
            </li>
          </ul>
        </section>
        <section>
          <h2>Changing your dates</h2>
          <p>
            In an emergency after your reservation is confirmed, you may request
            to postpone your stay, subject to availability.
          </p>
        </section>
        <section>
          <h2>Requesting a cancellation</h2>
          <p>
            Submit a cancellation request through the Contact page or email
            avapart@gmail.com. Include your booking reference, the name on the
            reservation and your stay dates. Cancellations are not accepted by
            phone.
          </p>
          <p>
            Submitting a request does not automatically cancel your booking or
            issue a refund. Reception will confirm the cancellation and any
            applicable charges or refund by email.
          </p>
          <Link
            className="button"
            href="/contact?type=cancellation#contact-form"
          >
            Request cancellation
          </Link>
        </section>
      </article>
    </>
  );
}
