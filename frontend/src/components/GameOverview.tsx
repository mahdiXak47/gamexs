import Link from "next/link";
import { Chip } from "@heroui/react";
import Image from "@/components/RemoteImage";
import { TrailerVideo } from "@/components/GameTrailer";
import type { GameOverview as Overview } from "@/lib/types";

/** True when the overview embeds the trailer, so the page drops its standalone trailer block. */
export function overviewHasTrailer(overview: Overview | null, trailerUrl: string | null | undefined): boolean {
  return !!trailerUrl && !!overview?.sections.some((s) => s.media === "trailer");
}

function Media({ media, title, screenshots, trailerUrl, poster }: {
  media: string;
  title: string;
  screenshots: string[];
  trailerUrl: string | null;
  poster: string | null;
}) {
  if (media === "trailer") {
    if (!trailerUrl) return null;
    return (
      <figure className="my-6">
        <TrailerVideo title={title} url={trailerUrl} poster={poster} />
        <figcaption className="mt-2 text-xs text-gray-500">تریلر رسمی {title} از فروشگاه PlayStation</figcaption>
      </figure>
    );
  }
  const n = Number(/^screenshot:(\d+)$/.exec(media)?.[1]);
  const src = n > 0 ? screenshots[n - 1] : undefined;
  if (!src) return null;
  return (
    <figure className="relative my-6 aspect-video overflow-hidden rounded-2xl bg-gray-100">
      <Image
        src={src}
        alt={`تصویری از ${title}`}
        fill
        sizes="(min-width: 1024px) 768px, 100vw"
        className="object-cover"
      />
    </figure>
  );
}

/**
 * Server-rendered body of the «توضیحات» tab: the structured overview when one
 * was written, else the legacy plain-text description, else null.
 */
export default function GameOverview({ title, overview, description, screenshots, trailerUrl, poster }: {
  title: string;
  overview: Overview | null;
  description: string | null;
  screenshots: string[];
  trailerUrl: string | null;
  poster: string | null;
}) {
  if (!overview) {
    if (!description) return null;
    return (
      <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-4">
        <h2 className="mb-4 text-lg font-extrabold text-gray-900">توضیحات بازی</h2>
        <p className="whitespace-pre-line text-sm leading-7 text-gray-700">{description}</p>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl" aria-labelledby="game-overview-heading">
      <h2 id="game-overview-heading" className="text-xl font-extrabold leading-9 text-gray-900">
        معرفی بازی <bdi>{title}</bdi>
      </h2>
      <p className="mt-4 text-base leading-8 text-gray-800">{overview.intro}</p>
      {overview.suits?.length ? (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-gray-600">مناسب برای:</span>
          {overview.suits.map((s) => (
            <Chip key={s} size="sm" variant="soft" color="accent">{s}</Chip>
          ))}
        </div>
      ) : null}
      {overview.sections.map((section) => (
        <section key={section.heading} className="mt-9">
          <h3 className="text-lg font-extrabold text-gray-900">{section.heading}</h3>
          {section.paragraphs.map((p, i) => (
            <p key={i} className="mt-3 text-base leading-8 text-gray-700">{p}</p>
          ))}
          {section.media ? (
            <Media media={section.media} title={title} screenshots={screenshots} trailerUrl={trailerUrl} poster={poster} />
          ) : null}
        </section>
      ))}
      <p className="mt-9 rounded-lg bg-blue-50 px-4 py-3 text-sm leading-7 text-gray-700">
        فرق ظرفیت ۱، ۲ و ۳ را نمی‌دانید؟{" "}
        <Link href="/guide/ps5-capacity-accounts" className="font-bold text-ps-blue underline-offset-4 hover:underline">
          راهنمای اکانت‌های ظرفیتی PS5
        </Link>{" "}
        را بخوانید.
      </p>
    </article>
  );
}
