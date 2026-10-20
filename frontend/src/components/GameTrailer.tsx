// Native <video>: no player library, no JS. preload="none" so the 15–30 MB file
// only downloads when the visitor presses play; the poster is the game art.
export default function GameTrailer({ title, url, poster }: { title: string; url: string; poster: string | null }) {
  return (
    <section aria-labelledby="trailer-heading" className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
      <h2 id="trailer-heading" className="mb-6 text-lg font-bold text-gray-900">
        تریلر بازی
      </h2>
      <video
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
      <p className="mt-2 text-xs text-gray-500">تریلر رسمی از فروشگاه PlayStation</p>
    </section>
  );
}
