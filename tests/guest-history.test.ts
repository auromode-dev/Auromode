import test from "node:test";
import assert from "node:assert/strict";
import { guestHistory } from "../lib/guest-history";

test("guests sharing contact details retain separate booking histories", () => {
  const first = {
    first_name: "Asha",
    last_name: "Guest",
    email: "family@example.com",
    phone: "+91 98765 43210",
    id: "new",
  };
  const second = { ...first, first_name: "Ravi", id: "other" };
  const older = {
    ...first,
    first_name: " asha ",
    email: "FAMILY@example.com",
    phone: "919876543210",
    id: "old",
  };
  const groups = guestHistory([first, second, older]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].guest.id, "new");
  assert.deepEqual(
    groups[0].bookings.map((b) => b.id),
    ["new", "old"],
  );
  assert.deepEqual(
    groups[1].bookings.map((b) => b.id),
    ["other"],
  );
});
