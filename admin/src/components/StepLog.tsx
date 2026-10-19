import { Disclosure } from "@heroui/react";

/** Collapsible tail of a step's output (last 200 lines, captured every 10 s). */
export function StepLog({ log, defaultExpanded = false }: { log: string | null; defaultExpanded?: boolean }) {
  if (!log?.trim()) return <p className="text-xs text-muted">No output captured.</p>;
  const lines = log.trimEnd().split("\n");
  return (
    <Disclosure defaultExpanded={defaultExpanded}>
      <Disclosure.Heading>
        <Disclosure.Trigger className="inline-flex items-center gap-1 text-xs text-accent">
          {lines.length} log lines
          <Disclosure.Indicator />
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body>
          <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-black/40 p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-all text-foreground/90">
            {lines.join("\n")}
          </pre>
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}
