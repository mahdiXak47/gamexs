import { Alert } from "@heroui/react";

export default function Disclaimer() {
  return (
    <footer className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Alert status="default">
        <Alert.Indicator>ⓘ</Alert.Indicator>
        <Alert.Content>
          <Alert.Title>گیم‌ایکس‌اس فروشنده نیست.</Alert.Title>
          <Alert.Description>
            ما فقط قیمت فروشگاه‌های مختلف را کنار هم مقایسه می‌کنیم؛ خرید نهایی در سایت خودِ فروشنده
            انجام می‌شود. قیمت‌ها هر چند ساعت یک‌بار به‌روزرسانی می‌شوند و ممکن است اندکی با سایت
            فروشنده تفاوت داشته باشند.
          </Alert.Description>
        </Alert.Content>
      </Alert>
    </footer>
  );
}
