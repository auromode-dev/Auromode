"use client";
import { useCallback, useEffect, useState } from "react";
import { browserDatabase } from "@/lib/supabase-browser";
import {
  RoomManager,
  type ManagedRoom as Room,
} from "@/components/room-manager";
import { ensureAdminSession } from "@/lib/admin-session";
type Booking = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  checkin: string;
  checkout: string;
  amount: number;
  status: string;
  payment_status: string;
  room_id: string;
  group_id?: string | null;
  requests: string;
};
export function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [enquiries, setEnquiries] = useState<Record<string, string>[]>([]);
  const [tab, setTab] = useState("Bookings");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const db = browserDatabase();
  const refresh = useCallback(async () => {
    if (!db) return;
    const results = await Promise.all([
      db.from("bookings").select("*").order("created_at", { ascending: false }),
      db.from("rooms").select("*").order("name"),
      db
        .from("enquiries")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);
    if (results.some((r) => r.error)) {
      setMessage(
        "Could not load dashboard data. Check the database migration and admin access.",
      );
      return;
    }
    setBookings(results[0].data || []);
    setRooms(results[1].data || []);
    setEnquiries(results[2].data || []);
  }, [db]);
  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }
    let mounted = true;
    const check = async () => {
      const access = await ensureAdminSession(db.auth);
      const admin = access.authorized;
      if (mounted) {
        setAuthenticated(admin);
        setLoading(false);
        if (admin) {
          setMessage((previous) =>
            /session|reception access|admin access/i.test(previous)
              ? ""
              : previous,
          );
          void refresh();
        } else {
          setBookings([]);
          setRooms([]);
          setEnquiries([]);
          setMessage(access.error || "Please sign in.");
        }
      }
    };
    void check();
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange(() => {
      setTimeout(() => void check(), 0);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [db, refresh]);
  useEffect(() => {
    if (!authenticated || !db) return;
    const channel = db
      .channel("reception-bookings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, [db, authenticated, refresh]);
  if (loading)
    return (
      <div className="page-heading">
        <p>Checking reception access…</p>
      </div>
    );
  if (!db)
    return (
      <div className="page-heading">
        <span className="eyebrow">RECEPTION DASHBOARD</span>
        <h1>A little setup first.</h1>
        <p>
          Connect Supabase and apply the database schema to enable secure
          reception access.
        </p>
        <p>No guest records are available in this preview.</p>
      </div>
    );
  if (!authenticated)
    return (
      <form
        className="login-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const values = new FormData(e.currentTarget);
          const { error } = await db.auth.signInWithPassword({
            email: String(values.get("email")),
            password: String(values.get("password")),
          });
          if (error)
            setMessage("Sign-in failed. Check your email and password.");
          setBusy(false);
        }}
      >
        <span className="eyebrow">AUROMODE RECEPTION</span>
        <h1>Welcome back.</h1>
        <label className="field">
          Email
          <input name="email" type="email" required autoComplete="username" />
        </label>
        <label className="field">
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </label>
        <button className="button" disabled={busy}>
          {busy ? "Signing in…" : "Sign in securely"}
        </button>
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
      </form>
    );
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());
  const revenue = bookings
    .filter((b) => b.payment_status === "paid")
    .reduce((n, b) => n + b.amount, 0);
  const occupied = bookings.filter(
    (b) => b.status === "confirmed" && b.checkin <= today && b.checkout > today,
  ).length;
  const active = rooms.filter((r) => r.active).length;
  const guests = Array.from(
    new Map(bookings.map((b) => [b.email, b])).values(),
  );
  return (
    <div className="admin-wrap">
      <div className="admin-toolbar">
        <div>
          <span className="eyebrow">AUROMODE RECEPTION · LIVE DATA</span>
          <h1>A little overview.</h1>
        </div>
        <button
          className="button button-outline"
          onClick={async () => {
            await db.auth.signOut();
            setBookings([]);
            setRooms([]);
            setEnquiries([]);
          }}
        >
          Sign out
        </button>
      </div>
      <div className="stats">
        <div className="stat">
          <span>RECEIVED REVENUE</span>
          <strong>₹{(revenue / 100).toLocaleString("en-IN")}</strong>
        </div>
        <div className="stat">
          <span>TODAY’S CHECK-INS</span>
          <strong>
            {
              bookings.filter(
                (b) => b.checkin === today && b.status === "confirmed",
              ).length
            }
          </strong>
        </div>
        <div className="stat">
          <span>TODAY’S CHECK-OUTS</span>
          <strong>
            {
              bookings.filter(
                (b) => b.checkout === today && b.status === "confirmed",
              ).length
            }
          </strong>
        </div>
        <div className="stat">
          <span>OCCUPANCY TODAY</span>
          <strong>{active ? Math.round((occupied / active) * 100) : 0}%</strong>
        </div>
      </div>
      <div className="admin-tabs">
        {["Bookings", "Rooms", "Guests", "Enquiries"].map((t) => (
          <button
            className={tab === t ? "selected" : ""}
            key={t}
            onClick={() => {
              setTab(t);
              setMessage("");
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {tab === "Bookings" && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>GUEST</th>
                <th>STAY</th>
                <th>ROOM</th>
                <th>AMOUNT</th>
                <th>PAYMENT</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>
                    {b.first_name} {b.last_name}
                    <br />
                    {b.email}
                    <br />
                    {b.phone}
                    {b.requests && (
                      <details>
                        <summary>Guest requests</summary>
                        {b.requests}
                      </details>
                    )}
                  </td>
                  <td>
                    {b.checkin}
                    <br />
                    {b.checkout}
                  </td>
                  <td>
                    {rooms.find((r) => r.id === b.room_id)?.name || "-"}
                    {b.group_id && (
                      <details>
                        <summary>Multi-room booking</summary>
                        <span style={{ overflowWrap: "anywhere" }}>
                          Group: {b.group_id}
                        </span>
                        <br />
                        Each row is one room in the shared payment.
                      </details>
                    )}
                  </td>
                  <td>₹{(b.amount / 100).toLocaleString("en-IN")}</td>
                  <td>{b.payment_status.replaceAll("_", " ")}</td>
                  <td>
                    <select
                      aria-label={"Booking status for " + b.first_name}
                      value={b.status}
                      onChange={async (e) => {
                        const status = e.target.value;
                        const access = await ensureAdminSession(db.auth);
                        if (!access.authorized) {
                          setMessage(access.error || "Please sign in again.");
                          return;
                        }
                        const { error } = await db
                          .from("bookings")
                          .update({ status })
                          .eq("id", b.id);
                        setMessage(
                          error
                            ? "Could not update this booking. Check room availability."
                            : "Booking updated. Cancellations of paid bookings require a refund through Razorpay.",
                        );
                        await refresh();
                      }}
                    >
                      {[
                        "pending",
                        "confirmed",
                        "cancelled",
                        "expired",
                        "payment_review",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!bookings.length && (
            <p className="notice">
              No bookings yet. New reservations will appear here in real time.
            </p>
          )}
        </div>
      )}
      {tab === "Rooms" && (
        <RoomManager rooms={rooms} db={db} refresh={refresh} />
      )}
      {tab === "Guests" && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>GUEST</th>
                <th>EMAIL</th>
                <th>PHONE</th>
                <th>HISTORY</th>
              </tr>
            </thead>
            <tbody>
              {guests.map((g) => (
                <tr key={g.email}>
                  <td>
                    {g.first_name} {g.last_name}
                  </td>
                  <td>{g.email}</td>
                  <td>{g.phone}</td>
                  <td>
                    <details>
                      <summary>
                        {bookings.filter((b) => b.email === g.email).length}{" "}
                        booking(s)
                      </summary>
                      {bookings
                        .filter((b) => b.email === g.email)
                        .map((b) => (
                          <div key={b.id}>
                            {b.checkin} — {b.checkout} · {b.status}
                          </div>
                        ))}
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "Enquiries" && (
        <div>
          {enquiries.map((e) => (
            <article
              className="contact-card"
              style={{ marginBottom: 20 }}
              key={e.id}
            >
              <h3>{e.subject}</h3>
              <a href={"mailto:" + e.email}>
                {e.name} · {e.email}
              </a>
              <p style={{ whiteSpace: "pre-wrap" }}>{e.message}</p>
            </article>
          ))}
          {!enquiries.length && <p>No enquiries yet.</p>}
        </div>
      )}
    </div>
  );
}
