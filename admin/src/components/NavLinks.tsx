"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

export type NavLink = { href: string; label: string; icon: IconName };

const LINKS: NavLink[] = [
  { href: "/", label: "Overview", icon: "activity" },
  { href: "/runs", label: "Run history", icon: "list" },
  { href: "/referrals", label: "Referrals", icon: "store" },
  { href: "/clicks", label: "Click log", icon: "list" },
  { href: "/billing", label: "Billing", icon: "tag" },
];

export function NavLinks({ links = LINKS, home = "/" }: { links?: NavLink[]; home?: string }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex items-center gap-1">
      {links.map((link) => {
        const active = link.href === home ? path === home : path.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent ${
              active ? "bg-surface text-foreground font-medium" : "text-muted hover:text-foreground hover:bg-surface/60"
            }`}
          >
            <Icon name={link.icon} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
