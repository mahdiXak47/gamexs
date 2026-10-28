import { Button } from "@heroui/react";
import { Icon } from "@/components/Icon";
import { NavLinks, type NavLink } from "@/components/NavLinks";
import { logout } from "@/lib/actions";
import { requireStore } from "@/lib/auth";
import { sellerName } from "@/lib/billing";

const LINKS: NavLink[] = [
  { href: "/store", label: "Traffic", icon: "activity" },
  { href: "/store/invoices", label: "Invoices", icon: "tag" },
  { href: "/store/balance", label: "Balance", icon: "database" },
];

/** Partner store portal: read-only, scoped to the signed-in account's store. */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStore();
  const store = await sellerName(user.store.id);
  return (
    <>
      <a href="#main" className="skip-link rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="inline-flex items-center gap-2 font-semibold">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-success/15 text-success">
              <Icon name="store" />
            </span>
            {store?.name ?? "Your store"} <span className="font-normal text-muted">· GameXS partner</span>
          </span>
          <NavLinks links={LINKS} home="/store" />
          <form action={logout} className="ms-auto">
            <Button type="submit" size="sm" variant="ghost" aria-label="Sign out">
              <Icon name="logout" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </form>
        </div>
      </header>
      <main id="main" className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6">
        {children}
      </main>
    </>
  );
}
