import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import {
  ACCESS_COOKIE,
  fetchProfile,
  type StaffProfile,
} from "./session";

/** The signed-in account, or null. */
export const currentProfile = cache(async (): Promise<StaffProfile | null> => {
  const access = (await cookies()).get(ACCESS_COOKIE)?.value;
  return access ? await fetchProfile(access).catch(() => null) : null;
});

/** Authoritative check for every panel page: a live backend profile with is_staff. */
export const requireStaff = cache(async (): Promise<StaffProfile> => {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (!profile.is_staff) redirect(profile.store ? "/store" : "/login?error=forbidden");
  return profile;
});

/** Store portal pages: the store comes from the backend profile, never from the URL. */
export const requireStore = cache(async (): Promise<StaffProfile & { store: { id: number } }> => {
  const profile = await currentProfile();
  if (!profile) redirect("/login?next=/store");
  if (!profile.store) redirect(profile.is_staff ? "/billing" : "/login?error=forbidden");
  return profile as StaffProfile & { store: { id: number } };
});

