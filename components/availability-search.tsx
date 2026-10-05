"use client";
import { MotionButton } from "@/components/motion-controls";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CalendarDays, Users, ChevronDown, ChevronLeft, ChevronRight, Check, X } from "lucide-react";

const iso = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (day: string, count: number) => iso(new Date(Date.parse(day + "T00:00:00Z") + count * 86400000));
const monthOf = (day: string) => day.slice(0, 7) + "-01";
const displayDate = (day: string) => day ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(day)) : "Select date";
type Panel = "checkin" | "checkout" | "guests";

export function AvailabilitySearch() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [arrival, setArrival] = useState("");
  const [departure, setDeparture] = useState("");
  const [guests, setGuests] = useState(1);
  const [open, setOpen] = useState<Panel | null>(null);
  const [month, setMonth] = useState("");
  const [focusDay, setFocusDay] = useState("");
  const [error, setError] = useState("");
  const root = useRef<HTMLFormElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const minimum = open === "checkout" && arrival ? addDays(arrival, 1) : today;
  const close = () => {
    const previous = open;
    setOpen(null);
    root.current?.querySelector<HTMLButtonElement>(`[data-trigger="${previous}"]`)?.focus();
  };
  const show = (panel: Panel) => {
    if (open === panel) { close(); return; }
    const min = panel === "checkout" && arrival ? addDays(arrival, 1) : today;
    const selected = (panel === "checkin" ? arrival : departure) || min;
    const day = selected < min ? min : selected;
    setMonth(monthOf(day)); setFocusDay(day); setOpen(panel);
  };
  useEffect(() => {
    if (!open) return;
    const target = open === "guests" ? `[aria-checked="true"]` : `[data-day="${focusDay}"]`;
    popup.current?.querySelector<HTMLButtonElement>(target)?.focus();
  }, [open, focusDay, month]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const moveMonth = (amount: number) => {
    const date = new Date(month); date.setUTCMonth(date.getUTCMonth() + amount);
    const next = iso(date);
    setMonth(next); setFocusDay(next < minimum ? minimum : next);
  };
  const selectDay = (day: string) => {
    if (open === "checkin") { setArrival(day); if (departure <= day) setDeparture(""); }
    else setDeparture(day);
    setError(""); close();
  };
  const first = month ? new Date(month).getUTCDay() : 0;
  const count = month ? new Date(Date.UTC(Number(month.slice(0,4)), Number(month.slice(5,7)), 0)).getUTCDate() : 0;
  return (
    <form className="availability" ref={root}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(null); }}
      onKeyDown={(event) => { if (event.key === "Escape" && open) { event.preventDefault(); close(); } }}
      onSubmit={(event) => {
        event.preventDefault();
        if (!arrival || !departure || arrival < today || departure <= arrival) {
          setError("Choose a check-in date and a later check-out date."); show(!arrival || arrival < today ? "checkin" : "checkout"); return;
        }
        if ((Date.parse(departure) - Date.parse(arrival)) / 86400000 > 180) { setError("For stays over 180 nights, please contact reception."); return; }
        router.push("/availability?" + new URLSearchParams({ checkin: arrival, checkout: departure, adults: String(guests) }));
      }}>
      <input type="hidden" name="checkin" value={arrival} /><input type="hidden" name="checkout" value={departure} /><input type="hidden" name="adults" value={guests} />
      {(["checkin", "checkout", "guests"] as const).map((panel) => (
        <div className="stay-field" key={panel}>
          <span className="stay-field-label">{panel === "guests" ? <Users size={14} /> : <CalendarDays size={14} />}{panel === "checkin" ? "CHECK-IN" : panel === "checkout" ? "CHECK-OUT" : "GUESTS"}</span>
          <button className="stay-trigger" type="button" data-trigger={panel} aria-label={panel === "checkin" ? "Check-in" : panel === "checkout" ? "Check-out" : "Guests"} aria-haspopup="dialog" aria-expanded={open === panel} aria-controls={open === panel ? "stay-picker" : undefined} onClick={() => show(panel)}>
            <span translate="no">{panel === "guests" ? `${guests} ${guests === 1 ? "guest" : "guests"}` : displayDate(panel === "checkin" ? arrival : departure)}</span><ChevronDown size={15} />
          </button>
        </div>
      ))}
      <MotionButton className="button" type="submit">Find your stay <ArrowUpRight size={18} /></MotionButton>
      {error && <p className="stay-error" role="alert">{error}</p>}
      {open && <motion.div ref={popup} id="stay-picker" className={`stay-picker ${open === "guests" ? "guest-picker" : "calendar-picker"}`} role="dialog" aria-label={open === "guests" ? "Choose guests" : `Choose ${open === "checkin" ? "check-in" : "check-out"} date`} initial={reduce ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .18 }}>
        <div className="picker-title"><span>{open === "guests" ? "Who is coming?" : open === "checkin" ? "Your arrival" : "Your departure"}</span><button type="button" onClick={close} aria-label="Close picker"><X size={17} /></button></div>
        {open === "guests" ? <div role="radiogroup" aria-label="Number of guests" onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            event.preventDefault(); const next = event.key === "Home" ? 1 : event.key === "End" ? 4 : Math.min(4, Math.max(1, guests + (event.key === "ArrowDown" ? 1 : -1)));
            setGuests(next); popup.current?.querySelector<HTMLButtonElement>(`[data-guests="${next}"]`)?.focus();
          }
        }}>{[1,2,3,4].map((n) => <button type="button" role="radio" aria-checked={guests === n} tabIndex={guests === n ? 0 : -1} data-guests={n} key={n} onClick={() => { setGuests(n); close(); }}><span>{n} {n === 1 ? "guest" : "guests"}</span>{guests === n && <Check size={16} />}</button>)}</div> : <>
          <div className="calendar-month"><button type="button" aria-label="Previous month" disabled={month <= monthOf(minimum)} onClick={() => moveMonth(-1)}><ChevronLeft size={18} /></button><strong aria-live="polite">{new Intl.DateTimeFormat("en-GB", { month:"long", year:"numeric", timeZone:"UTC" }).format(new Date(month))}</strong><button type="button" aria-label="Next month" onClick={() => moveMonth(1)}><ChevronRight size={18} /></button></div>
          <div className="calendar-week" aria-hidden="true">{["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => <span key={d}>{d}</span>)}</div>
          <div className="calendar-days" role="group" aria-label="Dates" onKeyDown={(event) => {
            const offsets: Record<string,number> = { ArrowLeft:-1, ArrowRight:1, ArrowUp:-7, ArrowDown:7 };
            if (event.key in offsets) { event.preventDefault(); const next = addDays(focusDay, offsets[event.key]); if (next >= minimum) { setFocusDay(next); setMonth(monthOf(next)); } }
          }}>
            {Array.from({length:first},(_,i)=><span key={`blank-${i}`} />)}
            {Array.from({length:count},(_,i)=>{const day=month.slice(0,8)+String(i+1).padStart(2,"0");return <button type="button" key={day} data-day={day} tabIndex={focusDay === day ? 0 : -1} disabled={day < minimum} aria-label={displayDate(day)} aria-pressed={day === (open === "checkin" ? arrival : departure)} aria-current={day === today ? "date" : undefined} className={arrival && departure && day > arrival && day < departure ? "in-stay" : ""} onFocus={()=>setFocusDay(day)} onClick={()=>selectDay(day)}>{i+1}</button>;})}
          </div>
          <p className="calendar-hint">{open === "checkout" ? "Select a date after your arrival." : "A slower pace starts here."}</p>
        </>}
      </motion.div>}
    </form>
  );
}
