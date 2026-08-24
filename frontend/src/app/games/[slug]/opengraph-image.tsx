import { ImageResponse } from "next/og";
import { getGameBySlug } from "@/lib/games-repo";
import { formatToman } from "@/lib/format";
import { lowestValidPrice } from "@/lib/purchase-options";
import { SITE_NAME } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "GameXS game price comparison";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  const title = game?.title ?? "مقایسه قیمت بازی‌های PS5";
  const price = game ? lowestValidPrice(game) : null;
  const image = game?.mainBackgroundImageUrl ?? game?.coverUrl ?? null;

  return new ImageResponse(
    (
      <div
        dir="rtl"
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          color: "white",
          background: image ? "#07152b" : "linear-gradient(135deg, #07152b 0%, #1455a3 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {image && (
          <img
            src={image}
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.35 }}
          />
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(3,12,28,.92), rgba(3,12,28,.45))" }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#8fc5ff" }}>{SITE_NAME}</div>
          <div style={{ display: "flex", maxWidth: 1000, fontSize: 64, lineHeight: 1.2, fontWeight: 900 }}>{title}</div>
          <div style={{ display: "flex", fontSize: 30, color: "#d9e8ff" }}>مقایسه قیمت فروشندگان ایرانی برای PS5</div>
        </div>
        <div style={{ position: "relative", display: "flex", fontSize: 34, fontWeight: 800, color: "#f8c34a" }}>
          {price !== null ? `کمترین قیمت: ${formatToman(price)} تومان` : "قیمت و موجودی فروشندگان"}
        </div>
      </div>
    ),
    size,
  );
}
