"use client";

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

export default function SortBar({ value, onChange }: { value: SortOption; onChange: (v: SortOption) => void }) {
  return (
    <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
      {OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? "secondary" : "ghost"}
          size="sm"
          onPress={() => onChange(option.value)}
          className="shrink-0"
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
