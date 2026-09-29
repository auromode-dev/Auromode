import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  staySchema,
  guestSchema,
  contactSchema,
  nights,
} from "../lib/validation";
import { validSignature } from "../lib/payment";
const stay = {
  checkin: "2090-10-10",
  checkout: "2090-10-12",
  adults: 2,
  children: 0,
  room: "twin",
};
test("accepts a valid two-night stay", () => {
  assert.equal(staySchema.safeParse(stay).success, true);
  assert.equal(nights(stay.checkin, stay.checkout), 2);
});
test("rejects same-day, reversed, invalid, and past dates", () => {
  for (const v of [
    { checkout: stay.checkin },
    { checkout: "2090-10-01" },
    { checkin: "2090-02-31" },
    { checkin: "2020-01-01" },
  ])
    assert.equal(staySchema.safeParse({ ...stay, ...v }).success, false);
});
test("enforces capacity including children", () => {
  assert.equal(staySchema.safeParse({ ...stay, children: 1 }).success, false);
  assert.equal(
    staySchema.safeParse({ ...stay, room: "family", children: 2 }).success,
    true,
  );
  assert.equal(
    staySchema.safeParse({ ...stay, room: "family", children: 3 }).success,
    false,
  );
});
test("rejects negative, fractional, and zero adult counts", () => {
  for (const adults of [-1, 0, 1.5, 5])
    assert.equal(staySchema.safeParse({ ...stay, adults }).success, false);
});
test("requires guest consent and valid contact details", () => {
  const guest = {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    phone: "+919999999999",
    consent: true,
  };
  assert.equal(guestSchema.safeParse(guest).success, true);
  assert.equal(
    guestSchema.safeParse({ ...guest, consent: false }).success,
    false,
  );
  assert.equal(
    guestSchema.safeParse({ ...guest, email: "bad" }).success,
    false,
  );
});
test("contact validation rejects oversized messages", () => {
  assert.equal(
    contactSchema.safeParse({
      name: "Guest",
      email: "guest@example.com",
      subject: "Stay",
      message: "a".repeat(4001),
    }).success,
    false,
  );
});
test("payment verification accepts only authentic HMAC signatures", () => {
  const payload = "order_1|pay_1";
  const sig = createHmac("sha256", "test-secret").update(payload).digest("hex");
  assert.equal(validSignature(payload, sig, "test-secret"), true);
  assert.equal(validSignature("order_2|pay_1", sig, "test-secret"), false);
  assert.equal(validSignature(payload, "invalid", "test-secret"), false);
  assert.equal(validSignature(payload, sig, "wrong-secret"), false);
});
