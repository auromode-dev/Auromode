import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
test("reception bookings enforce admin access, atomic blocks and idempotent retries", async () => {
  const db = new PGlite({ extensions: { btree_gist } });
  try {
    const schema = fs.readFileSync("supabase/schema.sql", "utf8");
    await db.exec(
      "create role anon;create role authenticated;create role service_role;",
    );
    await db.exec(
      schema
        .slice(0, schema.indexOf("create table public.enquiries"))
        .replace(
          "'standard','deluxe','family','long-stay'",
          "'studio','twin','triple','family'",
        ),
    );
    await db.exec(
      schema.slice(
        schema.indexOf("create function public.available_rooms"),
        schema.indexOf("create function public.confirm_payment"),
      ),
    );
    await db.exec(
      fs.readFileSync(
        "supabase/migrations/20260930_multi_room_bookings.sql",
        "utf8",
      ),
    );
    await db.exec(
      "create function is_admin() returns boolean language sql as $$select coalesce(current_setting('test.admin',true),'false')='true'$$;",
    );
    const migration = fs.readFileSync(
      "supabase/migrations/20261007_reception_bookings.sql",
      "utf8",
    );
    await db.exec(migration);
    await db.exec(migration);
    await db.exec(
      "insert into rooms(name,category,capacity,nightly_rate) values('A','twin',2,200000),('B','twin',2,250000)",
    );
    const id = "00000000-0000-4000-8000-000000000001";
    async function reserve(request = id, amount = 900000, adults = 4) {
      return db.query<{ result: { id: string; status: string } }>(
        "select reception_booking($1,'twin','2090-10-10','2090-10-12',$2,0,$3::jsonb,2) result",
        [
          request,
          adults,
          JSON.stringify({
            firstName: "Test",
            lastName: "Guest",
            email: "test@example.com",
            phone: "123456789",
            consent: true,
            expectedAmount: amount,
          }),
        ],
      );
    }
    await assert.rejects(() => reserve(), /Admin access required/);
    await db.exec("set test.admin='true'");
    await assert.rejects(
      () => reserve(id, 900000, 1),
      /Invalid reception booking/,
    );
    await assert.rejects(() => reserve(id, 1), /Rate changed/);
    assert.equal((await db.query("select * from bookings")).rows.length, 0);
    const first = await reserve();
    assert.equal(first.rows[0].result.status, "confirmed");
    const retry = await reserve();
    assert.equal(retry.rows[0].result.id, first.rows[0].result.id);
    const rows = await db.query<{
      status: string;
      payment_status: string;
      booking_source: string;
      amount: number;
    }>("select * from bookings");
    assert.equal(rows.rows.length, 2);
    assert.ok(
      rows.rows.every(
        (r) =>
          r.status === "confirmed" &&
          r.payment_status === "unpaid" &&
          r.booking_source === "reception",
      ),
    );
    assert.equal(
      rows.rows.reduce((s, r) => s + r.amount, 0),
      900000,
    );
    await db.exec(
      "update bookings set hold_expires_at=now()-interval '1 hour'",
    );
    assert.equal(
      (
        await db.query(
          "select * from available_rooms('twin','2090-10-10','2090-10-12',2)",
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      () => reserve("00000000-0000-4000-8000-000000000002"),
      /Not enough rooms/,
    );
    await assert.rejects(
      () =>
        db.query(
          "select reserve_room('twin','2090-10-10','2090-10-12',2,0,$1::jsonb)",
          [JSON.stringify({ expectedAmount: 400000 })],
        ),
      /No room available/,
    );
    assert.equal(
      (
        await db.query(
          "select * from available_rooms('twin','2090-10-12','2090-10-13',2)",
        )
      ).rows.length,
      2,
    );
    await db.exec("update bookings set status='cancelled'");
    assert.equal(
      (
        await db.query(
          "select * from available_rooms('twin','2090-10-10','2090-10-12',2)",
        )
      ).rows.length,
      2,
    );
    await db.exec("set test.admin='false'");
    await assert.rejects(() => reserve(), /Admin access required/);

    await db.exec(
      fs.readFileSync(
        "supabase/migrations/20261008_ten_guest_bookings.sql",
        "utf8",
      ),
    );
    await db.exec(
      "set test.admin='true';insert into rooms(name,category,capacity,nightly_rate) values('C','twin',2,200000),('D','twin',2,200000),('E','twin',2,200000)",
    );
    const guest = JSON.stringify({
      firstName: "Group",
      lastName: "Guest",
      email: "group@example.com",
      phone: "123456789",
      consent: true,
      expectedAmount: 2100000,
    });
    await db.query(
      "select reception_booking('00000000-0000-4000-8000-000000000010','twin','2090-11-01','2090-11-03',10,0,$1::jsonb,5)",
      [guest],
    );
    const group = await db.query<{ adults: number; amount: number }>(
      "select adults,amount from bookings where checkin='2090-11-01'",
    );
    assert.equal(group.rows.length, 5);
    assert.equal(
      group.rows.reduce((n, r) => n + r.adults, 0),
      10,
    );
    assert.ok(group.rows.every((r) => r.adults <= 2));
    await assert.rejects(
      () =>
        db.query(
          "select reception_booking('00000000-0000-4000-8000-000000000011','twin','2090-12-01','2090-12-03',10,1,$1::jsonb,5)",
          [guest],
        ),
      /Invalid reception booking/,
    );

    await db.exec(
      "alter table rooms add column room_number integer; update rooms set room_number=22;create table notification_outbox(id uuid primary key default gen_random_uuid(),booking_id uuid,event text,created_at timestamptz default now(),delivered_at timestamptz,locked_until timestamptz,next_attempt_at timestamptz default now())",
    );
    const refs = fs.readFileSync(
      "supabase/migrations/20261009_booking_references.sql",
      "utf8",
    );
    await db.exec(refs);
    await db.exec(refs);
    const references = await db.query<{ booking_reference: string }>(
      "select booking_reference from bookings",
    );
    assert.ok(
      references.rows.every((r) =>
        /^avapart_[0-9]{8}_R22_[0-9]+$/.test(r.booking_reference),
      ),
    );
    assert.equal(
      new Set(references.rows.map((r) => r.booking_reference)).size,
      references.rows.length,
    );
    const before = references.rows[0].booking_reference;
    await db.query(
      "update bookings set booking_reference='changed' where booking_reference=$1",
      [before],
    );
    assert.equal(
      (
        await db.query("select id from bookings where booking_reference=$1", [
          before,
        ])
      ).rows.length,
      1,
    );
  } finally {
    await db.close();
  }
});
