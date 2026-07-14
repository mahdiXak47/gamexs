import fs from "node:fs/promises";
import path from "node:path";

const IGDB_DIR = path.join(process.cwd(), "..", "scraper", "output", "images", "igdb");

export async function GET(_req: Request, { params }: { params: Promise<{ imageId: string }> }) {
  const { imageId } = await params;
  // Strip any extension the caller may have appended, then sanitise.
  const safeId = path.basename(imageId.replace(/\.jpe?g$/i, ""));
  if (!/^[a-zA-Z0-9]+$/.test(safeId)) {
    return new Response("not found", { status: 404 });
  }
  try {
    const data = await fs.readFile(path.join(IGDB_DIR, `${safeId}.jpg`));
    return new Response(data, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
