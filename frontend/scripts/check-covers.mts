// Self-check: S3 URLs are rebased onto whatever S3_ENDPOINT_URL is set to.
// Run: npx tsx scripts/check-covers.mts
process.env.S3_ENDPOINT_URL = "http://new-endpoint.example/";
process.env.S3_BUCKET = "gamexs";
const { normalizeS3Url: n, isS3ImageUrl: i, s3CoverUrl } = await import("../src/lib/covers.js");
const eq = (a: unknown, b: unknown) => { if (a !== b) throw new Error(`${a} !== ${b}`); };

eq(n("http://old-host.example/gamexs/covers/a.webp"), "https://new-endpoint.example/gamexs/covers/a.webp");
eq(n("https://other.example/gamexs/main-background-images/b.webp"), "https://new-endpoint.example/gamexs/main-background-images/b.webp");
eq(n("https://x.example/gamexs/a.webp", "https://passed-base.example/gamexs"), "https://passed-base.example/gamexs/a.webp");
eq(n("https://images.igdb.com/igdb/image/upload/x.jpg"), "https://images.igdb.com/igdb/image/upload/x.jpg");
eq(i("https://any.example/gamexs/a.webp"), true);
eq(i("https://images.igdb.com/x.jpg"), false);
eq(i(null), false);
eq(s3CoverUrl("gta"), "https://new-endpoint.example/gamexs/covers/gta-main-cover.webp");
console.log("covers ok");
