export const roomCategories = ["studio", "twin", "triple", "family"] as const;
export type RoomCategory = (typeof roomCategories)[number];
export const roomCapacity: Record<RoomCategory, number> = {
  studio: 1,
  twin: 2,
  triple: 3,
  family: 4,
};
export function categoryForGuests(guests: number): RoomCategory {
  return roomCategories[Math.max(0, Math.min(3, guests - 1))] || "twin";
}
export function normalizeRoomCategory(
  value: string | null,
  guests = 2,
): RoomCategory {
  if (roomCategories.includes(value as RoomCategory))
    return value as RoomCategory;
  if (value === "standard" || value === "deluxe" || value === "long-stay")
    return categoryForGuests(Math.max(2, guests));
  return categoryForGuests(guests);
}
export const MAX_ROOM_IMAGES = 12;
export function roomImages(
  room: { image_urls?: string[] | null; image_url?: string | null },
  fallback: string,
): string[] {
  const urls = [
    ...(room.image_urls || []),
    ...(room.image_url ? [room.image_url] : []),
  ].filter(Boolean);
  return urls.length
    ? [...new Set(urls)].slice(0, MAX_ROOM_IMAGES)
    : [fallback];
}
export function validRoomImageUrl(value: string) {
  if (/^\/images\/[a-zA-Z0-9._/-]+$/.test(value) && !value.includes(".."))
    return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
