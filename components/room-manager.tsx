"use client";
import { useEffect, useRef, useState } from "react";
import { ReceptionBooking } from "@/components/reception-booking";
import { Trash2 } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { roomTypes } from "@/lib/content";
import { ensureAdminSession, roomSaveError } from "@/lib/admin-session";
import {
  MAX_ROOM_IMAGES,
  roomCapacity,
  roomImages,
  validRoomImageUrl,
  type RoomCategory,
} from "@/lib/rooms";
export type ManagedRoom = {
  id: string;
  name: string;
  room_number: number | null;
  category: string;
  capacity: number;
  nightly_rate: number;
  season_rate: number;
  non_season_rate: number;
  active: boolean;
  image_url: string | null;
  image_urls: string[];
  cancellation_terms: string;
};
export function RoomManager({
  rooms,
  db,
  refresh,
}: {
  rooms: ManagedRoom[];
  db: SupabaseClient;
  refresh: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<ManagedRoom | null>(null),
    [version, setVersion] = useState(0),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [images, setImages] = useState<string[]>([]),
    [category, setCategory] = useState<RoomCategory>("twin");
  const reset = () => {
    setEditing(null);
    setImages([]);
    setCategory("twin");
    setVersion((v) => v + 1);
  };

  const [deleting, setDeleting] = useState<ManagedRoom | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const cancelDelete = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dialog = deleteDialog.current;
    if (!dialog || !deleting) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    cancelDelete.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [deleting]);
  const confirmDelete = async () => {
    if (!deleting || busy) return;
    const r = deleting;
    setDeleteError("");
    setBusy(true);
    try {
      const access = await ensureAdminSession(db.auth);
      if (!access.authorized)
        throw new Error(access.error || "Please sign in again.");
      const { data, error } = await db
        .from("rooms")
        .delete()
        .eq("id", r.id)
        .select("id");
      if (error)
        throw new Error(
          error.code === "23503"
            ? "This room has booking history. Edit it and turn off Open for bookings instead."
            : roomSaveError(error.code),
        );
      if (!data?.length)
        throw new Error(
          "Room was not deleted. Refresh and check admin access.",
        );
      if (editing?.id === r.id) reset();
      setMessage("Room deleted.");
      setDeleting(null);
      await refresh();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not delete room.");
    } finally {
      setBusy(false);
    }
  };

  const money = (rate: number) => "INR " + (rate / 100).toLocaleString("en-IN");
  return (
    <section>
      <dialog
        ref={deleteDialog}
        className="room-delete-dialog"
        aria-labelledby="room-delete-title"
        aria-describedby="room-delete-description"
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) setDeleting(null);
        }}
      >
        <div className="room-delete-icon">
          <Trash2 size={24} aria-hidden="true" />
        </div>
        <span className="eyebrow">ROOM MANAGEMENT</span>
        <h2 id="room-delete-title">Delete {deleting?.name}?</h2>
        <p id="room-delete-description">
          This permanently removes the room from your inventory and cannot be
          undone. Rooms with booking history cannot be deleted.
        </p>
        <div className="room-delete-tip">
          Want to stop new bookings? Edit the room and turn off{" "}
          <strong>Open for bookings</strong> instead.
        </div>
        {deleteError && (
          <p className="room-delete-error" role="alert">
            {deleteError}
          </p>
        )}
        <div className="room-delete-actions">
          <button
            ref={cancelDelete}
            type="button"
            className="button button-outline"
            disabled={busy}
            onClick={() => setDeleting(null)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button room-delete-confirm"
            disabled={busy}
            onClick={() => void confirmDelete()}
          >
            {busy ? "Deleting..." : "Delete room"}
          </button>
        </div>
      </dialog>
      <p>
        Prices are per room, per night, including taxes. Non-season rates are
        currently used for online bookings.
      </p>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ROOM</th>
              <th>CATEGORY</th>
              <th>NON-SEASON</th>
              <th>SEASON</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {[...rooms]
              .sort((a, b) => (a.room_number ?? 9999) - (b.room_number ?? 9999))
              .map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>
                    {roomTypes.find((t) => t.id === r.category)?.name ||
                      r.category}
                    <br />
                    {r.capacity} bed(s)
                  </td>
                  <td>{money(r.non_season_rate ?? r.nightly_rate)}</td>
                  <td>{money(r.season_rate ?? r.nightly_rate)}</td>
                  <td>{r.active ? "Active" : "Unavailable"}</td>
                  <td>
                    <button
                      type="button"
                      className="inline-link"
                      disabled={busy}
                      onClick={() => {
                        setEditing(r);
                        setCategory(r.category as RoomCategory);
                        setImages(roomImages(r, "").filter(Boolean));
                        setVersion((v) => v + 1);
                        setMessage("");
                      }}
                    >
                      Edit {r.name}
                    </button>{" "}
                    <button
                      type="button"
                      className="inline-link"
                      disabled={busy}
                      onClick={() => {
                        setDeleteError("");
                        setDeleting(r);
                      }}
                    >
                      Delete {r.name}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {!editing && <ReceptionBooking db={db} refresh={refresh} />}
      {editing && (
        <form
          key={version}
          style={{ maxWidth: 760, marginTop: 35 }}
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget,
              values = new FormData(form);
            const uploaded: string[] = [];
            let saved = false;
            setBusy(true);
            setMessage("");
            try {
              const access = await ensureAdminSession(db.auth);
              if (!access.authorized)
                throw new Error(access.error || "Please sign in again.");
              const urls = Array.from(
                new Set([
                  ...images,
                  ...String(values.get("image_urls") || "")
                    .split(/\r?\n/)
                    .map((s) => s.trim())
                    .filter(Boolean),
                ]),
              );
              const files = values
                .getAll("images")
                .filter((f): f is File => f instanceof File && f.size > 0);
              if (urls.some((url) => !validRoomImageUrl(url)))
                throw new Error("Use HTTPS image URLs, one per line.");
              if (urls.length + files.length > MAX_ROOM_IMAGES)
                throw new Error(
                  `Use at most ${MAX_ROOM_IMAGES} images per room.`,
                );
              if (
                files.some(
                  (f) =>
                    f.size > 5 * 1024 * 1024 ||
                    !["image/jpeg", "image/png", "image/webp"].includes(f.type),
                )
              )
                throw new Error(
                  "Choose JPEG, PNG or WebP files, each no larger than 5 MB.",
                );
              const number = Number(values.get("room_number")),
                nonSeason = Math.round(
                  Number(values.get("non_season_rate")) * 100,
                ),
                season = Math.round(Number(values.get("season_rate")) * 100);
              if (
                !Number.isInteger(number) ||
                number < 1 ||
                ![nonSeason, season].every(
                  (n) => Number.isSafeInteger(n) && n > 0 && n <= 2147483647,
                )
              )
                throw new Error(
                  "Enter a valid room number and positive prices.",
                );
              for (const file of files) {
                const path =
                  crypto.randomUUID() + "." + file.type.split("/")[1];
                const { error } = await db.storage
                  .from("room-images")
                  .upload(path, file, { contentType: file.type });
                if (error)
                  throw new Error(
                    "Image upload failed. Check storage access and try again.",
                  );
                uploaded.push(path);
                urls.push(
                  db.storage.from("room-images").getPublicUrl(path).data
                    .publicUrl,
                );
              }
              if (!urls.length)
                urls.push(roomTypes.find((r) => r.id === category)!.image);
              const record = {
                room_number: number,
                name: String(values.get("name")).trim(),
                category,
                capacity: roomCapacity[category],
                nightly_rate: nonSeason,
                non_season_rate: nonSeason,
                season_rate: season,
                image_urls: urls,
                image_url: urls[0],
                active: values.get("active") === "on",
                cancellation_terms: String(
                  values.get("cancellation_terms"),
                ).trim(),
              };
              const result = editing
                ? await db
                    .from("rooms")
                    .update(record)
                    .eq("id", editing.id)
                    .select("id")
                : await db.from("rooms").insert(record).select("id");
              if (result.error)
                throw new Error(
                  result.error.code === "23505"
                    ? "This room number already exists."
                    : ["PGRST204", "42703"].includes(result.error.code)
                      ? "Apply supabase/migrations/20260929_room_inventory.sql in the Supabase SQL Editor first."
                      : roomSaveError(result.error.code),
                );
              if (!result.data?.length)
                throw new Error(
                  "Room was not saved. Refresh and check admin access.",
                );
              saved = true;
              reset();
              setMessage("Room saved.");
              await refresh();
            } catch (error) {
              setMessage(
                error instanceof Error ? error.message : "Could not save room.",
              );
            } finally {
              if (!saved && uploaded.length)
                await db.storage.from("room-images").remove(uploaded);
              setBusy(false);
            }
          }}
        >
          <h2>Edit room</h2>
          <div className="field-grid">
            <label className="field">
              Room number
              <input
                name="room_number"
                type="number"
                min="1"
                step="1"
                required
                defaultValue={editing?.room_number ?? undefined}
              />
            </label>
            <label className="field">
              Room name / number
              <input
                name="name"
                required
                maxLength={100}
                defaultValue={editing?.name}
              />
            </label>
            <label className="field">
              Category
              <select
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as RoomCategory)}
              >
                {roomTypes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} - {r.beds} bed(s)
                  </option>
                ))}
              </select>
            </label>
            <p>
              {roomCapacity[category]} bed(s); maximum {roomCapacity[category]}{" "}
              guest(s), including children.
            </p>
            <label className="field">
              Non-season nightly rate (INR)
              <input
                name="non_season_rate"
                type="number"
                min="1"
                step="0.01"
                required
                defaultValue={
                  editing
                    ? (editing.non_season_rate ?? editing.nightly_rate) / 100
                    : undefined
                }
              />
            </label>
            <label className="field">
              Season nightly rate (INR)
              <input
                name="season_rate"
                type="number"
                min="1"
                step="0.01"
                required
                defaultValue={
                  editing
                    ? (editing.season_rate ?? editing.nightly_rate) / 100
                    : undefined
                }
              />
            </label>
            <label className="field full-width">
              Upload room images (up to 12 total, 5 MB each)
              <input
                name="images"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
              />
            </label>
            <label className="field full-width">
              Add image URLs (one per line)
              <textarea name="image_urls" placeholder="https://..." />
            </label>
          </div>
          {images.length > 0 && (
            <>
              <p>
                The first image is the cover. Remove images or move a photo to
                the front.
              </p>
              <div className="admin-image-grid">
                {images.map((url, i) => (
                  <div key={url}>
                    <img src={url} alt={`Room photo ${i + 1}`} />
                    <button
                      type="button"
                      disabled={busy || i === 0}
                      onClick={() =>
                        setImages([url, ...images.filter((x) => x !== url)])
                      }
                    >
                      {i === 0 ? "Cover" : "Make cover"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setImages(images.filter((x) => x !== url))}
                    >
                      Remove photo {i + 1}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          <label className="field">
            Cancellation terms
            <textarea
              name="cancellation_terms"
              required
              defaultValue={
                editing?.cancellation_terms ||
                "Contact reception for cancellation terms before paying."
              }
            />
          </label>
          <label style={{ display: "block", marginBottom: 20 }}>
            <input
              name="active"
              type="checkbox"
              defaultChecked={editing?.active ?? true}
            />{" "}
            Open for bookings
          </label>
          <button className="button" disabled={busy}>
            {busy ? "Saving..." : "Save room"}
          </button>
          {editing && (
            <button
              className="button button-outline"
              type="button"
              disabled={busy}
              onClick={reset}
            >
              Cancel edit
            </button>
          )}
        </form>
      )}
    </section>
  );
}
