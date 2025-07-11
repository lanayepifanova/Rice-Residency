/**
 * How a person is named and pictured wherever they appear.
 *
 * Read-only: the site has no accounts, so a profile is written by seeding or
 * by hand in `psql`, never by the person it describes.
 */
import type { User } from "@prisma/client";

export function displayName(user: Pick<User, "name" | "username" | "email">): string {
  // Most of the directory has a name and nothing else; the last two are for the
  // few rows that were created from an address before anyone typed a name in.
  return user.name ?? user.username ?? user.email?.split("@")[0] ?? "Someone";
}

export function avatarInitial(user: Pick<User, "name" | "username" | "email">): string {
  return displayName(user).charAt(0).toUpperCase();
}
