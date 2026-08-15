"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { updatePreferences } from "@/lib/server/notifications";
import { ProfileError, updateProfile } from "@/lib/server/profile";

export type ProfileState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string; field: string | null };

export async function saveProfileAction(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await requireUser("/settings/profile");
  const photo = formData.get("photo");

  try {
    await updateProfile(user.id, {
      name: text(formData.get("name")),
      username: text(formData.get("username")),
      bio: text(formData.get("bio")),
      instagram: text(formData.get("instagram")),
      twitter: text(formData.get("twitter")),
      birthday: text(formData.get("birthday")) || undefined,
      photo: photo instanceof File ? photo : null,
      removePhoto: formData.get("removePhoto") === "on",
    });
  } catch (error) {
    if (error instanceof ProfileError) {
      return { status: "error", message: error.message, field: error.field };
    }
    throw error;
  }

  revalidatePath("/profile");
  revalidatePath("/settings/profile");
  revalidatePath("/");

  return { status: "saved", message: "Profile saved." };
}

export type PreferencesState = { status: "idle" } | { status: "saved"; message: string };

/**
 * Push and SMS are stored but not yet delivered. The toggles are shown anyway,
 * labelled honestly, because the preference is the stable part of the design —
 * only the adapter behind it is missing.
 */
export async function savePreferencesAction(
  _previous: PreferencesState,
  formData: FormData,
): Promise<PreferencesState> {
  const user = await requireUser("/settings/profile");

  await updatePreferences(user.id, {
    inApp: formData.get("inApp") === "on",
    email: formData.get("email") === "on",
    push: formData.get("push") === "on",
    sms: formData.get("sms") === "on",
  });

  revalidatePath("/settings/profile");
  revalidatePath("/notifications");

  return { status: "saved", message: "Notification settings saved." };
}

function text(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}
