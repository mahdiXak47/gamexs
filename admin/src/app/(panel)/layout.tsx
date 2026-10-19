import { Button } from "@heroui/react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { NavLinks } from "@/components/NavLinks";
import { logout } from "@/lib/actions";
import { requireStaff } from "@/lib/auth";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.phone_number;
  return (
    <>
      <a href="#main" className="skip-link rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="inline-flex items-center gap-2 font-semibold">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-success/15 text-success">
              <Icon name="activity" />
            </span>
            GameXS Ops
          </Link>
          <NavLinks />
          <div className="ms-auto flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{name}</span>
            <form action={logout}>
              <Button type="submit" size="sm" variant="ghost" aria-label="Sign out">
                <Icon name="logout" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6">
        {children}
      </main>
    </>
  );
}
