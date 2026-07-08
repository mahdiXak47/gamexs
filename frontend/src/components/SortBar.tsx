export type SortOption = "popular" | "newest" | "price_asc" | "price_desc";

const OPTIONS: { value: SortOption; label: string }[] = [
  { value: "popular", label: "پرطرفدار‌ترین‌ها" },
  { value: "newest", label: "جدید‌ترین‌ها" },
  { value: "price_asc", label: "کمترین قیمت" },
  { value: "price_desc", label: "بیشترین قیمت" },
];

export default function SortBar({ value, onChange }: { value: SortOption; onChange: (value: SortOption) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
            value === option.value
              ? "border-cta bg-surface-strong text-foreground"
              : "border-border text-muted hover:border-accent hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
