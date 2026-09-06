"use client";

import { useEffect, useState } from "react";
import { getImageUrl } from "@/lib/db";
import { CATEGORY_EMOJI } from "@/lib/taxonomy";
import type { CategoryId } from "@/lib/types";

interface Props {
  imageId?: string;
  alt: string;
  category: CategoryId;
  className?: string;
  /** Larger placeholder glyph for the detail sheet. */
  size?: "card" | "sheet";
}

/**
 * Renders a photo stored in IndexedDB. Falls back to a tinted card with the
 * category glyph, which keeps grids tidy while photos are still being added.
 */
export default function ItemPhoto({
  imageId,
  alt,
  category,
  className = "",
  size = "card",
}: Props) {
  // Tracked together so a photo from a previous `imageId` never flashes on a
  // card that has since been re-pointed at a different piece.
  const [resolved, setResolved] = useState<{ id: string; url: string } | null>(
    null,
  );

  useEffect(() => {
    if (!imageId) return;
    let cancelled = false;
    getImageUrl(imageId).then((url) => {
      if (!cancelled && url) setResolved({ id: imageId, url });
    });
    return () => {
      cancelled = true;
    };
  }, [imageId]);

  const url = imageId && resolved?.id === imageId ? resolved.url : null;

  if (!url) {
    return (
      <div
        className={`flex items-center justify-center bg-bone-deep ${className}`}
      >
        <span
          className={`opacity-30 ${size === "sheet" ? "text-8xl" : "text-6xl"}`}
          role="img"
          aria-label={alt}
        >
          {CATEGORY_EMOJI[category]}
        </span>
      </div>
    );
  }

  return (
    // Blob URLs can't be optimised by next/image, so a plain img is correct.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={`animate-fade object-cover ${className}`}
    />
  );
}
