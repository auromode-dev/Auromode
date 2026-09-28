import { Suspense } from "react";
import { BookingForm } from "@/components/booking-form";
export const metadata = {
  title: "Plan Your Stay",
  alternates: { canonical: "/book" },
};
export default function Book() {
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">A WARMER WELCOME AWAITS</span>
        <h1>
          Your time to <em>slow down.</em>
        </h1>
        <p>A few details, and you’re one step closer to Auroville.</p>
      </div>
      <Suspense
        fallback={
          <p style={{ textAlign: "center", padding: 60 }}>
            Preparing your stay…
          </p>
        }
      >
        <BookingForm />
      </Suspense>
    </>
  );
}
