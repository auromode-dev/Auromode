"use client";

import { useEffect, useRef, useState } from "react";
import { X, ZoomIn, ZoomOut } from "lucide-react";

const pages = [
  "/stay/menu/IMG_0558.webp",
  "/stay/menu/IMG_0559.webp",
  "/stay/menu/IMG_0557.webp",
];

export function FoodMenu() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!open) return;
    const modal = dialog.current!;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modal.showModal();
    return () => {
      modal.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="food-menu-trigger"
        aria-label="Food menu"
        title="Food menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="food-menu-dialog"
        onClick={() => { setPage(0); setZoomed(false); setOpen(true); }}
      >
        <img src="/stay/menu/icon.webp" alt="" width={80} height={80} />
      </button>
      <dialog
        ref={dialog}
        id="food-menu-dialog"
        className="food-menu-dialog"
        aria-labelledby="food-menu-title"
        onClose={() => { setOpen(false); trigger.current?.focus(); }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)
            dialog.current?.close();
        }}
      >
        <div className="food-menu-header">
          <h2 id="food-menu-title">Food menu</h2>
          <button type="button" aria-label="Close menu" autoFocus onClick={() => dialog.current?.close()}>
            <X size={24} aria-hidden="true" />
          </button>
        </div>
        {open && (
          <>
            <div className="food-menu-toolbar">
              <div className="food-menu-pages">
                {pages.map((src, index) => (
                  <button
                    type="button"
                    key={src}
                    aria-label={`Menu page ${index + 1}`}
                    aria-pressed={page === index}
                    onClick={() => {
                      setPage(index);
                      setZoomed(false);
                      viewport.current?.scrollTo(0, 0);
                    }}
                  >
                    <span aria-hidden="true">{index + 1}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="food-menu-zoom"
                aria-label={zoomed ? "Zoom out" : "Zoom in"}
                aria-pressed={zoomed}
                onClick={() => { setZoomed(!zoomed); viewport.current?.scrollTo(0, 0); }}
              >
                {zoomed ? <ZoomOut size={20} aria-hidden="true" /> : <ZoomIn size={20} aria-hidden="true" />}
                <span>{zoomed ? "Zoom out" : "Zoom in"}</span>
              </button>
            </div>
            <div ref={viewport} className={`food-menu-image${zoomed ? " is-zoomed" : ""}`} tabIndex={0}>
              <img key={page} src={pages[page]} alt={`Menu page ${page + 1}`} width={2400} height={2400} />
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
