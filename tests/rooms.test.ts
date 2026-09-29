import test from "node:test";
import assert from "node:assert/strict";
import inventory from "../data/room-inventory.json";
import {
  roomCapacity,
  roomImages,
  validRoomImageUrl,
  normalizeRoomCategory,
} from "../lib/rooms";
import { staySchema } from "../lib/validation";
test("approved inventory has 34 unique numbered rooms and correct category counts", () => {
  assert.equal(inventory.length, 34);
  assert.equal(new Set(inventory.map((r) => r.room_number)).size, 34);
  assert.deepEqual(
    inventory.filter((r) => r.category === "studio").map((r) => r.room_number),
    [22, 34],
  );
  assert.deepEqual(
    inventory.filter((r) => r.category === "triple").map((r) => r.room_number),
    [1, 3, 4, 11, 12],
  );
  assert.deepEqual(
    inventory.filter((r) => r.category === "family").map((r) => r.room_number),
    [2, 7, 18, 27],
  );
  assert.equal(inventory.filter((r) => r.category === "twin").length, 23);
  for (const room of inventory) {
    assert.equal(
      room.capacity,
      roomCapacity[room.category as keyof typeof roomCapacity],
    );
    assert.ok(room.season_rate >= room.non_season_rate);
    assert.ok(room.non_season_rate >= 150000);
  }
  assert.equal(
    inventory.find((r) => r.room_number === 27)?.season_rate,
    600000,
  );
  assert.equal(
    inventory.find((r) => r.room_number === 6)?.non_season_rate,
    400000,
  );
});
test("studio and triple booking capacities count adults and children", () => {
  const stay = {
    checkin: "2090-10-10",
    checkout: "2090-10-12",
    room: "studio",
    adults: 1,
    children: 0,
  };
  assert.ok(staySchema.safeParse(stay).success);
  assert.equal(staySchema.safeParse({ ...stay, children: 1 }).success, false);
  assert.ok(
    staySchema.safeParse({ ...stay, room: "triple", adults: 2, children: 1 })
      .success,
  );
  assert.equal(
    staySchema.safeParse({ ...stay, room: "triple", adults: 3, children: 1 })
      .success,
    false,
  );
  assert.equal(normalizeRoomCategory(null, 3), "triple");
  assert.equal(normalizeRoomCategory("standard", 2), "twin");
});
test("gallery preserves order, deduplicates cover, and rejects unsafe URLs", () => {
  assert.deepEqual(
    roomImages(
      {
        image_url: "/images/studio.jpg",
        image_urls: ["/images/twin.jpg", "/images/studio.jpg"],
      },
      "",
    ),
    ["/images/twin.jpg", "/images/studio.jpg"],
  );
  for (const url of [
    "javascript:alert(1)",
    "data:image/png,x",
    "http://example.com/a.jpg",
    "/images/../secret",
  ])
    assert.equal(validRoomImageUrl(url), false);
  assert.ok(validRoomImageUrl("/images/studio.jpg"));
  assert.ok(validRoomImageUrl("https://example.com/photo.jpg"));
});
