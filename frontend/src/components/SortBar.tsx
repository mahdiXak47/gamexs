"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import type { SortOption } from "@/lib/types";

export type { SortOption };

const OPTIONS: { value: SortOption; label: string }[] = [
  { value: "popular", label: "پرطرفدار‌ترین‌ها" },
  { value: "newest", label: "جدید‌ترین‌ها" },
  { value: "price_asc", label: "کمترین قیمت" },
  { value: "price_desc", label: "بیشترین قیمت" },
  { value: "alpha_asc", label: "نام: A تا Z" },
  { value: "alpha_desc", label: "نام: Z تا A" },
];

function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function SortBar({ value, onChange }: { value: SortOption; onChange: (v: SortOption) => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const current = OPTIONS.find((option) => option.value === value) ?? OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <>
      <div ref={containerRef} className="relative w-full min-w-0 sm:hidden">
        <Button
          variant="secondary"
          size="sm"
          onPress={() => setOpen((next) => !next)}
          className="w-full justify-between bg-blue-50 text-ps-blue ring-1 ring-blue-100"
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <span>{current.label}</span>
          <span className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
            <ChevronDown />
          </span>
        </Button>

        {open && (
          <div
            className="ui-popover-panel absolute right-0 top-full z-40 mt-2 w-full overflow-hidden rounded-xl border border-blue-100 bg-white p-1 shadow-2xl"
            role="listbox"
            aria-label="مرتب‌سازی بازی‌ها"
          >
            {OPTIONS.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex min-h-10 w-full cursor-pointer items-center justify-between rounded-lg px-3 text-right text-sm font-bold transition-colors ${
                    active ? "bg-ps-blue text-white" : "text-gray-700 hover:bg-blue-50 hover:text-ps-blue"
                  }`}
                >
                  {option.label}
                  {active && <span className="h-2 w-2 rounded-full bg-ps-plus-gold" aria-hidden />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="hidden w-full max-w-full min-w-0 gap-2 pb-1 sm:flex sm:flex-wrap sm:overflow-visible sm:pb-0">
        {OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={value === option.value ? "secondary" : "ghost"}
            size="sm"
            onPress={() => onChange(option.value)}
            className="shrink-0 transition-transform duration-150 active:scale-[0.97]"
          >
            {option.label}
          </Button>
        ))}
      </div>
    </>
  );
}
