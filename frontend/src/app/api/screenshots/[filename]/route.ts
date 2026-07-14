import fs from "node:fs/promises";
import path from "node:path";

const SCREENSHOTS_DIR = path.join(
  process.cwd(),
  "..",
  "scraper",
  "output",
  "images",
  "screenshots"
);

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function GET(_req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  // path.basename prevents directory traversal; allow slug chars + dashes + digits.
  const safeName = path.basename(filename);
  const mime = MIME[path.extname(safeName).toLowerCase()];
  if (!mime) return new Response("not found", { status: 404 });

  try {
    const data = await fs.readFile(path.join(SCREENSHOTS_DIR, safeName));
    return new Response(data, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
