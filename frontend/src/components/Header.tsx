"use client";

import { useState } from "react";
import Link from "next/link";

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

function PSIcon() {
  return (
    <svg width="32" height="22" viewBox="0 0 32 22" fill="white" aria-hidden>
      <path d="M11.6 0v16.8l4 1.3V4.1c0-.7.3-1.2.8-1 .6.2.9.8.9 1.5v11.6l4 1.3V4.4C21.3 1.4 19.4 0 17 0c-1.6 0-3.5.7-5.4 0zM20.8 13.8v3.3l6.4-2.1c.7-.2.8-.5.3-.7l-2.7-.9c-.5-.2-1.3-.1-2 .1l-2 .3zM0 17.3l5.8 2c2 .7 4.2.5 5.8-.5V15l-4.2 1.4c-.6.2-1.2.2-1.6 0L4 15.7c-.5-.2-.4-.5.1-.7l1.7-.6V11l-5.8 2v4.3z" />
    </svg>
  );
}

const navItems = [
  { label: "بازی‌ها", href: "/", active: true },
  { label: "PS Plus", href: "#", active: false },
  { label: "اخبار", href: "#", active: false },
  { label: "پشتیبانی", href: "#", active: false },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 shadow-md">
      <div className="ps-header">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 shrink-0" aria-label="GameXS - صفحه اصلی">
            <PSIcon />
            <span className="text-white text-xl font-extrabold tracking-wide">
              Game<span className="text-yellow-300">XS</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1" aria-label="ناوبری اصلی">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  item.active
                    ? "bg-white/20 text-white"
                    : "text-blue-100 hover:bg-white/10 hover:text-white"
                }`}
                aria-current={item.active ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              aria-label="جستجو"
              className="cursor-pointer p-2 rounded-full text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <SearchIcon />
            </button>
            <Link
              href="#"
              className="hidden sm:inline-flex items-center gap-1.5 border border-white/40 text-white text-sm font-medium px-4 py-1.5 rounded-full hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              ورود
            </Link>
            <button
              aria-label="منو"
              className="cursor-pointer md:hidden p-2 rounded-full text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              onClick={() => setMobileOpen((o) => !o)}
            >
              <MenuIcon />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/20 px-4 py-3 flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  item.active ? "bg-white/20 text-white" : "text-blue-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="#"
              className="mt-2 text-center border border-white/40 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-white/10 transition-colors"
            >
              ورود
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
