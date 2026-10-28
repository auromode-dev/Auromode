type GuestDetails = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
};

// Shared family/reception contact details must not merge different guests.
export function guestKey(guest: GuestDetails): string {
  return JSON.stringify([
    guest.first_name.trim().toLowerCase(),
    guest.last_name.trim().toLowerCase(),
    guest.email.trim().toLowerCase(),
    guest.phone.replace(/[^0-9]/g, ""),
  ]);
}

export function guestHistory<T extends GuestDetails>(bookings: T[]) {
  const groups = new Map<string, { key: string; guest: T; bookings: T[] }>();
  for (const booking of bookings) {
    const key = guestKey(booking);
    const group = groups.get(key);
    if (group) group.bookings.push(booking);
    else groups.set(key, { key, guest: booking, bookings: [booking] });
  }
  return Array.from(groups.values());
}
