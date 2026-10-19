// Lucide-style 24px stroke icons, inlined to avoid an icon dependency.
const PATHS = {
  check: "M20 6 9 17l-5-5",
  x: "M18 6 6 18M6 6l12 12",
  clock: "M12 6v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  skip: "M5 4l10 8-10 8V4ZM19 5v14",
  alert: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  ban: "M4.9 4.9l14.2 14.2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  refresh: "M21 12a9 9 0 0 1-15.4 6.4L3 16M3 12a9 9 0 0 1 15.4-6.4L21 8M21 3v5h-5M3 21v-5h5",
  pause: "M10 4H6v16h4V4ZM18 4h-4v16h4V4Z",
  play: "M6 4l14 8-14 8V4Z",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  activity: "M22 12h-4l-3 9L9 3l-3 9H2",
  store: "M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  chevron: "M9 18l6-6-6-6",
  database: "M21 5c0 1.7-4 3-9 3S3 6.7 3 5m18 0c0-1.7-4-3-9-3S3 3.3 3 5m18 0v14c0 1.7-4 3-9 3s-9-1.3-9-3V5m18 7c0 1.7-4 3-9 3s-9-1.3-9-3",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-4 w-4", label }: { name: IconName; className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
