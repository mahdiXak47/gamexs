import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import {
  ACCESS_COOKIE,
  fetchProfile,
  type StaffProfile,
} from "./session";

/** Authoritative check for every panel page: a live backend profile with is_staff. */
export const requireStaff = cache(async (): Promise<StaffProfile> => {
  const access = (await cookies()).get(ACCESS_COOKIE)?.value;
  const profile = access ? await fetchProfile(access).catch(() => null) : null;
  if (!profile) redirect("/login");
  if (!profile.is_staff) redirect("/login?error=forbidden");
  return profile;
});
