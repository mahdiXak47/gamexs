"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import MegaMenu from "./MegaMenu";
import { useAuth } from "@/context/AuthContext";

function CartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

const SearchOverlay = dynamic(() => import("./SearchOverlay"), { ssr: false });

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

const otherNavItems = [
  { label: "PS Plus", href: "/ps-plus" },
  { label: "اکانت PS5", href: "/account-games" },
  { label: "دیسک PS5", href: "/disc-games" },
  { label: "پیش‌خرید", href: "/upcoming" },
];

const mobileNavItems = [
  { label: "بازی‌ها", href: "/" },
  { label: "PS Plus", href: "/ps-plus" },
  { label: "اکانت PS5", href: "/account-games" },
  { label: "دیسک PS5", href: "/disc-games" },
  { label: "پیش‌خرید", href: "/upcoming" },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { user, openAuthModal } = useAuth();

  // Cmd/Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const openMega = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMegaOpen(true);
  };

  const scheduledCloseMega = () => {
    closeTimer.current = setTimeout(() => setMegaOpen(false), 200);
  };

  return (
    <header className="sticky top-0 z-50 shadow-[0_10px_30px_rgba(5,10,25,0.18)]">
      <div className="ps-header">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">

          {/* Logo */}
          <Link href="/" className="flex items-center shrink-0" aria-label="GameXS — صفحه اصلی">
            <Image src="/logos/logo2.png" alt="GameXS" width={1024} height={1024} className="h-11 w-auto" priority />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2" aria-label="ناوبری اصلی">
            {/* بازی‌ها — mega menu trigger */}
            <Link
              href="/"
              onMouseEnter={openMega}
              onMouseLeave={scheduledCloseMega}
              className="flex min-h-11 items-center gap-1 border-b-2 border-ps-plus-gold px-3 py-2 text-sm font-bold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-haspopup="true"
              aria-expanded={megaOpen}
            >
              بازی‌ها
              <span className={`transition-transform duration-200 ${megaOpen ? "rotate-180" : ""}`}>
                <ChevronDownIcon />
              </span>
            </Link>

            {otherNavItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex min-h-11 items-center border-b-2 border-transparent px-3 py-2 text-sm font-medium text-white/78 transition-colors hover:border-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              aria-label="جستجو"
              onClick={() => setSearchOpen(true)}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <SearchIcon />
            </button>
            {user ? (
              <div className="hidden sm:flex items-center gap-2">
                <Link
                  href="/account"
                  className="flex min-h-11 cursor-pointer items-center rounded-full border border-white/35 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  حساب کاربری
                </Link>
                <Link
                  href="/cart"
                  aria-label="سبد خرید"
                  className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <CartIcon />
                </Link>
              </div>
            ) : (
              <button
                onClick={openAuthModal}
                className="hidden min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-white/35 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:inline-flex"
              >
                ورود
              </button>
            )}
            <button
              aria-label="منو"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:hidden"
              onClick={() => setMobileOpen((o) => !o)}
            >
              <MenuIcon />
            </button>
          </div>
        </div>

        {/* Search overlay */}
        {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="flex flex-col gap-1 border-t border-white/15 px-4 py-3 md:hidden">
            {mobileNavItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="min-h-11 rounded-xl px-4 py-2.5 text-sm font-medium text-blue-100 transition-colors hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
            {user ? (
              <div className="mt-2 flex flex-col gap-1">
                <Link
                  href="/cart"
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-blue-100 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <CartIcon />
                  سبد خرید
                </Link>
                <Link
                  href="/account"
                  onClick={() => setMobileOpen(false)}
                  className="min-h-11 rounded-xl px-4 py-2.5 text-sm font-medium text-blue-100 transition-colors hover:bg-white/10 hover:text-white"
                >
                  حساب کاربری
                </Link>
              </div>
            ) : (
              <button
                onClick={() => { openAuthModal(); setMobileOpen(false); }}
                className="mt-2 min-h-11 w-full cursor-pointer rounded-xl border border-white/40 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                ورود
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mega menu — fixed below header, outside ps-header so it escapes the blue bg */}
      {megaOpen && (
        <MegaMenu
          onMouseEnter={openMega}
          onMouseLeave={scheduledCloseMega}
          onClose={() => setMegaOpen(false)}
        />
      )}
    </header>
  );
}
