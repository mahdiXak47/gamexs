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
    <header className="sticky top-0 z-50 shadow-md">
      <div className="ps-header">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">

          {/* Logo */}
          <Link href="/" className="flex items-center shrink-0" aria-label="GameXS — صفحه اصلی">
            <Image src="/logos/logo2.png" alt="GameXS" width={1024} height={1024} className="h-12 w-auto" priority />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2" aria-label="ناوبری اصلی">
            {/* بازی‌ها — mega menu trigger */}
            <Link
              href="/"
              onMouseEnter={openMega}
              onMouseLeave={scheduledCloseMega}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-white/85 hover:text-white border-b-2 border-transparent hover:border-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
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
                className="px-3 py-2 text-sm font-medium text-white/85 hover:text-white border-b-2 border-transparent hover:border-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
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
              className="cursor-pointer p-2 rounded-full text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <SearchIcon />
            </button>
            {user ? (
              <div className="hidden sm:flex items-center gap-2">
                <Link
                  href="/account"
                  className="cursor-pointer border border-white/40 text-white text-sm font-medium px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  حساب کاربری
                </Link>
                <Link
                  href="/cart"
                  aria-label="سبد خرید"
                  className="cursor-pointer p-2 rounded-full text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <CartIcon />
                </Link>
              </div>
            ) : (
              <button
                onClick={openAuthModal}
                className="hidden sm:inline-flex cursor-pointer items-center gap-1.5 border border-white/40 text-white text-sm font-medium px-4 py-1.5 rounded-full hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                ورود
              </button>
            )}
            <button
              aria-label="منو"
              className="cursor-pointer md:hidden p-2 rounded-full text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
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
          <div className="md:hidden border-t border-white/20 px-4 py-3 flex flex-col gap-1">
            {mobileNavItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-blue-100 hover:bg-white/10 hover:text-white transition-colors"
              >
                {item.label}
              </Link>
            ))}
            {user ? (
              <div className="mt-2 flex flex-col gap-1">
                <Link
                  href="/cart"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-blue-100 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <CartIcon />
                  سبد خرید
                </Link>
                <Link
                  href="/account"
                  onClick={() => setMobileOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-blue-100 hover:bg-white/10 hover:text-white transition-colors"
                >
                  حساب کاربری
                </Link>
              </div>
            ) : (
              <button
                onClick={() => { openAuthModal(); setMobileOpen(false); }}
                className="mt-2 w-full cursor-pointer text-center border border-white/40 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-white/10 transition-colors"
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
