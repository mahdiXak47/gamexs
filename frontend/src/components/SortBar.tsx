"use client";

import { Button } from "@heroui/react";

export type SortOption = "popular" | "newest" | "price_asc" | "price_desc";

const OPTIONS: { value: SortOption; label: string }[] = [
  { value: "popular", label: "پرطرفدار‌ترین‌ها" },
  { value: "newest", label: "جدید‌ترین‌ها" },
  { value: "price_asc", label: "کمترین قیمت" },
  { value: "price_desc", label: "بیشترین قیمت" },
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
