"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CalendarDays, Users, ChevronDown } from "lucide-react";
export function AvailabilitySearch() {
  const router = useRouter();
  const [arrival, setArrival] = useState("");
  const today = new Date().toLocaleDateString("en-CA");
  return (
    <form
      className="availability"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        router.push(
          "/book?" +
            new URLSearchParams(
              data as unknown as Record<string, string>,
            ).toString(),
        );
      }}
    >
      <label>
        <span>
          <CalendarDays size={14} /> CHECK-IN
        </span>
        <input
          aria-label="Check-in"
          type="date"
          name="checkin"
          min={today}
          value={arrival}
          onChange={(e) => setArrival(e.target.value)}
          required
        />
      </label>
      <label>
        <span>
          <CalendarDays size={14} /> CHECK-OUT
        </span>
        <input
          aria-label="Check-out"
          type="date"
          name="checkout"
          min={
            arrival
              ? new Date(new Date(arrival).getTime() + 86400000)
                  .toISOString()
                  .slice(0, 10)
              : today
          }
          required
        />
      </label>
      <label>
        <span>
          <Users size={14} /> GUESTS
        </span>
        <select aria-label="Guests" name="adults">
          <option value="1">1 guest</option>
          <option value="2">2 guests</option>
          <option value="3">3 guests</option>
          <option value="4">4 guests</option>
        </select>
      </label>
      <button className="button" type="submit">
        Find your stay <ArrowUpRight size={18} />
      </button>
      <span className="availability-note">
        A slower pace.
        <br />A warmer welcome.
      </span>
    </form>
  );
}
