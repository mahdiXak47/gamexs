import { Chip } from "@heroui/react";
import Disclaimer from "@/components/Disclaimer";
import GameGrid from "@/components/GameGrid";
import Header from "@/components/Header";
import { listGames } from "@/lib/games-repo";

// Always read fresh from the DB — prices are updated by a periodic scrape,
// so a statically cached page would silently go stale between deploys.
export const dynamic = "force-dynamic";

export default async function Home() {
  const games = await listGames();

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="flex flex-wrap items-center gap-3 text-3xl font-extrabold sm:text-4xl">
          مقایسه قیمت بازی‌های
          <Chip variant="primary" color="accent">PS5</Chip>
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          قیمت هر بازی را در فروشگاه‌های معتبر ایران، بر اساس نوع خرید (ظرفیت اکانت، دیسک و…) کنار هم
          ببینید و بهترین گزینه را پیدا کنید.
        </p>

        <GameGrid games={games} />
      </main>
      <Disclaimer />
    </>
  );
}
