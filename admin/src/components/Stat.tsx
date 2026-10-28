import { Card } from "@heroui/react";

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="gap-1 p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="tabular text-xl font-semibold">{value}</p>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}
