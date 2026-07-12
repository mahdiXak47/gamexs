import Link from "next/link";
import { Avatar, Button } from "@heroui/react";

export default function Header() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Avatar size="sm" color="warning">
            <Avatar.Fallback color="warning">GX</Avatar.Fallback>
          </Avatar>
          <span className="text-lg font-extrabold">
            Game<span className="text-warning">XS</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <Button variant="ghost" size="sm" isDisabled>گیفت کارت</Button>
          <Button variant="ghost" size="sm" isDisabled>اشتراک‌ها</Button>
          <Link
            href="/"
            className="inline-flex h-9 items-center justify-center rounded-3xl bg-default px-4 text-sm font-medium text-default-foreground md:h-8"
          >
            بازی‌ها
          </Link>
        </nav>

        <div className="flex items-center gap-2 text-xs text-muted">
          <span>به‌روزرسانی: حدود ۲ ساعت پیش</span>
          <span className="flex items-center gap-1" aria-label="سیستم آنلاین است">
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
            <span className="sr-only">آنلاین</span>
          </span>
        </div>
      </div>
    </header>
  );
}
