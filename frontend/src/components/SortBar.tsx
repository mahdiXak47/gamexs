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
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? "secondary" : "ghost"}
          size="sm"
          onPress={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
