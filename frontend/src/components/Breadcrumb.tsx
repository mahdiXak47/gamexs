import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string; // omitted for the current page (last item)
}

// Renders right-to-left under the site's global dir="rtl": the first item
// (site root) lands on the right, matching how Persian breadcrumbs are read.
export default function Breadcrumb({ items, light = false }: { items: BreadcrumbItem[]; light?: boolean }) {
  return (
    <nav aria-label="مسیر صفحه" className="text-sm">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1.5">
              {i > 0 && (
                <span className={light ? "text-white/40" : "text-gray-400"} aria-hidden="true">
                  /
                </span>
              )}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className={`transition-colors ${
                    light ? "text-white/65 hover:text-white" : "text-muted hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={`line-clamp-1 ${
                    isLast
                      ? `font-bold ${light ? "text-white" : "text-gray-900"}`
                      : light ? "text-white/65" : "text-muted"
                  }`}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
