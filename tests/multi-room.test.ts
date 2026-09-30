import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
test("multi-room holds and payment confirmation are atomic in PostgreSQL", async () => {
  const db = new PGlite({ extensions: { btree_gist } });
  try {
    const schema = fs.readFileSync("supabase/schema.sql", "utf8");
    await db.exec(
      "create role anon; create role authenticated; create role service_role;",
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
    const migration = fs
      .readFileSync(
        "supabase/migrations/20260930_multi_room_bookings.sql",
        "utf8",
      )
      .replace(/^\uFEFF/, "");
    await db.exec(migration);
    await db.exec(migration);
    await db.exec(
      "insert into rooms(name,category,capacity,nightly_rate) values ('Twin A','twin',2,200000),('Twin B','twin',2,250000);",
    );
    const reserve = async (amount = 900000, adults = 4, children = 0) => {
      const result = await db.query<{
        result: { id: string; ids: string[]; amount: number };
      }>(
        "select reserve_rooms('twin','2090-10-10','2090-10-12',$1,$2,$3::jsonb,2) as result",
        [
          adults,
          children,
          JSON.stringify({
            firstName: "Test",
            lastName: "Guest",
            email: "test@example.com",
            phone: "123456789",
            expectedAmount: amount,
          }),
        ],
      );
      return result.rows[0].result;
    };
    await assert.rejects(() => reserve(1), /Rate changed/);
    assert.equal((await db.query("select * from bookings")).rows.length, 0);
    const held = await reserve();
    assert.equal(held.ids.length, 2);
    assert.equal(held.amount, 900000);
    await assert.rejects(() => reserve(), /Not enough rooms/);
    assert.equal((await db.query("select * from bookings")).rows.length, 2);
    await db.query("update bookings set razorpay_order_id=$1 where id=$2", [
      "order-test",
      held.id,
    ]);
    await assert.rejects(
      () => db.query("select confirm_payment('order-test','pay-test',1)"),
      /Payment mismatch/,
    );
    await db.query("select confirm_payment('order-test','pay-test',900000)");
    await db.query("select confirm_payment('order-test','pay-test',900000)");
    const paid = await db.query<{
      status: string;
      payment_status: string;
      amount: number;
    }>("select status,payment_status,amount from bookings");
    assert.ok(
      paid.rows.every(
        (b) => b.status === "confirmed" && b.payment_status === "paid",
      ),
    );
    assert.equal(
      paid.rows.reduce((sum, b) => sum + b.amount, 0),
      900000,
    );
    await db.exec("delete from bookings");
    const family = await reserve(900000, 2, 2);
    const allocation = await db.query<{ adults: number; children: number }>(
      "select adults,children from bookings",
    );
    assert.ok(allocation.rows.every((b) => b.adults === 1 && b.children === 1));
    await db.query("update bookings set razorpay_order_id=$1 where id=$2", [
      "order-late",
      family.id,
    ]);
    await db.query("update bookings set status='cancelled' where id=$1", [
      family.ids[1],
    ]);
    await db.query("select confirm_payment('order-late','pay-late',900000)");
    assert.ok(
      (
        await db.query<{ status: string; payment_status: string }>(
          "select status,payment_status from bookings",
        )
      ).rows.every(
        (b) =>
          b.status === "payment_review" &&
          b.payment_status === "refund_required",
      ),
    );
    await db.exec("delete from bookings");
    await db.exec("update rooms set active=false where name='Twin B'");
    await assert.rejects(() => reserve(), /Not enough rooms/);
    assert.equal((await db.query("select * from bookings")).rows.length, 0);
  } finally {
    await db.close();
  }
});
