import { Chip, Spinner } from "@heroui/react";
import { Icon, type IconName } from "./Icon";

type Tone = "accent" | "success" | "danger" | "warning" | "default";

const STATUS: Record<string, { tone: Tone; icon: IconName | "spinner"; label: string }> = {
  running: { tone: "accent", icon: "spinner", label: "Running" },
  succeeded: { tone: "success", icon: "check", label: "Succeeded" },
  failed: { tone: "danger", icon: "x", label: "Failed" },
  suspicious: { tone: "warning", icon: "alert", label: "Suspicious" },
  queued: { tone: "default", icon: "clock", label: "Queued" },
  skipped: { tone: "warning", icon: "skip", label: "Skipped" },
  abandoned: { tone: "default", icon: "ban", label: "Abandoned" },
  stalled: { tone: "warning", icon: "alert", label: "Stalled" },
};

/** Status is always icon + text, never colour alone. */
export function StatusChip({ status, size = "sm" }: { status: string; size?: "sm" | "md" }) {
  const s = STATUS[status] ?? { tone: "default" as Tone, icon: "clock" as IconName, label: status };
  return (
    <Chip color={s.tone} variant="soft" size={size} className="gap-1.5 whitespace-nowrap">
      {s.icon === "spinner" ? <Spinner size="sm" color="current" aria-hidden /> : <Icon name={s.icon} className="h-3.5 w-3.5" />}
      <Chip.Label>{s.label}</Chip.Label>
    </Chip>
  );
}
