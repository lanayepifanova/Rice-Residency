import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const AVATAR_BUCKET = "avatars";
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export class UploadError extends Error {}

/**
 * Storage client authenticated with the secret key.
 *
 * Uploads run on the server so the browser never holds a key that can write to
 * storage. The secret key bypasses storage RLS, which is why this module must
 * only ever be reached through a route that has already checked who is asking
 * and what they are allowed to touch.
 */
function storageClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new UploadError(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set to upload images.",
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

function extensionFor(type: string): string {
  switch (type) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "jpg";
  }
}

/**
 * Stores a profile photo and returns its public URL.
 *
 * The object key includes a timestamp so a replacement never collides with a
 * cached copy of the previous one — avatars are served from a public bucket
 * behind a CDN, and reusing the key would leave stale images on screen.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (file.size === 0) {
    throw new UploadError("That file is empty.");
  }

  if (file.size > MAX_AVATAR_BYTES) {
    throw new UploadError("Profile photos must be 5MB or smaller.");
  }

  if (!allowedTypes.has(file.type)) {
    throw new UploadError("Profile photos must be a PNG, JPEG, WebP, or GIF image.");
  }

  const supabase = storageClient();
  const path = `${userId}/${Date.now()}.${extensionFor(file.type)}`;

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });

  if (error) {
    throw new UploadError(`Could not save that image: ${error.message}`);
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);

  return data.publicUrl;
}

/** Removes every stored avatar for a user, used when they clear their photo. */
export async function removeAvatars(userId: string): Promise<void> {
  const supabase = storageClient();
  const { data } = await supabase.storage.from(AVATAR_BUCKET).list(userId);

  if (!data?.length) {
    return;
  }

  await supabase.storage
    .from(AVATAR_BUCKET)
    .remove(data.map((entry) => `${userId}/${entry.name}`));
}
