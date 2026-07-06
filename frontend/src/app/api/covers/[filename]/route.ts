import fs from "node:fs/promises";
import path from "node:path";

// Local-dev stand-in for the object-storage URLs production will use —
// streams a cover straight out of the scraper's output directory instead of
// duplicating ~70MB of images into frontend/public.
const COVERS_DIR = path.join(process.cwd(), "..", "scraper", "output", "images", "pspro");

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  // path.basename strips any directory components, including from a
  // decoded "%2F" — filename must never escape COVERS_DIR.
  const safeName = path.basename(filename);
  const mime = MIME[path.extname(safeName).toLowerCase()];
  if (!mime) return new Response("not found", { status: 404 });

  try {
    const data = await fs.readFile(path.join(COVERS_DIR, safeName));
    return new Response(data, {
      headers: { "Content-Type": mime, "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
