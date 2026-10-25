"use client";

import { useState } from "react";
import { toPersianDigits } from "@/lib/format";

// Native <video>: no player library. preload="none" so the 15–30 MB file only
// downloads when the visitor presses play; the poster is the game art.
export function TrailerVideo({ title, url, poster }: { title: string; url: string; poster: string | null }) {
  return (
    <video
      key={url}
      controls
      preload="none"
      playsInline
      poster={poster ?? undefined}
      aria-label={`تریلر رسمی ${title}`}
      className="aspect-video w-full rounded-2xl bg-ps-night object-cover shadow-sm"
    >
      <source src={url} type="video/mp4" />
      <a href={url}>دانلود تریلر {title}</a>
    </video>
  );
}

type Trailer = { url: string; title: string | null };

/** All official trailers of a game: one player, and a selector when there is more than one. */
export default function GameTrailer({ title, trailers, poster }: { title: string; trailers: Trailer[]; poster: string | null }) {
  const [selected, setSelected] = useState(0);
  const current = trailers[selected] ?? trailers[0];
  if (!current) return null;
  const label = (t: Trailer, i: number) => t.title ?? (trailers.length === 1 ? "تریلر رسمی" : `تریلر ${toPersianDigits(i + 1)}`);

  return (
    <section aria-labelledby="trailer-heading" className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
      <h2 id="trailer-heading" className="mb-4 text-lg font-bold text-gray-900">
        {trailers.length > 1 ? `تریلرهای بازی (${toPersianDigits(trailers.length)})` : "تریلر بازی"}
      </h2>
      {trailers.length > 1 && (
        <div role="group" aria-label="انتخاب تریلر" className="mb-4 flex flex-wrap gap-2">
          {trailers.map((t, i) => (
            <button
              key={t.url}
              type="button"
              aria-pressed={i === selected}
              onClick={() => setSelected(i)}
              className={`min-h-11 rounded-xl px-4 text-sm font-bold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                i === selected ? "bg-ps-blue text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {label(t, i)}
            </button>
          ))}
        </div>
      )}
      <TrailerVideo title={`${title} — ${label(current, selected)}`} url={current.url} poster={poster} />
      <p className="mt-2 text-xs text-gray-600">تریلر رسمی از فروشگاه PlayStation</p>
    </section>
  );
}
