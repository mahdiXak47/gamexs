"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { toPersianDigits } from "@/lib/format";

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PublisherFilter({
  publishers,
  selected,
  onChange,
}: {
  publishers: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) { setSearch(""); return; }
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    // Focus the search input when dropdown opens
    setTimeout(() => searchRef.current?.focus(), 0);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (pub: string) => {
    const next = new Set(selected);
    if (next.has(pub)) next.delete(pub);
    else next.add(pub);
    onChange(next);
  };

  const visible = search.trim()
    ? publishers.filter((p) => p.toLowerCase().includes(search.trim().toLowerCase()))
    : publishers;

  const label =
    selected.size === 0
      ? "سازنده"
      : `${toPersianDigits(selected.size)} سازنده`;

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant={selected.size > 0 ? "secondary" : "ghost"}
        size="sm"
        onPress={() => setOpen((o) => !o)}
        className="gap-1.5"
      >
        {label}
        <ChevronDown />
      </Button>

      {open && (
        <div className="absolute end-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-xl border border-border bg-[var(--background)] shadow-2xl">
          {/* Search inside dropdown */}
          <div className="border-b border-border p-2">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی سازنده…"
              className="w-full rounded-lg bg-white/5 px-3 py-1.5 text-sm text-foreground placeholder:text-muted outline-none focus:ring-1 focus:ring-accent"
              dir="auto"
            />
          </div>

          {/* Publisher list */}
          <div className="max-h-64 overflow-y-auto py-1">
            {visible.length === 0 ? (
              <p className="px-4 py-3 text-center text-xs text-muted">موردی پیدا نشد</p>
            ) : (
              visible.map((pub) => {
                const active = selected.has(pub);
                return (
                  <button
                    key={pub}
                    type="button"
                    onClick={() => toggle(pub)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-sm text-start transition-colors hover:bg-white/5 ${
                      active ? "text-foreground" : "text-muted"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] font-bold transition-colors ${
                        active ? "border-accent bg-accent text-white" : "border-border"
                      }`}
                    >
                      {active && "✓"}
                    </span>
                    {pub}
                  </button>
                );
              })
            )}
          </div>

          {/* Clear filter footer */}
          {selected.size > 0 && (
            <div className="border-t border-border px-3 py-2">
              <button
                type="button"
                onClick={() => { onChange(new Set()); setOpen(false); }}
                className="w-full rounded py-1 text-center text-xs text-muted transition-colors hover:text-foreground"
              >
                پاک کردن فیلتر ({toPersianDigits(selected.size)} سازنده)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
