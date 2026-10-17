import { connection } from "next/server";
import { S3_BASE } from "@/lib/covers";
import AccountPage from "./AccountPage";

// Server wrapper so the client page gets the S3 base from runtime env.
export default async function Page() {
  await connection();
  return <AccountPage s3Base={S3_BASE} />;
}
