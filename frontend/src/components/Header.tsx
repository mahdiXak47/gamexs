import Link from "next/link";
import { Avatar, Button, Tooltip } from "@heroui/react";

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "همین الان";
  if (diffMin < 60) return `${diffMin} دقیقه پیش`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} ساعت پیش`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} روز پیش`;
}

export default function Header({ lastScrapedAt }: { lastScrapedAt?: Date | null }) {
  const label = lastScrapedAt ? formatRelative(lastScrapedAt) : "نامشخص";
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
          <Tooltip>
            <Tooltip.Trigger><Button variant="ghost" size="sm" isDisabled>گیفت کارت</Button></Tooltip.Trigger>
            <Tooltip.Content>به زودی</Tooltip.Content>
          </Tooltip>
          <Tooltip>
            <Tooltip.Trigger><Button variant="ghost" size="sm" isDisabled>اشتراک‌ها</Button></Tooltip.Trigger>
            <Tooltip.Content>به زودی</Tooltip.Content>
          </Tooltip>
          <Link
            href="/"
            className="inline-flex h-9 items-center justify-center rounded-3xl bg-default px-4 text-sm font-medium text-default-foreground md:h-8"
          >
            بازی‌ها
          </Link>
        </nav>

        <div className="flex items-center gap-2 text-xs text-muted">
          <span>به‌روزرسانی: {label}</span>
          <span className="flex items-center gap-1" aria-label="سیستم آنلاین است">
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
            <span className="sr-only">آنلاین</span>
          </span>
        </div>
      </div>
    </header>
  );
}
