import { errorResponse, requireApiUser } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { ProfileError, updateProfile } from "@/lib/server/profile";

export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });

  if (!user) {
    return Response.json({ error: "Profile not found." }, { status: 404 });
  }

  return Response.json({ profile: publicProfile(user) });
}

/**
 * Accepts multipart so the photo arrives with the rest of the form in one
 * request. The upload itself happens server-side against the storage bucket —
 * the browser is never given a key that can write to it.
 */
export async function PATCH(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const contentType = request.headers.get("content-type") ?? "";

  try {
    const input = contentType.includes("multipart/form-data")
      ? fromFormData(await request.formData())
      : ((await request.json()) as Record<string, unknown>);

    const user = await updateProfile(auth.userId, input as Parameters<typeof updateProfile>[1]);

    return Response.json({ profile: publicProfile(user) });
  } catch (error) {
    if (error instanceof ProfileError) {
      return Response.json({ error: error.message, field: error.field }, { status: 400 });
    }
    return errorResponse(error);
  }
}

function fromFormData(formData: FormData) {
  const photo = formData.get("photo");

  return {
    name: text(formData.get("name")),
    username: text(formData.get("username")),
    bio: text(formData.get("bio")),
    instagram: text(formData.get("instagram")),
    twitter: text(formData.get("twitter")),
    birthday: text(formData.get("birthday")) || undefined,
    photo: photo instanceof File ? photo : null,
    removePhoto: formData.get("removePhoto") === "on",
  };
}

function text(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function publicProfile(user: {
  id: string;
  email: string | null;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  instagram: string | null;
  twitter: string | null;
  birthday: string | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    instagram: user.instagram,
    twitter: user.twitter,
    birthday: user.birthday,
    joinedAt: user.createdAt,
  };
}
