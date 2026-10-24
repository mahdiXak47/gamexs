import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// Attaches the logged-in GameXS account to a click (sent by /go's countdown).
// Only the page that created the click knows its one-time claim_token, only an
// anonymous click less than 10 minutes old can be claimed, and only once. The
// user id itself is self-reported (the login cookie is api.gamexs.ir's), so the
// click log treats it as analytics, not proof.
export async function POST(request: Request) {
  let body: { id?: unknown; token?: unknown; userId?: unknown };
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const { id, token, userId } = body;
  if (typeof id !== "string" || !/^\d{1,18}$/.test(id) || typeof token !== "string" || !/^[0-9a-f-]{36}$/.test(token)
      || !Number.isInteger(userId) || (userId as number) <= 0) {
    return new NextResponse(null, { status: 400 });
  }
  await query(
    `UPDATE outbound_clicks SET user_id = $3, claim_token = NULL
     WHERE id = $1 AND claim_token = $2::uuid AND user_id IS NULL AND clicked_at > now() - interval '10 minutes'`,
    [id, token, userId],
  ).catch((error) => console.error("click user not attached", error));
  return new NextResponse(null, { status: 204 });
}
