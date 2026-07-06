import Link from "next/link";

export default function Header() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="text-lg font-extrabold">
            Game<span className="text-cta">XS</span>
          </span>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cta text-sm font-extrabold text-white">
            GX
          </span>
        </div>

        <nav className="flex items-center gap-1 text-sm font-medium">
          <span className="cursor-not-allowed rounded-lg px-3 py-2 text-muted" title="به‌زودی">
            گیفت کارت
          </span>
          <span className="cursor-not-allowed rounded-lg px-3 py-2 text-muted" title="به‌زودی">
            اشتراک‌ها
          </span>
          <Link href="/" className="rounded-lg bg-surface-strong px-3 py-2 text-foreground">
            بازی‌ها
          </Link>
        </nav>

        <div className="flex items-center gap-2 text-xs text-muted">
          <span>به‌روزرسانی: حدود ۲ ساعت پیش</span>
          <span className="h-2 w-2 rounded-full bg-success" />
        </div>
      </div>
    </header>
  );
}
