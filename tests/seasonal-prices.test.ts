import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

test("seasonal quotes, atomic reservations and reception charge each occupied night", async () => {
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
    await db.exec(
      fs.readFileSync(
        "supabase/migrations/20261007_reception_bookings.sql",
        "utf8",
      ),
    );
    await db.exec(
      fs.readFileSync(
        "supabase/migrations/20261008_ten_guest_bookings.sql",
        "utf8",
      ),
    );
    await db.exec(
      "alter table rooms add season_rate integer;alter table rooms add non_season_rate integer;",
    );
    await db.exec(
      "insert into rooms(name,category,capacity,nightly_rate,non_season_rate,season_rate) values('A','twin',2,200000,200000,400000),('B','twin',2,250000,250000,300000)",
    );
    const migration = fs.readFileSync(
      "supabase/migrations/20261028_seasonal_prices.sql",
      "utf8",
    );
    await db.exec(migration);
    await db.exec(migration);
    assert.ok(schema.endsWith(migration));
    const price = async (start: string, end: string) =>
      (
        await db.query<{ amount: number }>(
          "select stay_price(300001,200002,$1::date,$2::date) amount",
          [start, end],
        )
      ).rows[0].amount;
    for (let month = 1; month <= 12; month++) {
      const prefix = `2092-${String(month).padStart(2, "0")}`;
      assert.equal(
        await price(prefix + "-10", prefix + "-12"),
        2 * (month <= 3 ? 300001 : 200002),
      );
    }
    assert.equal(await price("2092-03-31", "2092-04-01"), 300001);
    assert.equal(await price("2092-03-31", "2092-04-02"), 500003);
    assert.equal(await price("2092-12-31", "2093-01-02"), 500003);
    assert.equal(await price("2092-02-28", "2092-03-01"), 600002);
    const quote = async (start: string, end: string) =>
      (
        await db.query<{ name: string; total_amount: number }>(
          "select * from available_rooms_priced('twin',$1::date,$2::date,2)",
          [start, end],
        )
      ).rows;
    assert.deepEqual(
      (await quote("2092-01-01", "2092-01-03")).map((r) => [
        r.name,
        r.total_amount,
      ]),
      [
        ["B", 600000],
        ["A", 800000],
      ],
    );
    assert.deepEqual(
      (await quote("2092-04-01", "2092-04-03")).map((r) => [
        r.name,
        r.total_amount,
      ]),
      [
        ["A", 400000],
        ["B", 500000],
      ],
    );
    const guest = (amount: number) =>
      JSON.stringify({
        firstName: "Test",
        lastName: "Guest",
        email: "test@example.com",
        phone: "123456789",
        consent: true,
        expectedAmount: amount,
      });
    await assert.rejects(
      () =>
        db.query(
          "select reserve_room('twin','2092-03-31','2092-04-02',2,0,$1::jsonb)",
          [guest(500000)],
        ),
      /Rate changed/,
    );
    assert.equal((await db.query("select * from bookings")).rows.length, 0);
    await db.query(
      "select reserve_room('twin','2092-03-31','2092-04-02',2,0,$1::jsonb)",
      [guest(550000)],
    );
    assert.equal(
      (await db.query<{ amount: number }>("select amount from bookings"))
        .rows[0].amount,
      550000,
    );
    await db.exec("update bookings set status='cancelled'");
    const group = (
      await db.query<{ result: { id: string; amount: number } }>(
        "select reserve_rooms('twin','2092-03-31','2092-04-02',4,0,$1::jsonb,2) result",
        [guest(1150000)],
      )
    ).rows[0].result;
    assert.equal(group.amount, 1150000);
    assert.deepEqual(
      (
        await db.query<{ amount: number }>(
          "select amount from bookings where status='pending' order by amount",
        )
      ).rows.map((r) => r.amount),
      [550000, 600000],
    );
    assert.equal((await quote("2092-03-31", "2092-04-02")).length, 0);
    await assert.rejects(
      () =>
        db.query(
          "select reserve_rooms('twin','2092-03-31','2092-04-02',4,0,$1::jsonb,2)",
          [guest(1150000)],
        ),
      /Not enough rooms/,
    );
    await db.query(
      "update bookings set razorpay_order_id='season-order' where id=$1",
      [group.id],
    );
    await db.exec(
      "select confirm_payment('season-order','season-payment',1150000)",
    );
    assert.equal(
      (
        await db.query<{ total: number }>(
          "select sum(amount)::integer total from bookings where payment_status='paid'",
        )
      ).rows[0].total,
      1150000,
    );
    const request = "00000000-0000-4000-8000-000000000001";
    const reception = () =>
      db.query<{ result: { id: string } }>(
        "select reception_booking($1,'twin','2092-12-31','2093-01-02',4,0,$2::jsonb,2) result",
        [request, guest(1150000)],
      );
    await assert.rejects(reception, /Admin access required/);
    await db.exec("set test.admin='true'");
    const first = await reception();
    assert.equal(
      (await reception()).rows[0].result.id,
      first.rows[0].result.id,
    );
    const rows = (
      await db.query<{
        amount: number;
        payment_status: string;
        status: string;
      }>(
        "select amount,payment_status,status from bookings where booking_source='reception'",
      )
    ).rows;
    assert.equal(
      rows.reduce((sum, r) => sum + r.amount, 0),
      1150000,
    );
    assert.ok(
      rows.every(
        (r) => r.payment_status === "unpaid" && r.status === "confirmed",
      ),
    );
    await db.exec("update rooms set season_rate=season_rate+10000");
    await assert.rejects(
      () =>
        db.query(
          "select reserve_rooms('twin','2093-01-10','2093-01-12',4,0,$1::jsonb,2)",
          [guest(1400000)],
        ),
      /Rate changed/,
    );
  } finally {
    await db.close();
  }
});
