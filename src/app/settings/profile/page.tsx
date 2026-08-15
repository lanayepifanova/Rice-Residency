import { requireUser } from "@/lib/auth";
import { getPreferences } from "@/lib/server/notifications";
import { avatarInitial } from "@/lib/server/profile";
import { SideNav } from "../../components/SideNav";
import { SiteHeader } from "../../components/SiteHeader";
import { PreferencesForm, ProfileForm } from "./settings-forms";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const user = await requireUser("/settings/profile");
  const preferences = await getPreferences(user.id);

  return (
    <>
      <SiteHeader />
      <SideNav />
      <main>
        <h1 className="welcome-heading">Settings</h1>

        <section className="profile-photo-section">
          <ProfileForm
            values={{
              email: user.email,
              name: user.name ?? "",
              username: user.username ?? "",
              bio: user.bio ?? "",
              instagram: user.instagram ?? "",
              twitter: user.twitter ?? "",
              birthday: user.birthday ?? "",
              avatarUrl: user.avatarUrl,
              initial: avatarInitial(user),
            }}
          />
        </section>

        <section className="profile-photo-section">
          <PreferencesForm values={preferences} />
        </section>

        <p className="field-hint">
          <a href="/profile">View your profile</a>
        </p>
      </main>
    </>
  );
}
