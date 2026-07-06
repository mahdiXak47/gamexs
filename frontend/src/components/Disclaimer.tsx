export default function Disclaimer() {
  return (
    <footer className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        <span aria-hidden>ⓘ</span>
        <p>
          <span className="font-bold text-foreground">گیم‌ایکس‌اس فروشنده نیست.</span>{" "}
          ما فقط قیمت فروشگاه‌های مختلف را کنار هم مقایسه می‌کنیم؛ خرید نهایی در سایت خودِ فروشنده
          انجام می‌شود. قیمت‌ها هر چند ساعت یک‌بار به‌روزرسانی می‌شوند و ممکن است اندکی با سایت
          فروشنده تفاوت داشته باشند.
        </p>
      </div>
    </footer>
  );
}
