import { Prisma, type User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { profileUpdateSchema, type ProfileUpdateRequest } from "@/lib/api/contracts";
import { removeAvatars, uploadAvatar, UploadError } from "./storage";

export class ProfileError extends Error {
  constructor(
    readonly field: string | null,
    message: string,
  ) {
    super(message);
    this.name = "ProfileError";
  }
}

export type ProfileUpdate = ProfileUpdateRequest & {
  photo?: File | null;
  removePhoto?: boolean;
};

export async function updateProfile(userId: string, input: ProfileUpdate): Promise<User> {
  const parsed = profileUpdateSchema.safeParse(input);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ProfileError(issue.path[0]?.toString() ?? null, issue.message);
  }

  let avatarUrl: string | null | undefined;

  if (input.removePhoto) {
    await removeAvatars(userId).catch(() => undefined);
    avatarUrl = null;
  } else if (input.photo && input.photo.size > 0) {
    try {
      avatarUrl = await uploadAvatar(userId, input.photo);
    } catch (error) {
      throw new ProfileError("photo", error instanceof UploadError ? error.message : "Upload failed.");
    }
  }

  try {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        name: parsed.data.name,
        // Handles are compared case-insensitively by storing them lowercased,
        // so @Lana and @lana cannot both be claimed.
        username: parsed.data.username.toLowerCase(),
        bio: emptyToNull(parsed.data.bio),
        instagram: emptyToNull(parsed.data.instagram),
        twitter: emptyToNull(parsed.data.twitter),
        birthday: emptyToNull(parsed.data.birthday),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      String(error.meta?.target ?? "").includes("username")
    ) {
      throw new ProfileError("username", "That username is already taken.");
    }
    throw error;
  }
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function displayName(user: Pick<User, "name" | "username" | "email">): string {
  return user.name ?? user.username ?? user.email.split("@")[0];
}

export function avatarInitial(user: Pick<User, "name" | "username" | "email">): string {
  return displayName(user).charAt(0).toUpperCase();
}
