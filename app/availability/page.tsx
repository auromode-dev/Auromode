import { Suspense } from "react";
import { BookingForm } from "@/components/booking-form";
export const metadata = {
  title: "Room Availability",
  alternates: { canonical: "/availability" },
  robots: { index: false, follow: true },
};
export default function Availability() {
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">FIND YOUR AUROMODE STAY</span>
        <h1>
          A little room for <em>you.</em>
        </h1>
        <p>
          Explore available rooms, choose your stay, then continue to your
          details and payment.
        </p>
      </div>
      <Suspense fallback={<p className="notice">Checking your stay...</p>}>
        <BookingForm />
      </Suspense>
    </>
  );
}
