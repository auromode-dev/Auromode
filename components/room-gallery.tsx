"use client";
import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
export function RoomGallery({
  images,
  name,
}: {
  images: string[];
  name: string;
}) {
  const [index, setIndex] = useState(0);
  const current = Math.min(index, images.length - 1);
  if (!images.length) return null;
  return (
    <div className="room-gallery">
      <Image
        width={900}
        height={600}
        unoptimized={!images[current].startsWith("/images/")}
        src={images[current]}
        alt={`${name} - photo ${current + 1}`}
        loading="lazy"
      />
      {images.length > 1 && (
        <>
          <button
            type="button"
            className="gallery-prev"
            aria-label={`Previous photo of ${name}`}
            onClick={() =>
              setIndex((current + images.length - 1) % images.length)
            }
          >
            <ChevronLeft size={19} />
          </button>
          <button
            type="button"
            className="gallery-next"
            aria-label={`Next photo of ${name}`}
            onClick={() => setIndex((current + 1) % images.length)}
          >
            <ChevronRight size={19} />
          </button>
          <span className="gallery-count" aria-live="polite">
            {current + 1} / {images.length}
          </span>
          <div className="gallery-thumbnails">
            {images.map((url, i) => (
              <button
                type="button"
                key={url}
                aria-label={`Show photo ${i + 1} of ${name}`}
                aria-pressed={i === current}
                onClick={() => setIndex(i)}
              >
                <Image
                  width={112}
                  height={84}
                  unoptimized={!url.startsWith("/images/")}
                  src={url}
                  alt=""
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
