"use client";

import { useEffect, useReducer } from "react";
import { toPersianDigits } from "@/lib/format";

function computeRemaining(targetIso: string): { days: number; hours: number; minutes: number; seconds: number } {
  const diff = Math.max(0, new Date(targetIso).getTime() - Date.now());
  const totalSec = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}

function DigitBlock({ value, label }: { value: number; label: string }) {
  const padded = String(value).padStart(2, "0");
  const [tens, ones] = [padded[0], padded[1]];
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-1">
        {[tens, ones].map((d, i) => (
          <span
            key={i}
            className="w-8 h-10 sm:w-10 sm:h-12 flex items-center justify-center rounded-md text-xl sm:text-2xl font-bold tabular-nums"
            style={{ background: "rgba(0,0,0,0.55)", color: "#fff", letterSpacing: 0 }}
          >
            {toPersianDigits(d)}
          </span>
        ))}
      </div>
      <span className="text-[10px] sm:text-xs font-medium uppercase tracking-widest text-white/60">
        {label}
      </span>
    </div>
  );
}

export default function CountdownTimer({ releaseDate }: { releaseDate: string }) {
  // Force re-render every second by incrementing a counter
  const [, tick] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const { days, hours, minutes } = computeRemaining(releaseDate);

  return (
    <div className="flex items-end gap-2 sm:gap-3" dir="ltr">
      <DigitBlock value={days} label="روز" />
      <span className="text-2xl font-bold text-white/40 mb-3 leading-none">|</span>
      <DigitBlock value={hours} label="ساعت" />
      <span className="text-2xl font-bold text-white/40 mb-3 leading-none">|</span>
      <DigitBlock value={minutes} label="دقیقه" />
    </div>
  );
}
