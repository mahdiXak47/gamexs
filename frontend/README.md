# GameXS Frontend

Next.js 16 App Router frontend for the GameXS PS5 price-comparison catalog.

## Commands

```bash
npm run dev
npm run build
npm run lint
```

## Bundle Analysis

Use the built-in Next.js Turbopack analyzer to inspect client and server module
size without adding a separate webpack analyzer dependency:

```bash
npm run analyze
```

The static analyzer output is written to `.next/diagnostics/analyze`.

For an interactive local analyzer UI:

```bash
npm run analyze:serve
```

The served analyzer binds to Next's default analyzer port unless `PORT` is set.
