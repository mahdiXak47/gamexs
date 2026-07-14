import fs from "node:fs/promises";
import path from "node:path";

// Two directories checked in priority order:
//   1. covers/  — IGDB images downloaded by download_igdb_images.py ({slug}-main-cover.webp)
//   2. pspro/   — seller-scraped images downloaded by download_images.py
const COVERS_DIR = path.join(process.cwd(), "..", "scraper", "output", "images", "covers");
const PSPRO_DIR = path.join(process.cwd(), "..", "scraper", "output", "images", "pspro");

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

async function tryRead(dir: string, name: string): Promise<ArrayBuffer | null> {
  try {
    const buf = await fs.readFile(path.join(dir, name));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  } catch {
    return null;
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const safeName = path.basename(filename);
  const mime = MIME[path.extname(safeName).toLowerCase()];
  if (!mime) return new Response("not found", { status: 404 });

  const data = (await tryRead(COVERS_DIR, safeName)) ?? (await tryRead(PSPRO_DIR, safeName));
  if (!data) return new Response("not found", { status: 404 });

  return new Response(data, {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
}
