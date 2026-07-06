import Disclaimer from "@/components/Disclaimer";
import GameGrid from "@/components/GameGrid";
import Header from "@/components/Header";
import { coverUrl } from "@/lib/covers";
import { GAMES } from "@/lib/games";

export default function Home() {
  const covers = Object.fromEntries(GAMES.map((g) => [g.slug, coverUrl(g.title)]));

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-extrabold sm:text-4xl">
          مقایسه قیمت بازی‌های <span className="text-cta">PS5</span>
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          قیمت هر بازی را در فروشگاه‌های معتبر ایران، بر اساس نوع خرید (ظرفیت اکانت، دیسک و…) کنار هم
          ببینید و بهترین گزینه را پیدا کنید.
        </p>

        <GameGrid games={GAMES} covers={covers} />
      </main>
      <Disclaimer />
    </>
  );
}
