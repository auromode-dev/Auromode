import { z } from "zod";
export const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s);
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Enter a valid date");
export const staySchema = z
  .object({
    checkin: day,
    checkout: day,
    adults: z.coerce.number().int().min(1).max(4),
    children: z.coerce.number().int().min(0).max(3).default(0),
    room: z.enum(["standard", "deluxe", "family", "long-stay"]),
  })
  .superRefine((v, ctx) => {
    const start = new Date(v.checkin).getTime(),
      end = new Date(v.checkout).getTime();
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    if (v.checkin < today)
      ctx.addIssue({
        code: "custom",
        message: "Check-in must be today or later",
        path: ["checkin"],
      });
    if (end <= start)
      ctx.addIssue({
        code: "custom",
        message: "Check-out must be after check-in",
        path: ["checkout"],
      });
    if ((end - start) / 86400000 > 180)
      ctx.addIssue({
        code: "custom",
        message: "For stays over 180 nights, please contact reception",
        path: ["checkout"],
      });
    const capacity = v.room === "family" ? 4 : 2;
    if (v.adults + v.children > capacity)
      ctx.addIssue({
        code: "custom",
        message:
          "Your party exceeds this room’s capacity. Choose a family room or contact reception.",
        path: ["adults"],
      });
  });
export const guestSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().email().max(254),
  phone: z.string().trim().min(7).max(30),
  requests: z.string().max(2000).default(""),
  consent: z.literal(true),
  whatsappOptIn: z.boolean().default(false),
});
export const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email().max(254),
  phone: z.string().max(30).default(""),
  subject: z.string().trim().min(1).max(160),
  message: z.string().trim().min(1).max(4000),
});
export function nights(checkin: string, checkout: string) {
  return Math.round(
    (new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000,
  );
}
